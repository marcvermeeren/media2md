export const TYPES = [
  "screenshot", "photo", "diagram", "chart", "logo", "icon",
  "illustration", "document", "whiteboard", "render-3d",
  "collage", "pattern", "mockup", "other",
] as const;

export const CATEGORIES = [
  "branding", "packaging-design", "typography", "ui-design",
  "web-design", "product-design", "interior-design", "architecture",
  "fashion", "illustration", "photography", "motion-design",
  "print-design", "signage", "data-visualization", "icon-design",
  "editorial", "advertising", "art", "other",
] as const;

export const STYLES = [
  "minimalist", "maximalist", "brutalist", "organic", "geometric",
  "retro", "futuristic", "vintage", "art-deco", "swiss",
  "japanese", "scandinavian", "industrial", "handmade", "editorial",
  "playful", "corporate", "luxurious", "rustic", "experimental",
  "flat", "skeuomorphic", "glassmorphism", "neomorphism",
  "abstract", "figurative", "monochrome", "colorful", "muted", "bold",
] as const;

export const MOODS = [
  "calm", "energetic", "playful", "serious", "elegant",
  "raw", "warm", "cool", "nostalgic", "modern",
  "whimsical", "dramatic", "intimate", "grand", "minimal",
  "dense", "light", "dark", "cheerful", "somber",
  "confident", "delicate", "bold", "subtle",
] as const;

export const MEDIUMS = [
  "photography", "product-photography", "illustration", "vector",
  "pixel-art", "3d-render", "collage", "mixed-media",
  "watercolor", "ink", "pencil", "digital-painting",
  "screen-capture", "technical-drawing", "infographic",
  "data-viz", "typographic-composition", "print-scan",
  "film-photography",
] as const;

export const COMPOSITIONS = [
  "centered", "asymmetric", "grid", "layered", "diagonal",
  "radial", "full-bleed", "negative-space", "flat-lay",
  "isometric", "perspective", "split-screen", "modular",
  "stacked", "overlapping", "framed", "cropped", "panoramic",
] as const;

export interface TaxonomyOverrides {
  types?: string[];
  categories?: string[];
  styles?: string[];
  moods?: string[];
  mediums?: string[];
  compositions?: string[];
}

export interface Taxonomy {
  types: readonly string[];
  categories: readonly string[];
  styles: readonly string[];
  moods: readonly string[];
  mediums: readonly string[];
  compositions: readonly string[];
}

/** Merge default vocabularies with user overrides (extends, not replaces). */
export function buildTaxonomy(overrides?: TaxonomyOverrides): Taxonomy {
  if (!overrides) {
    return { types: TYPES, categories: CATEGORIES, styles: STYLES, moods: MOODS, mediums: MEDIUMS, compositions: COMPOSITIONS };
  }

  return {
    types: dedupe([...TYPES, ...(overrides.types ?? [])]),
    categories: dedupe([...CATEGORIES, ...(overrides.categories ?? [])]),
    styles: dedupe([...STYLES, ...(overrides.styles ?? [])]),
    moods: dedupe([...MOODS, ...(overrides.moods ?? [])]),
    mediums: dedupe([...MEDIUMS, ...(overrides.mediums ?? [])]),
    compositions: dedupe([...COMPOSITIONS, ...(overrides.compositions ?? [])]),
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
