export interface ParsedResponse {
  description: string;
  extractedText: string[];
}

export function parseResponse(rawText: string): ParsedResponse {
  const descMatch = rawText.match(
    /DESCRIPTION:\s*\n([\s\S]*?)(?=\nEXTRACTED_TEXT:|\s*$)/
  );
  const textMatch = rawText.match(/EXTRACTED_TEXT:\s*\n([\s\S]*?)$/);

  // Fallback: if format wasn't followed, use entire response as description
  if (!descMatch) {
    return {
      description: rawText.trim(),
      extractedText: [],
    };
  }

  const description = descMatch[1].trim();
  let extractedText: string[] = [];

  if (textMatch) {
    const textContent = textMatch[1].trim();
    if (textContent && textContent.toLowerCase() !== "none") {
      extractedText = textContent
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
    }
  }

  return { description, extractedText };
}
