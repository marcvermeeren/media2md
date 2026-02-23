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
  visualElements: string;
  references: string;
  useCase: string;
  colorHex: string;
  era: string;
  artifact: string;
  typography: string;
  script: string;
  culturalInfluence: string;
  description: string;
  searchPhrases: string;
  dimensions: string;
  extractedText: string;
}

const VALID_TYPES = new Set([
  "photo",
  "illustration",
  "painting",
  "sketch",
  "diagram",
  "chart",
  "screenshot",
  "render-3d",
  "collage",
  "pattern",
  "document",
  "whiteboard",
  "mockup",
  "other",
]);

/** All section headers the new format can contain, used for boundary detection. */
const ALL_SECTIONS = [
  "TYPE", "CATEGORY", "STYLE", "MOOD", "MEDIUM", "COMPOSITION",
  "PALETTE", "SUBJECT", "COLORS", "TAGS",
  "VISUAL_ELEMENTS", "REFERENCES", "USE_CASE", "COLOR_HEX",
  "ERA", "ARTIFACT", "TYPOGRAPHY", "SCRIPT", "CULTURAL_INFLUENCE",
  "DESCRIPTION", "SEARCH_PHRASES", "DIMENSIONS", "EXTRACTED_TEXT",
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

function extractMultiLine(rawText: string, key: string, boundary: string): string {
  const re = new RegExp(`${key}:\\s*\\n([\\s\\S]*?)(?=\\n(?:${boundary}):|\\s*$)`);
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

  // New single-line fields
  const visualElements = extractSingleLine(rawText, "VISUAL_ELEMENTS");
  let references = extractSingleLine(rawText, "REFERENCES");
  if (references.toLowerCase() === "none") references = "";
  const useCase = extractSingleLine(rawText, "USE_CASE");
  const colorHex = extractSingleLine(rawText, "COLOR_HEX");

  // New archival fields
  const era = extractSingleLine(rawText, "ERA");
  let artifact = extractSingleLine(rawText, "ARTIFACT");
  if (artifact.toLowerCase() === "none") artifact = "";
  let typography = extractSingleLine(rawText, "TYPOGRAPHY");
  if (typography.toLowerCase() === "none") typography = "";
  let script = extractSingleLine(rawText, "SCRIPT");
  if (script.toLowerCase() === "none") script = "";
  let culturalInfluence = extractSingleLine(rawText, "CULTURAL_INFLUENCE");
  if (culturalInfluence.toLowerCase() === "none") culturalInfluence = "";

  // Multi-line fields
  const description = extractMultiLine(rawText, "DESCRIPTION", SECTION_BOUNDARY);
  const searchPhrases = extractMultiLine(rawText, "SEARCH_PHRASES", SECTION_BOUNDARY);
  const dimensions = extractMultiLine(rawText, "DIMENSIONS", SECTION_BOUNDARY);

  // EXTRACTED_TEXT captures to EOF
  const textMatch = rawText.match(/EXTRACTED_TEXT:\s*\n([\s\S]*?)$/);
  let extractedText = "";

  if (textMatch) {
    const textContent = textMatch[1].trim();
    if (textContent && textContent.toLowerCase() !== "none") {
      extractedText = textContent;
    }
  }

  return {
    type, category, style, mood, medium, composition, palette,
    subject, colors, tags, visualElements, references, useCase, colorHex,
    era, artifact, typography, script, culturalInfluence,
    description, searchPhrases, dimensions, extractedText,
  };
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
    visualElements: "",
    references: "",
    useCase: "",
    colorHex: "",
    era: "",
    artifact: "",
    typography: "",
    script: "",
    culturalInfluence: "",
    description: rawText.trim(),
    searchPhrases: "",
    dimensions: "",
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
