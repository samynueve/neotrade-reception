"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/i18n/client";

type Props = { onCode: (code: string) => void; paused?: boolean };

type Detector = { detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]> };
type DetectorCtor = { new (opts: { formats: string[] }): Detector; getSupportedFormats?: () => Promise<string[]> };

const FORMATS = ["code_128", "ean_13", "itf", "code_39", "qr_code", "data_matrix"];

/**
 * Lecture de codes-barres par la caméra arrière.
 * Lecteur natif du téléphone (Android/Chrome) s'il existe, sinon ZXing (iPhone) chargé à la demande.
 * La même étiquette restée devant la caméra n'est signalée qu'une fois toutes les 3 secondes.
 */
export function CameraScanner({ onCode, paused }: Props) {
  const { t } = useI18n();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<"denied" | "notFound" | "unavailable" | null>(null);
  const [torch, setTorch] = useState<MediaStreamTrack | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const onCodeRef = useRef(onCode);
  onCodeRef.current = onCode;

  useEffect(() => {
    let stopped = false;
    let stopFn: () => void = () => {};
    const last = { code: "", at: 0 };
    const emit = (code: string) => {
      const now = Date.now();
      if (pausedRef.current || (code === last.code && now - last.at < 3000)) return;
      last.code = code;
      last.at = now;
      onCodeRef.current(code);
    };

    (async () => {
      const video = videoRef.current!;
      const Native = (window as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;
      const supported = Native ? await Native.getSupportedFormats?.().catch(() => []) : [];
      try {
        if (Native && supported?.includes("code_128")) {
          const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
          if (stopped) return stream.getTracks().forEach((t) => t.stop());
          video.srcObject = stream;
          await video.play();
          const track = stream.getVideoTracks()[0];
          if ((track.getCapabilities?.() as { torch?: boolean } | undefined)?.torch) setTorch(track);
          const detector = new Native({ formats: FORMATS.filter((f) => supported.includes(f)) });
          let raf = 0;
          const loop = async () => {
            if (stopped) return;
            try {
              const codes = await detector.detect(video);
              if (codes[0]?.rawValue) emit(codes[0].rawValue);
            } catch {
              // image pas encore prête
            }
            raf = window.setTimeout(loop, 120);
          };
          loop();
          stopFn = () => {
            clearTimeout(raf);
            stream.getTracks().forEach((t) => t.stop());
          };
        } else {
          const { BrowserMultiFormatReader } = await import("@zxing/browser");
          if (stopped) return;
          const reader = new BrowserMultiFormatReader(undefined, { delayBetweenScanAttempts: 150, delayBetweenScanSuccess: 400 });
          const controls = await reader.decodeFromConstraints({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 } }, audio: false }, video, (result) => {
            if (result) emit(result.getText());
          });
          if (stopped) return controls.stop();
          stopFn = () => controls.stop();
          const track = (video.srcObject as MediaStream | null)?.getVideoTracks()[0];
          if (track && (track.getCapabilities?.() as { torch?: boolean } | undefined)?.torch) setTorch(track);
        }
      } catch (e) {
        const name = (e as { name?: string }).name;
        setError(name === "NotAllowedError" ? "denied" : name === "NotFoundError" ? "notFound" : "unavailable");
      }
    })();

    return () => {
      stopped = true;
      stopFn();
    };
  }, []);

  async function toggleTorch() {
    if (!torch) return;
    const on = !torchOn;
    await torch.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] }).catch(() => {});
    setTorchOn(on);
  }

  if (error)
    return (
      <p role="alert" className="rounded-2xl border-2 border-alert bg-red-50 p-4 font-bold text-alert">
        {t.camera[error]}
      </p>
    );

  return (
    <div className="relative overflow-hidden rounded-2xl bg-brand-ink">
      <video ref={videoRef} playsInline muted className="aspect-[4/3] w-full object-cover" />
      {/* Cadre de visée */}
      <div aria-hidden className="pointer-events-none absolute inset-x-[8%] top-1/2 h-[34%] -translate-y-1/2 rounded-xl border-4 border-brand-green shadow-[0_0_0_9999px_rgba(19,19,39,0.35)]" />
      <p className="absolute inset-x-0 bottom-2 text-center text-sm font-bold text-white drop-shadow">{t.camera.aim}</p>
      {torch && (
        <button type="button" onClick={toggleTorch} aria-pressed={torchOn} className="absolute end-2 top-2 min-h-12 rounded-xl bg-white/90 px-3 font-bold text-brand-ink">
          {torchOn ? t.camera.torchOn : t.camera.torch}
        </button>
      )}
    </div>
  );
}
