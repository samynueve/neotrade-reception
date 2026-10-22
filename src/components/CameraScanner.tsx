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

/** Partie de l'image caméra visible dans l'aperçu (recadrée pour le remplir, comme object-cover). */
function visibleArea(video: HTMLVideoElement, view: HTMLElement) {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh || !view.clientWidth) return null;
  const scale = Math.max(view.clientWidth / vw, view.clientHeight / vh);
  const w = view.clientWidth / scale;
  const h = view.clientHeight / scale;
  return { vw, vh, w, h };
}

/** Image caméra → aperçu. Un canvas et non la vidéo : sur iPhone, toucher une vidéo ouvre le lecteur plein écran de Safari. */
function drawPreview(video: HTMLVideoElement, preview: HTMLCanvasElement) {
  const area = visibleArea(video, preview);
  if (!area) return;
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.round(preview.clientWidth * ratio);
  const height = Math.round(preview.clientHeight * ratio);
  if (preview.width !== width || preview.height !== height) {
    preview.width = width;
    preview.height = height;
  }
  preview.getContext("2d")!.drawImage(video, (area.vw - area.w) / 2, (area.vh - area.h) / 2, area.w, area.h, 0, 0, width, height);
}

/** Copie dans le canvas la partie de l'image caméra visible dans le viseur. */
function drawAim(video: HTMLVideoElement, view: HTMLElement, canvas: HTMLCanvasElement): boolean {
  const area = visibleArea(video, view);
  if (!area) return false;
  const { vw, vh } = area;
  const sw = area.w * AIM_W;
  const sh = area.h * AIM_H;
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
  const previewRef = useRef<HTMLCanvasElement>(null);
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
    let frame = 0;
    let hitTimer = 0;
    let stream: MediaStream | null = null;
    const last = { code: "", at: 0 };
    const canvas = document.createElement("canvas");
    const resume = () => {
      const video = videoRef.current;
      if (!stopped && video && video.paused && document.visibilityState === "visible") video.play().catch(() => {});
    };

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
        // iPhone : l'image se fige quand Safari met la vidéo en pause (sortie du plein écran, retour dans l'app)
        video.addEventListener("pause", resume);
        document.addEventListener("visibilitychange", resume);

        const track = stream.getVideoTracks()[0];
        const caps = (track.getCapabilities?.() ?? {}) as { torch?: boolean; zoom?: { min: number; max: number }; focusMode?: string[] };
        const advanced: Record<string, unknown>[] = [];
        if (caps.focusMode?.includes("continuous")) advanced.push({ focusMode: "continuous" });
        // Zoom ×2 : sur iPhone, l'objectif principal ne fait pas la mise au point de près ; on scanne de plus loin
        if (caps.zoom && caps.zoom.max >= 2) advanced.push({ zoom: Math.max(caps.zoom.min, 2) });
        if (advanced.length) await track.applyConstraints({ advanced: advanced as MediaTrackConstraintSet[] }).catch(() => {});
        if (caps.torch) setTorch(track);
        setReady(true);

        const preview = previewRef.current!;
        const paint = () => {
          if (stopped) return;
          drawPreview(video, preview);
          frame = requestAnimationFrame(paint);
        };
        paint();

        const loop = async () => {
          if (stopped) return;
          let delay = 100;
          if (!pausedRef.current && drawAim(video, preview, canvas)) {
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
      cancelAnimationFrame(frame);
      clearTimeout(hitTimer);
      document.removeEventListener("pointerdown", unlockSound);
      document.removeEventListener("visibilitychange", resume);
      videoRef.current?.removeEventListener("pause", resume);
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
      {/* La vidéo (source des images) est entièrement recouverte par l'aperçu en canvas : on ne peut plus la toucher,
          donc Safari ne peut plus l'ouvrir en plein écran. Elle reste à sa taille pour que l'iPhone continue de la décoder. */}
      <video ref={videoRef} playsInline muted autoPlay disablePictureInPicture controls={false} aria-hidden className="pointer-events-none absolute inset-0 h-full w-full object-cover" />
      <canvas ref={previewRef} aria-hidden className="relative block aspect-[4/3] w-full touch-none select-none" />
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
