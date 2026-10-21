/**
 * Réduit une photo avant envoi (réseau mobile souvent faible à quai) : 2200 px max, JPEG.
 * La résolution reste suffisante pour lire les petits caractères de la CMR.
 */
export async function compressImage(file: File, maxSide = 2200, quality = 0.85): Promise<Blob> {
  let source: ImageBitmap | HTMLImageElement;
  try {
    source = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    source = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Photo illisible"));
      img.src = URL.createObjectURL(file);
    });
  }
  const w = source.width;
  const h = source.height;
  const scale = Math.min(1, maxSide / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  canvas.getContext("2d")!.drawImage(source, 0, 0, canvas.width, canvas.height);
  if ("close" in source) source.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  if (!blob) throw new Error("Compression impossible");
  return blob;
}
