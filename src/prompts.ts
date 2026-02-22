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
[3-6 descriptive material-driven hyphenated color names, comma-separated]
Name every color by material, origin, or sensory association: kraft-brown, concrete-gray,
patina-green, terracotta-orange, slate-blue, parchment-cream, copper-gold, denim-blue,
moss-green, clay-pink, charcoal-smoke, honey-amber, bone-white, ink-black.
NEVER generic: not "pure-white" (use bone-white, chalk-white, porcelain-white),
not "deep-black" (use ink-black, obsidian-black, soot-black). NOT hex values.

SUBJECT:
[One-line summary, max 80 characters — specific enough to distinguish from similar images]
Use proper nouns and specific identification. "Aesop hand cream on travertine shelf" not "minimalist product photograph". Include brand names, place names, species names, technique names when identifiable.
When mentioning colors, attribute them to the correct object — do not swap color-object pairings.

TAGS:
[6-8 hyphenated keywords, comma-separated]
Each tag must add a genuinely new searchable term not already covered by style, mood,
category, palette, visual_elements, or references fields. Prioritize: material names
(kraft-paper, brushed-aluminum), technique names (letterpress, risograph), proper nouns
(helvetica, muji). Avoid generic adjectives.

VISUAL_ELEMENTS:
[5-15 literal visible objects/elements, comma-separated on a single line]
List only things physically visible: "glass bottle, kraft label, wax seal, wooden shelf, linen backdrop". Not interpretations or abstractions.

REFERENCES:
[3-5 design movements, named styles, or artist/designer references, comma-separated on a single line]
Be specific and generous — include art-historical context, named photographers, design studios,
cultural movements, festival aesthetics. "none" only for purely abstract or generic content.

USE_CASE:
[1-5 designer reference use cases, comma-separated on a single line]
How would a designer use this as reference? Examples: "packaging-layout-inspiration, color-palette-reference, typography-pairing-example, material-texture-reference, ui-pattern-example".

COLOR_HEX:
[3-5 dominant hex color values, comma-separated on a single line]
Sample the most prominent colors from the image. Format: #RRGGBB. Example: #2C1810, #F5E6D3, #8B4513

ERA:
[1-2 design periods or decades, comma-separated]
The era this image evokes or originates from. Examples: 1970s, mid-century, victorian,
art-nouveau, y2k, contemporary, 1920s-art-deco. Write "contemporary" if no historical reference.

ARTIFACT:
[1-2 artifact types, comma-separated]
What designed object is depicted? Examples: poster, business-card, book-cover, packaging-box,
label, bottle, website, mobile-app, billboard, editorial-spread, album-cover, tote-bag,
t-shirt, signage, menu, invitation, stamp, icon-set. Write "none" if not a designed artifact.

TYPOGRAPHY:
[1-5 typography characteristics, comma-separated]
Name typefaces when identifiable (helvetica, garamond, futura), classify (sans-serif, serif,
slab-serif, script, display, monospaced, hand-lettered, blackletter, stencil), and note technique
(letterpress, foil-stamped, engraved, embossed, screen-printed). Write "none" if no text visible.

SCRIPT:
[1-3 writing systems or languages, comma-separated]
Identify scripts visible in the image: latin, kanji, hiragana, katakana, hangul, cyrillic, arabic,
devanagari, thai, hebrew, greek. Add language when identifiable: english, japanese, korean, french,
german. Write "none" if no text visible.

CULTURAL_INFLUENCE:
[1-3 aesthetic lineages or cultural traditions, comma-separated]
Broader cultural threads, not specific designers: japanese-wabi-sabi, scandinavian-functionalism,
swiss-precision, mediterranean-warmth, korean-minimalism, mexican-folk-art, west-african-textile,
british-punk, american-modernism. Write "none" if not applicable.

DESCRIPTION:
[4 sentences, no bullet points]
Sentence 1: What is literally depicted (subject, objects, setting). Sentence 2: Visual style and aesthetic qualities. Sentence 3: Notable techniques, materials, or craft details. Sentence 4: Context — what kind of project this is from or what purpose it serves.

SEARCH_PHRASES:
[8-10 natural language search phrases a designer might use to find this image, one per line]
Each phrase must be meaningfully distinct — vary the angle (literal, conceptual, stylistic,
use-case). Do not write near-duplicates that differ by only one or two words.

DIMENSIONS:
[2-5 axes explaining why this image is reference-worthy, one per line, format "dimension-name: description"]
Each dimension must illuminate a genuinely distinct analytical lens — do not repeat the same
insight under different names (e.g. "color-as-medium" and "chromatic-range" overlap).
Examples:
craft-quality: Hand-applied gold foil with visible brushwork and imperfect edges
material-palette: Combines raw kraft, matte black, and uncoated stock
layout-system: Modular grid with consistent 16px spacing and clear hierarchy

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
- STYLE and MOOD must not share any terms — style is visual treatment, mood is emotional register
- PALETTE: always material-driven compound names, 3-6 colors
- TAGS: 6-8 genuinely distinct terms, no overlap with other structured fields; prioritize materials, techniques, proper nouns
- VISUAL_ELEMENTS: only literal visible objects, 5-15 items
- REFERENCES: 3-5 named movements/styles/designers, or "none" only for purely abstract content
- USE_CASE: hyphenated designer use cases
- COLOR_HEX: 3-5 hex values sampled from the image
- ERA: 1-2 design periods or decades
- ARTIFACT: 1-2 designed object types, or "none"
- TYPOGRAPHY: 1-5 typeface names, classifications, or techniques, or "none"
- SCRIPT: 1-3 writing systems or languages, or "none"
- CULTURAL_INFLUENCE: 1-3 aesthetic lineages, or "none"
- DESCRIPTION: exactly 4 dense sentences, no bullets, no headings
- SEARCH_PHRASES: 8-10 meaningfully distinct natural language phrases, one per line
- DIMENSIONS: 2-5 reference-worthiness axes, format "name: description"
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
  return `Analyze this ${format} image (${filename}). Respond with TYPE:, CATEGORY:, STYLE:, MOOD:, MEDIUM:, COMPOSITION:, PALETTE:, SUBJECT:, TAGS:, VISUAL_ELEMENTS:, REFERENCES:, USE_CASE:, COLOR_HEX:, ERA:, ARTIFACT:, TYPOGRAPHY:, SCRIPT:, CULTURAL_INFLUENCE:, DESCRIPTION:, SEARCH_PHRASES:, DIMENSIONS:, and EXTRACTED_TEXT: sections as specified.`;
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
