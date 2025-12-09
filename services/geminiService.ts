import { GoogleGenAI, Type } from "@google/genai";
import { cropImageFromBase64 } from "./fileProcessing";

// Schema definition for the model output
const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    parts: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          type: { type: Type.STRING, enum: ["text", "figure"] },
          content: { type: Type.STRING, description: "Markdown text content if type is text" },
          box_2d: { 
            type: Type.ARRAY,
            items: { type: Type.INTEGER },
            description: "Bounding box [ymin, xmin, ymax, xmax] (0-1000 scale) if type is figure"
          }
        },
        required: ["type"]
      }
    }
  }
};

const SYSTEM_INSTRUCTION = `
You are an expert LaTeX OCR engine specializing in Math and Geometry.
Your goal is to reconstruct the document content into clean, compile-ready LaTeX Markdown.

OUTPUT FORMAT:
Return a JSON object with a "parts" array containing a sequence of text and figures.
- "text": content extracted as Markdown.
- "figure": bounding box [ymin, xmin, ymax, xmax] (0-1000) for charts/diagrams.

*** CRITICAL RULES FOR MATHEMATICS (LATEX) ***
1.  **Delimiter Syntax (STRICT)**:
    -   **Inline math**: MUST use single dollar signs $ ... $ (e.g., $ y = x^2 $). NEVER use \\( ... \\).
    -   **Display math**: MUST use double dollar signs $$ ... $$ (e.g., $$ \\int_0^1 x dx $$). NEVER use \\[ ... \\].

2.  **Geometry & Symbol Normalization**:
    -   **Triangles**: NEVER use Unicode 'Δ'. ALWAYS use \\Delta.
    -   **Angles**: 
        -   For 3-letter angles (e.g. ABC), ALWAYS use \\widehat{ABC}. DO NOT USE \\angle ABC.
        -   For single letter angles (e.g. A), use \\hat{A}.
    -   **Degrees**: NEVER use Unicode '°'. ALWAYS use ^\\circ.
    -   **Standardize**: Use \\perp, \\parallel, \\cdot, \\times correctly.

3.  **Fixing Malformed Expressions**:
    -   Convert "x2" to $x^2$.
    -   Fix broken environments like \\begin{cases}.
    -   Ensure geometry notation is strictly LaTeX (no Unicode symbols).

*** STRICT RULES FOR FIGURES ***
1.  **Detection**: Identify all charts, graphs, diagrams, geometric drawings, and circuits.
2.  **Bounding Box Accuracy**: 
    -   The bounding box must include the **ENTIRE** figure.
    -   It **MUST include** all associated labels, axes, numbers, legends, and captions immediately attached to the drawing.
    -   Do NOT crop out the labels ($x$, $y$, $A$, $B$, etc.) that are part of the geometry figure.
3.  **Separation**:
    -   Do NOT transcribe the text *inside* the figure into the "text" block. The figure should be captured purely as an image.
    -   If a page is mostly a diagram, return one large "figure" block.
`;

export const transcribeImage = async (base64Image: string, mimeType: string): Promise<string> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key is missing. Please set the API_KEY environment variable.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Image
            }
          },
          {
            text: "Extract content to JSON. Be precise with LaTeX math ($...$ and $$...$$) and Figure bounding boxes."
          }
        ]
      },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.1,
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA
      }
    });

    let jsonText = response.text || "{}";
    // Clean potential markdown code fences
    jsonText = jsonText.replace(/^```json\s*/, "").replace(/\s*```$/, "");

    let data;
    try {
      data = JSON.parse(jsonText);
    } catch (e) {
      console.error("Failed to parse Gemini JSON:", jsonText);
      return jsonText; // Fallback
    }

    if (!data.parts || !Array.isArray(data.parts)) {
      return "";
    }

    // Reconstruct Markdown with embedded cropped images
    let finalMarkdown = "";

    for (const part of data.parts) {
      if (part.type === 'text' && part.content) {
        let textContent = part.content;
        
        // --- POST-PROCESSING FORCE FIX ---
        // 1. Ensure all math uses $ and $$ delimiters
        textContent = textContent.replace(/\\\(([\s\S]*?)\\\)/g, '$$$1$$');
        textContent = textContent.replace(/\\\[([\s\S]*?)\\\]/g, '$$$$$1$$$$');

        // 2. Fix Angle Symbols (Force \widehat for 3 letters)
        // Convert \angle ABC or \angle {ABC} to \widehat{ABC}
        textContent = textContent.replace(/\\angle\s*\{?([A-Z]{3})\}?/g, '\\widehat{$1}');
        // Convert \angle A to \hat{A} (if not followed by other letters)
        textContent = textContent.replace(/\\angle\s*\{?([A-Z])\}?(?![A-Z])/g, '\\hat{$1}');
        
        finalMarkdown += textContent + "\n\n";
      } else if (part.type === 'figure' && part.box_2d) {
        try {
          // Crop the image with high precision
          const croppedBase64 = await cropImageFromBase64(base64Image, part.box_2d);
          if (croppedBase64) {
            // Insert standard Markdown image syntax
            finalMarkdown += `![Figure](data:image/jpeg;base64,${croppedBase64})\n\n`;
          }
        } catch (cropErr) {
          console.warn("Failed to crop figure:", cropErr);
        }
      }
    }

    return finalMarkdown;

  } catch (error: any) {
    console.error("Gemini API Error:", error);
    throw new Error(`Failed to process image: ${error.message}`);
  }
};
