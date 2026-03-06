export async function compressImage(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const maxSize = 1024;
      let { width, height } = img;

      if (width > maxSize || height > maxSize) {
        if (width > height) {
          height = Math.round((height * maxSize) / width);
          width = maxSize;
        } else {
          width = Math.round((width * maxSize) / height);
          height = maxSize;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, width, height);

      // Try JPEG at decreasing quality levels
      const qualities = [0.8, 0.7, 0.5, 0.3];
      const maxBytes = 200 * 1024;

      for (const quality of qualities) {
        const result = canvas.toDataURL("image/jpeg", quality);
        if (result.length < maxBytes || quality === qualities[qualities.length - 1]) {
          resolve(result);
          return;
        }
      }

      resolve(canvas.toDataURL("image/jpeg", 0.3));
    };
    img.onerror = () => resolve(dataUrl); // fallback to original on error
    img.src = dataUrl;
  });
}
