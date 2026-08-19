/**
 * Image processing utilities.
 */

/**
 * Resize an image file to fit within maxDim while maintaining aspect ratio.
 * Returns a Promise that resolves with the resized data URL and dimensions.
 */
export function resizeImage(file, maxDim = 1024) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.onload = () => {
      const base64 = (reader.result || "").split(",").pop() || "";
      const img = new Image();
      img.onerror = () => reject(new Error("Failed to load image"));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const scale = maxDim / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        resolve({
          dataUrl: canvas.toDataURL("image/jpeg", 0.85),
          name: file.name,
          width,
          height,
        });
      };
      img.src = "data:" + file.type + ";base64," + base64;
    };
    reader.readAsDataURL(file);
  });
}
