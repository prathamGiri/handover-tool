/** Client-side photo shrinking so uploads are quick on mobile data. */

export type PreparedPhoto = {
  key: string;
  blob: Blob;
  previewUrl: string;
  width: number;
  height: number;
};

const MAX_SIDE = 1600;
const QUALITY = 0.82;

export async function preparePhoto(file: File): Promise<PreparedPhoto> {
  // createImageBitmap applies EXIF rotation, so portrait phone photos stay upright.
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't process photo"))), "image/jpeg", QUALITY),
  );
  return { key: crypto.randomUUID(), blob, previewUrl: URL.createObjectURL(blob), width, height };
}
