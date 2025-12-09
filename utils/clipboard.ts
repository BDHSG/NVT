import { ProcessedPage } from "../types";

export const copyToClipboard = async (pages: ProcessedPage[]) => {
  try {
    // 1. Construct Plain Text
    const plainText = pages.map(p => p.markdown).join('\n\n');

    // 2. Construct HTML
    // We parse markdown lines. If we see ![...](data:...), convert to <img src="...">
    let htmlContent = "";

    for (const page of pages) {
      const lines = page.markdown.split('\n');
      for (const line of lines) {
        const imageMatch = line.match(/!\[.*?\]\((data:image\/.*?;base64,(.*?))\)/);
        
        if (imageMatch && imageMatch[1]) {
           // imageMatch[1] is the full data url
           htmlContent += `<p align="center"><img src="${imageMatch[1]}" style="max-width: 400px;" /></p>`;
        } else {
          // Escape HTML entities for the text content
          const safeText = line
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
          
          if (safeText.trim()) {
            htmlContent += `<p style="font-family: 'Times New Roman', serif; font-size: 12pt; margin-bottom: 8px;">${safeText}</p>`;
          }
        }
      }
      htmlContent += "<br/><hr/><br/>";
    }

    // Wrap in full HTML structure
    const fullHtml = `
      <!DOCTYPE html>
      <html>
      <body>
        ${htmlContent}
      </body>
      </html>
    `;

    // 3. Write to Clipboard
    const blobText = new Blob([plainText], { type: 'text/plain' });
    const blobHtml = new Blob([fullHtml], { type: 'text/html' });

    await navigator.clipboard.write([
      new ClipboardItem({
        'text/plain': blobText,
        'text/html': blobHtml
      })
    ]);
    
    alert("Copied to clipboard! Paste into Word and use MathType > Toggle TeX.");
  } catch (err) {
    console.error("Clipboard write failed", err);
    alert("Failed to copy to clipboard. Permission denied or browser not supported.");
  }
};