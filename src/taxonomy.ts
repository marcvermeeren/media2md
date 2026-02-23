export const TYPES = [
  "photo", "illustration", "painting", "sketch", "diagram", "chart",
  "screenshot", "render-3d", "collage", "pattern", "document",
  "whiteboard", "mockup", "other",
] as const;

export const CATEGORIES = [
  "branding", "packaging-design", "typography", "ui-design",
  "web-design", "product-design", "interior-design", "architecture",
  "fashion", "illustration", "photography", "motion-design",
  "print-design", "signage", "data-visualization", "icon-design",
  "editorial", "advertising", "art",
  "furniture-design", "textile-design", "ceramics", "jewelry-design",
  "landscape-design", "film", "street-art", "calligraphy", "sculpture",
  "other",
] as const;

export const STYLES = [
  "minimalist", "maximalist", "brutalist", "organic", "geometric",
  "retro", "futuristic", "vintage", "art-deco", "swiss",
  "japanese", "scandinavian", "industrial", "handmade", "editorial",
  "corporate", "luxurious", "rustic", "experimental",
  "flat", "skeuomorphic", "glassmorphism", "neomorphism",
  "abstract", "figurative", "monochrome", "colorful", "muted",
  "mid-century", "art-nouveau", "gothic", "baroque", "psychedelic", "grunge",
  "memphis", "constructivist", "de-stijl", "bauhaus", "pop-art", "surrealist",
  "wabi-sabi", "tropical", "cottagecore", "cyberpunk",
] as const;

export const MOODS = [
  "calm", "energetic", "playful", "serious", "elegant",
  "raw", "warm", "cool", "nostalgic", "modern",
  "whimsical", "dramatic", "intimate", "grand",
  "tense", "light", "dark", "cheerful", "somber",
  "confident", "delicate", "bold", "subtle", "serene",
] as const;

export const MEDIUMS = [
  "photography", "product-photography", "illustration", "vector",
  "pixel-art", "3d-render", "collage", "mixed-media",
  "watercolor", "ink", "pencil", "digital-painting",
  "screen-capture", "technical-drawing", "infographic",
  "data-viz", "typographic-composition", "print-scan",
  "film-photography",
  "linocut", "lithograph", "screen-print", "etching", "letterpress", "risograph",
  "woodblock", "oil-painting", "gouache", "pastel", "charcoal", "acrylic",
] as const;

export const COMPOSITIONS = [
  "centered", "asymmetric", "grid", "layered", "diagonal",
  "radial", "full-bleed", "negative-space", "flat-lay",
  "isometric", "perspective", "split-screen", "modular",
  "stacked", "overlapping", "framed", "cropped", "panoramic",
  "rule-of-thirds", "symmetrical", "triptych", "diptych", "golden-ratio",
] as const;

// ── Tag seed vocabulary ──────────────────────────────────────────
// Canonical forms the LLM should prefer. Organized by domain so the
// prompt can reference them. The model may still invent tags outside
// this list as long as they follow the formation rules.

export const TAG_VOCABULARY = {
  materials: [
    "kraft-paper", "newsprint", "cardstock", "vellum", "linen", "cotton",
    "silk", "leather", "suede", "denim", "canvas", "plywood", "bamboo",
    "marble", "terrazzo", "concrete", "brushed-metal", "brass", "copper",
    "glass", "enamel", "resin", "cork",
  ],
  techniques: [
    "letterpress", "screen-print", "risograph", "foil-stamp", "emboss",
    "deboss", "die-cut", "laser-cut", "engraving", "etching", "linocut",
    "woodblock", "cyanotype", "overprint", "duotone", "halftone", "stipple",
    "crosshatch", "hand-drawn", "hand-painted", "blind-emboss", "spot-uv",
  ],
  finishes: [
    "matte-finish", "glossy-finish", "satin-finish", "soft-touch",
    "uncoated-stock", "spot-gloss", "textured-stock", "distressed",
    "weathered", "patina",
  ],
  effects: [
    "gradient", "drop-shadow", "noise-texture", "film-grain", "bokeh",
    "lens-flare", "double-exposure", "long-exposure", "motion-blur", "glitch",
  ],
  photography: [
    "natural-light", "studio-lighting", "golden-hour", "harsh-shadow",
    "soft-shadow", "shallow-depth-of-field", "macro", "aerial-view",
  ],
  production: [
    "saddle-stitch", "perfect-bind", "french-fold", "gatefold", "tip-in",
    "belly-band", "deckle-edge", "dust-jacket",
  ],
} as const;

