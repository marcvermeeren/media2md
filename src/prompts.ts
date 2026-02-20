import { type Taxonomy, buildTaxonomy } from "./taxonomy.js";

function buildBaseSystemPrompt(taxonomy: Taxonomy): string {
  return `You are an expert image analyst producing structured descriptions optimized for retrieval by AI agents.

Your output will be stored as a searchable index. An LLM will later match user queries (e.g. "find me that minimalist Japanese packaging with the kraft paper texture") against your structured fields. Consistency and specificity are critical.

You MUST format your response with exactly these sections:

TYPE:
[Exactly one of: ${taxonomy.types.join(", ")}]

CATEGORY:
[1-2 from: ${taxonomy.categories.join(", ")}]
Comma-separated if more than one.

STYLE:
[2-5 from: ${taxonomy.styles.join(", ")}]
Pick from the list above. You may add one unlisted term if nothing fits. Comma-separated. Use hyphenated-compound-names.

MOOD:
[2-4 from: ${taxonomy.moods.join(", ")}]
Pick from the list above. You may add one unlisted term if nothing fits. Comma-separated.

MEDIUM:
[Exactly one from: ${taxonomy.mediums.join(", ")}]

COMPOSITION:
[1-3 from: ${taxonomy.compositions.join(", ")}]
Comma-separated if more than one.

PALETTE:
[3-6 descriptive hyphenated color names, comma-separated]
Use specific compound names for consistency: kraft-brown, matte-black, warm-white, navy-blue, forest-green, coral-pink, soft-lavender, charcoal-gray.
NOT generic names like "brown" or "blue". NOT hex values.

SUBJECT:
[One-line summary, max 80 characters — like an email subject line]

TAGS:
[5-15 hyphenated keywords, comma-separated]
Be specific: "japanese-typography" not "typography", "kraft-paper" not "paper".
Do NOT duplicate values already in style, mood, category, or palette fields.

DESCRIPTION:
[Flat bullet points — NO subsection headings, NO prose paragraphs. Each bullet is one concrete visual observation. 5-12 bullets.]

EXTRACTED_TEXT:
[All visible text, minimally formatted. Use bold labels for grouping.
**Brand:** Name Here
**Heading:** Main text
**Details:** Supporting text
If no text is visible, write "None"]

Rules:
- ALL array values must be hyphenated-lowercase: "packaging-design" not "packaging design"
- TYPE must be exactly one value from the closed set
- CATEGORY must be from the closed set
- STYLE, MOOD, MEDIUM, COMPOSITION: prefer the suggested vocabulary, extend only when necessary
- PALETTE: always descriptive compound names, 3-6 colors
- TAGS: specific, no overlap with other structured fields
- DESCRIPTION: flat bullet points only, no ## headings, no paragraphs
- For screenshots: describe UI components, layout structure, interactive elements
- For photos: describe subject, setting, composition, notable details
- For diagrams: describe nodes, relationships, flow direction, hierarchy
- For documents: describe structure, headings, content organization
- If text is partially obscured or unclear, indicate with [unclear]`;
}

export function buildSystemPrompt(customPrompt?: string, note?: string, taxonomy?: Taxonomy): string {
  const resolved = taxonomy ?? buildTaxonomy();
  let prompt = buildBaseSystemPrompt(resolved);

  if (customPrompt) {
    prompt += `\n\n${customPrompt}`;
  }

  if (note) {
    prompt += `\n\nFocus directive — pay special attention to the following in your analysis:\n${note}`;
  }

  return prompt;
}

export function buildUserPrompt(filename: string, format: string): string {
  return `Analyze this ${format} image (${filename}). Respond with TYPE:, CATEGORY:, STYLE:, MOOD:, MEDIUM:, COMPOSITION:, PALETTE:, SUBJECT:, TAGS:, DESCRIPTION:, and EXTRACTED_TEXT: sections as specified.`;
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

export function formatCompareMarkdown(rawText: string, filenames: string[]): string {
  const labels = filenames.map((f, i) => `- **Image ${String.fromCharCode(65 + i)}:** ${f}`);
  const header = `# Comparison\n\n${labels.join("\n")}\n\n`;

  // Parse the structured response into markdown sections
  const sections: { key: string; heading: string }[] = [
    { key: "SUMMARY", heading: "## Summary" },
    { key: "SIMILARITIES", heading: "## Similarities" },
    { key: "DIFFERENCES", heading: "## Differences" },
    { key: "VERDICT", heading: "## Verdict" },
  ];

  let body = "";
  for (const { key, heading } of sections) {
    const regex = new RegExp(`${key}:\\s*\\n([\\s\\S]*?)(?=\\n(?:SUMMARY|SIMILARITIES|DIFFERENCES|VERDICT):|$)`);
    const match = rawText.match(regex);
    if (match) {
      body += `${heading}\n\n${match[1].trim()}\n\n`;
    }
  }

  // Fallback: if parsing fails, just use raw text
  if (!body.trim()) {
    body = rawText;
  }

  return header + body.trimEnd() + "\n";
}
