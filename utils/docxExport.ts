import { Document, Packer, Paragraph, TextRun, ImageRun } from "docx";
import { ProcessedPage } from "../types";

// Helper to get image dimensions asynchronously
const getImageDimensions = (base64: string): Promise<{width: number, height: number}> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.width, height: img.height });
    };
    img.onerror = () => resolve({ width: 400, height: 300 }); // fallback default
    img.src = `data:image/jpeg;base64,${base64}`;
  });
};

export const generateDocx = async (pages: ProcessedPage[]): Promise<Blob> => {
  const children: (Paragraph)[] = [];

  for (const page of pages) {
    const lines = page.markdown.split('\n');
    
    for (const line of lines) {
      if (line.trim() === '') {
        children.push(new Paragraph({ text: "" }));
        continue;
      }

      // Check for markdown image: ![alt](data:image/jpeg;base64,...)
      const imageMatch = line.match(/!\[.*?\]\((data:image\/.*?;base64,(.*?))\)/);

      if (imageMatch && imageMatch[2]) {
        try {
          const base64Data = imageMatch[2];
          
          // Get actual dimensions to preserve aspect ratio
          const dims = await getImageDimensions(base64Data);
          
          // Max width for standard Word document (approx 600px / 6.25 inches)
          const MAX_WIDTH = 600;
          let finalWidth = dims.width;
          let finalHeight = dims.height;

          // Scale down if too large, maintain aspect ratio
          if (finalWidth > MAX_WIDTH) {
            const ratio = MAX_WIDTH / finalWidth;
            finalWidth = MAX_WIDTH;
            finalHeight = finalHeight * ratio;
          }

          const imageBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
          
          children.push(new Paragraph({
            children: [
              new ImageRun({
                data: imageBuffer,
                transformation: {
                  width: finalWidth,
                  height: finalHeight
                }
              })
            ]
          }));
        } catch (e) {
           console.error("Error inserting image into docx", e);
           children.push(new Paragraph({ text: "[Image Error]" }));
        }
      } else {
        // Standard text paragraph
        children.push(new Paragraph({
          children: [
            new TextRun({
              text: line,
              font: "Times New Roman",
              size: 24 // 12pt (docx uses half-points)
            })
          ]
        }));
      }
    }
    
    // Page break after each processed page
    children.push(new Paragraph({ pageBreakBefore: true }));
  }

  const doc = new Document({
    sections: [{
      properties: {},
      children: children,
    }],
  });

  return await Packer.toBlob(doc);
};