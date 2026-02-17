import { BUILTIN_PERSONAS } from "./personas/builtins.js";

const BASE_SYSTEM_PROMPT = `You are an expert image analyst. Your task is to analyze images and provide:
1. A clear, detailed description of the image content
2. Any text visible in the image, extracted accurately

You MUST format your response exactly as follows:

DESCRIPTION:
[Your detailed description of the image here. Can be multiple paragraphs.]

EXTRACTED_TEXT:
[Any text visible in the image, preserving layout as much as possible. If no text is visible, write "None"]

Important guidelines:
- Be thorough but concise in descriptions
- For screenshots, describe the UI elements, layout, and content
- For photos, describe the subject, setting, and notable details
- For diagrams, describe the structure and relationships
- Extract ALL visible text, maintaining original formatting where possible
- If text is partially obscured or unclear, indicate this with [unclear] markers`;

export function buildSystemPrompt(persona?: string, customPrompt?: string): string {
  // Custom --prompt overrides everything
  if (customPrompt) {
    return `${BASE_SYSTEM_PROMPT}\n\n${customPrompt}`;
  }

  // Named persona
  if (persona && persona in BUILTIN_PERSONAS) {
    return `${BASE_SYSTEM_PROMPT}\n\n${BUILTIN_PERSONAS[persona].modifier}`;
  }

  // Freeform persona string (backwards compat)
  if (persona) {
    return `${BASE_SYSTEM_PROMPT}\n\nAdditional context: ${persona}`;
  }

  return BASE_SYSTEM_PROMPT;
}

export function buildUserPrompt(filename: string, format: string): string {
  return `Please analyze this ${format} image (${filename}) and provide a description and any extracted text, using the DESCRIPTION: and EXTRACTED_TEXT: format specified.`;
}
