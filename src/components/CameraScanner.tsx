"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/i18n/client";
import { unlockSound } from "@/lib/client/feedback";

type Props = { onCode: (code: string) => void; paused?: boolean };

type Detector = { detect: (source: HTMLCanvasElement) => Promise<{ rawValue: string }[]> };
type DetectorCtor = { new (opts: { formats: string[] }): Detector; getSupportedFormats?: () => Promise<string[]> };

const FORMATS = ["code_128", "ean_13", "itf", "code_39", "qr_code", "data_matrix"];

// Zone du viseur (doit correspondre au cadre dessiné plus bas) : 84 % de la largeur, 34 % de la hauteur
const AIM_W = 0.84;
const AIM_H = 0.34;

/**
 * Lecteur natif du téléphone (Android/Chrome) s'il existe ; sinon (iPhone) ZXing-C++ en WebAssembly,
 * servi par l'app (/wasm, disponible hors ligne). Seule la zone du viseur est analysée : plus rapide et plus fiable.
 */
async function createDetector(): Promise<Detector> {
  const Native = (window as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;
  const supported = Native ? await Native.getSupportedFormats?.().catch(() => []) : [];
  if (Native && supported?.includes("code_128")) return new Native({ formats: FORMATS.filter((f) => supported.includes(f)) });
  const { BarcodeDetector, prepareZXingModule } = await import("barcode-detector/ponyfill");
  prepareZXingModule({
    overrides: { locateFile: (path: string, prefix: string) => (path.endsWith(".wasm") ? `/wasm/${path}` : prefix + path) },
  });
  return new BarcodeDetector({ formats: FORMATS as never });
}

/** Copie dans le canvas la partie de l'image vidéo visible dans le viseur (la vidéo est affichée en object-cover). */
function drawAim(video: HTMLVideoElement, canvas: HTMLCanvasElement): boolean {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return false;
  const scale = Math.max(video.clientWidth / vw, video.clientHeight / vh);
  const sw = (video.clientWidth / scale) * AIM_W;
  const sh = (video.clientHeight / scale) * AIM_H;
  canvas.width = Math.round(sw);
  canvas.height = Math.round(sh);
  canvas.getContext("2d", { willReadFrequently: true })!.drawImage(video, (vw - sw) / 2, (vh - sh) / 2, sw, sh, 0, 0, canvas.width, canvas.height);
  return true;
}

/**
 * Scanner de codes-barres par la caméra arrière, à la manière d'une douchette :
 * viseur avec laser, mise au point continue, zoom ×2 (lecture nette à 25-30 cm), cadre vert « lu » à chaque code.
 * La même étiquette restée devant la caméra n'est signalée qu'une fois toutes les 3 secondes.
 */
export function CameraScanner({ onCode, paused }: Props) {
  const { t } = useI18n();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<"denied" | "notFound" | "unavailable" | null>(null);
  const [ready, setReady] = useState(false);
  const [hit, setHit] = useState<string | null>(null);
  const [torch, setTorch] = useState<MediaStreamTrack | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const onCodeRef = useRef(onCode);
  onCodeRef.current = onCode;

  useEffect(() => {
    let stopped = false;
    let timer = 0;
    let hitTimer = 0;
    let stream: MediaStream | null = null;
    const last = { code: "", at: 0 };
    const canvas = document.createElement("canvas");

    // iPhone : le son n'est permis qu'après un premier toucher de l'écran
    document.addEventListener("pointerdown", unlockSound, { once: true });

    (async () => {
      const video = videoRef.current!;
      try {
        const [detector, media] = await Promise.all([
          createDetector(),
          navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false }),
        ]);
        stream = media;
        if (stopped) return stream.getTracks().forEach((tr) => tr.stop());
        video.srcObject = stream;
        await video.play();

        const track = stream.getVideoTracks()[0];
        const caps = (track.getCapabilities?.() ?? {}) as { torch?: boolean; zoom?: { min: number; max: number }; focusMode?: string[] };
        const advanced: Record<string, unknown>[] = [];
        if (caps.focusMode?.includes("continuous")) advanced.push({ focusMode: "continuous" });
        // Zoom ×2 : sur iPhone, l'objectif principal ne fait pas la mise au point de près ; on scanne de plus loin
        if (caps.zoom && caps.zoom.max >= 2) advanced.push({ zoom: Math.max(caps.zoom.min, 2) });
        if (advanced.length) await track.applyConstraints({ advanced: advanced as MediaTrackConstraintSet[] }).catch(() => {});
        if (caps.torch) setTorch(track);
        setReady(true);

        const loop = async () => {
          if (stopped) return;
          let delay = 100;
          if (!pausedRef.current && drawAim(video, canvas)) {
            try {
              const code = (await detector.detect(canvas))[0]?.rawValue;
              const now = Date.now();
              if (code && !(code === last.code && now - last.at < 3000)) {
                last.code = code;
                last.at = now;
                onCodeRef.current(code);
                setHit(code);
                clearTimeout(hitTimer);
                hitTimer = window.setTimeout(() => setHit(null), 700);
                delay = 700; // temps de retirer l'étiquette, comme une douchette
              }
            } catch {
              // image pas encore prête
            }
          }
          timer = window.setTimeout(loop, delay);
        };
        loop();
      } catch (e) {
        const name = (e as { name?: string }).name;
        setError(name === "NotAllowedError" ? "denied" : name === "NotFoundError" ? "notFound" : "unavailable");
      }
    })();

    return () => {
      stopped = true;
      clearTimeout(timer);
      clearTimeout(hitTimer);
      document.removeEventListener("pointerdown", unlockSound);
      stream?.getTracks().forEach((tr) => tr.stop());
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
      {/* Viseur : assombrit le reste de l'image, laser rouge tant qu'aucun code n'est lu, cadre vert au moment de la lecture */}
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-x-[8%] top-1/2 h-[34%] -translate-y-1/2 overflow-hidden rounded-xl border-4 shadow-[0_0_0_9999px_rgba(19,19,39,0.55)] transition-colors ${hit ? "border-brand-green bg-brand-green/30" : "border-white"}`}
      >
        {ready && !hit && <div className="scan-laser absolute inset-x-2 h-0.5 bg-red-500 shadow-[0_0_8px_2px_rgba(239,68,68,0.8)]" />}
        {hit && <p className="absolute inset-0 flex items-center justify-center text-4xl font-black text-white drop-shadow">✓</p>}
      </div>
      <p role="status" className="absolute inset-x-0 bottom-2 text-center text-sm font-bold text-white drop-shadow">
        {hit ? <span dir="ltr">{hit}</span> : t.camera.aim}
      </p>
      {torch && (
        <button type="button" onClick={toggleTorch} aria-pressed={torchOn} className="absolute end-2 top-2 min-h-12 rounded-xl bg-white/90 px-3 font-bold text-brand-ink">
          {torchOn ? t.camera.torchOn : t.camera.torch}
        </button>
      )}
    </div>
  );
}
