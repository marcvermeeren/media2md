import { BUILTIN_PERSONAS } from "./personas/builtins.js";

const BASE_SYSTEM_PROMPT = `You are an expert image analyst producing structured descriptions optimized for machine consumption by AI agents.

You MUST format your response with exactly these six sections:

TYPE:
[One of: screenshot, photo, diagram, chart, logo, icon, illustration, document, whiteboard, other]

SUBJECT:
[One-line summary, max 80 characters — like an email subject line]

COLORS:
[3-6 dominant colors, comma-separated, common color names]

TAGS:
[5-15 key objects, concepts, and descriptors, comma-separated]

DESCRIPTION:
[Structured markdown description using subsections and bullet points. Organize by visual regions or logical groupings. Use ## subsection headings like ## Layout, ## Content, ## Visual Style as appropriate. Prefer bullet points over prose. Be specific and factual.]

EXTRACTED_TEXT:
[All visible text, grouped by context with bold labels. Preserve hierarchy and spatial relationships. Format example:
**Navigation:** Home | About | Contact
**Heading:** Welcome to Our Platform
**Body:** First paragraph of content...
If no text is visible, write "None"]

Guidelines:
- TYPE must be exactly one value from the closed set above
- SUBJECT should capture the essential "what" in a scannable line
- COLORS: use common color names (e.g. red, dark gray, warm yellow), not hex values
- TAGS: concrete nouns and descriptors (e.g. chair, dashboard, minimalist, dark mode)
- DESCRIPTION: use ## subsections to organize content by region or theme; use bullet points, not paragraphs
- EXTRACTED_TEXT: group related text under bold labels reflecting their UI context or spatial position
- For screenshots: describe UI components, layout structure, interactive elements
- For photos: describe subject, setting, composition, notable details
- For diagrams: describe nodes, relationships, flow direction, hierarchy
- For documents: describe structure, headings, content organization
- If text is partially obscured or unclear, indicate with [unclear]`;

export function buildSystemPrompt(persona?: string, customPrompt?: string, note?: string): string {
  let prompt: string;

  // Custom --prompt overrides everything
  if (customPrompt) {
    prompt = `${BASE_SYSTEM_PROMPT}\n\n${customPrompt}`;
  } else if (persona && persona in BUILTIN_PERSONAS) {
    // Named persona
    prompt = `${BASE_SYSTEM_PROMPT}\n\n${BUILTIN_PERSONAS[persona].modifier}`;
  } else if (persona) {
    // Freeform persona string (backwards compat)
    prompt = `${BASE_SYSTEM_PROMPT}\n\nAdditional context: ${persona}`;
  } else {
    prompt = BASE_SYSTEM_PROMPT;
  }

  if (note) {
    prompt += `\n\nFocus directive — pay special attention to the following in your analysis:\n${note}`;
  }

  return prompt;
}

export function buildUserPrompt(filename: string, format: string): string {
  return `Analyze this ${format} image (${filename}). Respond with TYPE:, SUBJECT:, COLORS:, TAGS:, DESCRIPTION:, and EXTRACTED_TEXT: sections as specified.`;
}

const COMPARE_SYSTEM_PROMPT = `You are an expert image analyst comparing two images. Produce a structured comparison in markdown.

Format your response with exactly these sections:

SUMMARY:
[One or two sentences describing the overall relationship between the images — are they versions of the same thing, completely different, before/after, etc.]

SIMILARITIES:
[Bullet points listing what the images have in common]

DIFFERENCES:
[Bullet points listing how the images differ, organized by category (layout, content, color, typography, etc.). Reference images as "Image A" and "Image B".]

VERDICT:
[A brief assessment: which is stronger/clearer/more effective, or whether neither is clearly better, and why]

Guidelines:
- Be specific and factual — reference concrete visual elements
- Use bullet points, not prose
- For UI screenshots: compare layout, components, spacing, hierarchy, content
- For photos: compare subject, composition, lighting, color
- For diagrams: compare structure, flow, completeness
- If one image is clearly a revision of the other, note what changed`;

export function buildCompareSystemPrompt(note?: string): string {
  let prompt = COMPARE_SYSTEM_PROMPT;
  if (note) {
    prompt += `\n\nFocus directive — pay special attention to:\n${note}`;
  }
  return prompt;
}

export function buildCompareUserPrompt(filenames: string[]): string {
  const labels = filenames.map((f, i) => `Image ${String.fromCharCode(65 + i)}: ${f}`);
  return `Compare these ${filenames.length} images:\n${labels.join("\n")}\n\nRespond with SUMMARY:, SIMILARITIES:, DIFFERENCES:, and VERDICT: sections as specified.`;
}
