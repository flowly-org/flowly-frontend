/** Downscale to at most 2000 px on the long side, as JPEG: phone photos are large and the model doesn't need more. */
export async function shrinkPhoto(file: File, max = 2000): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not read the photo.'))), 'image/jpeg', 0.85),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
