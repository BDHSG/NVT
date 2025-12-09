// Helper to convert Blob to Base64
export const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // Remove data url prefix (e.g. "data:image/png;base64,")
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

// Helper to render PDF pages to Images using PDF.js
export const convertPdfToImages = async (file: File): Promise<string[]> => {
  const arrayBuffer = await file.arrayBuffer();
  // @ts-ignore - pdfjsLib is loaded via CDN in index.html
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const images: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2.0 }); // High scale for better OCR
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    if (context) {
      await page.render({ canvasContext: context, viewport: viewport }).promise;
      // Convert to JPEG with high quality
      const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
      // Strip prefix for API usage
      images.push(dataUrl.split(',')[1]); 
    }
  }

  return images; // Array of base64 strings
};

export const getPreviewUrl = (file: File): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.readAsDataURL(file);
  });
};

/**
 * Crops an image based on normalized coordinates [ymin, xmin, ymax, xmax] (0-1000 scale).
 * @param originalBase64 The source image in base64.
 * @param box The bounding box [ymin, xmin, ymax, xmax].
 * @returns Promise resolving to the cropped image base64 string.
 */
export const cropImageFromBase64 = (originalBase64: string, box: number[]): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const [ymin, xmin, ymax, xmax] = box;
      
      const realWidth = img.width;
      const realHeight = img.height;

      // Convert 0-1000 scale to pixels
      const y1 = (ymin / 1000) * realHeight;
      const x1 = (xmin / 1000) * realWidth;
      const y2 = (ymax / 1000) * realHeight;
      const x2 = (xmax / 1000) * realWidth;

      const width = x2 - x1;
      const height = y2 - y1;

      if (width <= 0 || height <= 0) {
        // Fallback if box is invalid
        resolve(""); 
        return;
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error("Could not get canvas context"));
        return;
      }

      // Draw the specific slice
      ctx.drawImage(img, x1, y1, width, height, 0, 0, width, height);
      
      // High quality export
      const croppedDataUrl = canvas.toDataURL('image/jpeg', 1.0);
      resolve(croppedDataUrl.split(',')[1]); // Return clean base64
    };
    img.onerror = (e) => reject(e);
    img.src = `data:image/jpeg;base64,${originalBase64}`;
  });
};