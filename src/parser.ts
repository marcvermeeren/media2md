export interface ParsedResponse {
  type: string;
  subject: string;
  colors: string;
  tags: string;
  description: string;
  extractedText: string;
}

const VALID_TYPES = new Set([
  "screenshot",
  "photo",
  "diagram",
  "chart",
  "logo",
  "icon",
  "illustration",
  "document",
  "whiteboard",
  "other",
]);

export function parseResponse(rawText: string): ParsedResponse {
  // Try new four-section format first
  const typeMatch = rawText.match(/^TYPE:\s*(.+)/m);
  const subjectMatch = rawText.match(/^SUBJECT:\s*(.+)/m);

  if (typeMatch && subjectMatch) {
    return parseFourSection(rawText, typeMatch, subjectMatch);
  }

  // Legacy two-section format fallback
  return parseLegacy(rawText);
}

function parseFourSection(
  rawText: string,
  typeMatch: RegExpMatchArray,
  subjectMatch: RegExpMatchArray
): ParsedResponse {
  const rawType = typeMatch[1].trim().toLowerCase();
  const type = VALID_TYPES.has(rawType) ? rawType : "other";
  const subject = subjectMatch[1].trim().slice(0, 80);

  const colorsMatch = rawText.match(/^COLORS:\s*(.+)/m);
  const colors = colorsMatch ? colorsMatch[1].trim() : "";

  const tagsMatch = rawText.match(/^TAGS:\s*(.+)/m);
  const tags = tagsMatch ? tagsMatch[1].trim() : "";

  const descMatch = rawText.match(
    /DESCRIPTION:\s*\n([\s\S]*?)(?=\nEXTRACTED_TEXT:|\s*$)/
  );
  const textMatch = rawText.match(/EXTRACTED_TEXT:\s*\n([\s\S]*?)$/);

  const description = descMatch ? descMatch[1].trim() : "";
  let extractedText = "";

  if (textMatch) {
    const textContent = textMatch[1].trim();
    if (textContent && textContent.toLowerCase() !== "none") {
      extractedText = textContent;
    }
  }

  return { type, subject, colors, tags, description, extractedText };
}

function parseLegacy(rawText: string): ParsedResponse {
  const descMatch = rawText.match(
    /DESCRIPTION:\s*\n([\s\S]*?)(?=\nEXTRACTED_TEXT:|\s*$)/
  );
  const textMatch = rawText.match(/EXTRACTED_TEXT:\s*\n([\s\S]*?)$/);

  // Fallback: if format wasn't followed, use entire response as description
  if (!descMatch) {
    return {
      type: "other",
      subject: "",
      colors: "",
      tags: "",
      description: rawText.trim(),
      extractedText: "",
    };
  }

  const description = descMatch[1].trim();
  let extractedText = "";

  if (textMatch) {
    const textContent = textMatch[1].trim();
    if (textContent && textContent.toLowerCase() !== "none") {
      // Legacy format: lines become a flat string preserving newlines
      extractedText = textContent;
    }
  }

  return { type: "other", subject: "", colors: "", tags: "", description, extractedText };
}