/** Flat array of all canonical tag terms. */
export const TAGS = Object.values(TAG_VOCABULARY).flat();

export interface TaxonomyOverrides {
  types?: string[];
  categories?: string[];
  styles?: string[];
  moods?: string[];
  mediums?: string[];
  compositions?: string[];
  tags?: string[];
}

export interface Taxonomy {
  types: readonly string[];
  categories: readonly string[];
  styles: readonly string[];
  moods: readonly string[];
  mediums: readonly string[];
  compositions: readonly string[];
  tags: readonly string[];
}

/** Merge default vocabularies with user overrides (extends, not replaces). */
export function buildTaxonomy(overrides?: TaxonomyOverrides): Taxonomy {
  if (!overrides) {
    return { types: TYPES, categories: CATEGORIES, styles: STYLES, moods: MOODS, mediums: MEDIUMS, compositions: COMPOSITIONS, tags: TAGS };
  }

  return {
    types: dedupe([...TYPES, ...(overrides.types ?? [])]),
    categories: dedupe([...CATEGORIES, ...(overrides.categories ?? [])]),
    styles: dedupe([...STYLES, ...(overrides.styles ?? [])]),
    moods: dedupe([...MOODS, ...(overrides.moods ?? [])]),
    mediums: dedupe([...MEDIUMS, ...(overrides.mediums ?? [])]),
    compositions: dedupe([...COMPOSITIONS, ...(overrides.compositions ?? [])]),
    tags: dedupe([...TAGS, ...(overrides.tags ?? [])]),
  };
}

function dedupe(arr: string[]): string[] {
  return [...new Set(arr)];
}

// ── Post-parse validation ──────────────────────────────────────────

export interface ValidationResult {
  /** Corrected field values (strict fields replaced, others left as-is). */
  corrections: Record<string, string>;
  /** Human-readable warnings for non-conforming values. */
  warnings: string[];
}

/** Split a comma-separated field into trimmed tokens. */
function splitField(value: string): string[] {
  if (!value) return [];
  return value.split(",").map((s) => s.trim()).filter(Boolean);
}

/** Rejoin tokens into comma-separated string. */
function joinField(tokens: string[]): string {
  return tokens.join(", ");
}

/**
 * Validate a parsed response against the taxonomy.
 *
 * - **Strict fields** (`type`, `category`): unknown values are replaced with fallback.
 *   Generates a warning so callers can surface it if needed.
 * - **Suggested fields** (`style`, `mood`, `medium`, `composition`): silently accepted.
 *   The LLM is allowed to extend these vocabularies.
 * - **`palette`**: bare color names are silently accepted (can't auto-fix ambiguously).
 * - **`tags`**: spaces are silently replaced with hyphens.
 */
export function validateParsed(
  parsed: Record<string, string>,
  taxonomy: Taxonomy
): ValidationResult {
  const corrections: Record<string, string> = {};
  const warnings: string[] = [];

  // ── Strict: type ──
  if (parsed.type && !new Set(taxonomy.types).has(parsed.type)) {
    warnings.push(`type "${parsed.type}" not in vocabulary — defaulting to "other"`);
    corrections.type = "other";
  }

  // ── Strict: category ──
  if (parsed.category) {
    const catSet = new Set(taxonomy.categories);
    const tokens = splitField(parsed.category);
    const valid = tokens.filter((t) => catSet.has(t));
    const invalid = tokens.filter((t) => !catSet.has(t));
    if (invalid.length) {
      warnings.push(`category: unknown values removed: ${invalid.join(", ")}`);
      corrections.category = valid.length ? joinField(valid) : "other";
    }
  }

  // ── Suggested fields: style, mood, medium, composition ──
  // These vocabularies are extensible by design. The LLM is allowed to
  // add terms that aren't in the default list, so we silently accept them.

  // ── Palette: auto-fix bare color names by keeping as-is ──
  // We can't auto-correct "blue" → "navy-blue" (ambiguous), but the
  // value is still usable for retrieval. No warning needed.

  // ── Tags: silently fix spaces → hyphens ──
  if (parsed.tags) {
    const tokens = splitField(parsed.tags);
    const hasSpaces = tokens.some((t) => t.includes(" "));
    if (hasSpaces) {
      const fixed = tokens.map((t) => t.replace(/\s+/g, "-"));
      corrections.tags = joinField(fixed);
    }
  }

  return { corrections, warnings };
}
