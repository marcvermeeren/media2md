export interface ParsedResponse {
  type: string;
  category: string;
  style: string;
  mood: string;
  medium: string;
  composition: string;
  palette: string;
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
  "render-3d",
  "collage",
  "pattern",
  "mockup",
  "other",
]);

/** All section headers the new format can contain, used for boundary detection. */
const ALL_SECTIONS = [
  "TYPE", "CATEGORY", "STYLE", "MOOD", "MEDIUM", "COMPOSITION",
  "PALETTE", "SUBJECT", "COLORS", "TAGS", "DESCRIPTION", "EXTRACTED_TEXT",
];

const SECTION_BOUNDARY = ALL_SECTIONS.join("|");

export function parseResponse(rawText: string): ParsedResponse {
  // Try new format (requires at least TYPE + SUBJECT)
  const typeMatch = rawText.match(/^TYPE:\s*(.+)/m);
  const subjectMatch = rawText.match(/^SUBJECT:\s*(.+)/m);

  if (typeMatch && subjectMatch) {
    return parseStructured(rawText, typeMatch, subjectMatch);
  }

  // Legacy two-section format fallback
  return parseLegacy(rawText);
}

function extractSingleLine(rawText: string, key: string): string {
  const re = new RegExp(`^${key}:\\s*(.+)`, "m");
  const m = rawText.match(re);
  return m ? m[1].trim() : "";
}

function parseStructured(
  rawText: string,
  typeMatch: RegExpMatchArray,
  subjectMatch: RegExpMatchArray
): ParsedResponse {
  const rawType = typeMatch[1].trim().toLowerCase();
  const type = VALID_TYPES.has(rawType) ? rawType : "other";
  const subject = subjectMatch[1].trim().slice(0, 80);

  const category = extractSingleLine(rawText, "CATEGORY");
  const style = extractSingleLine(rawText, "STYLE");
  const mood = extractSingleLine(rawText, "MOOD");
  const medium = extractSingleLine(rawText, "MEDIUM");
  const composition = extractSingleLine(rawText, "COMPOSITION");

  // PALETTE is the new name; fall back to COLORS for backward compat
  const palette = extractSingleLine(rawText, "PALETTE");
  const colors = palette || extractSingleLine(rawText, "COLORS");

  const tags = extractSingleLine(rawText, "TAGS");

  const descBoundary = `\\n(?:${SECTION_BOUNDARY}):`;
  const descMatch = rawText.match(
    new RegExp(`DESCRIPTION:\\s*\\n([\\s\\S]*?)(?=${descBoundary}|\\s*$)`)
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

  return { type, category, style, mood, medium, composition, palette, subject, colors, tags, description, extractedText };
}

function parseLegacy(rawText: string): ParsedResponse {
  const descMatch = rawText.match(
    /DESCRIPTION:\s*\n([\s\S]*?)(?=\nEXTRACTED_TEXT:|\s*$)/
  );
  const textMatch = rawText.match(/EXTRACTED_TEXT:\s*\n([\s\S]*?)$/);

  const empty: ParsedResponse = {
    type: "other",
    category: "",
    style: "",
    mood: "",
    medium: "",
    composition: "",
    palette: "",
    subject: "",
    colors: "",
    tags: "",
    description: rawText.trim(),
    extractedText: "",
  };

  // Fallback: if format wasn't followed, use entire response as description
  if (!descMatch) {
    return empty;
  }

  const description = descMatch[1].trim();
  let extractedText = "";

  if (textMatch) {
    const textContent = textMatch[1].trim();
    if (textContent && textContent.toLowerCase() !== "none") {
      extractedText = textContent;
    }
  }

  return { ...empty, description, extractedText };
}
