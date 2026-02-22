import { describe, it, expect } from "vitest";
import {
  TYPES, CATEGORIES, STYLES, MOODS, MEDIUMS, COMPOSITIONS,
  TAGS, TAG_VOCABULARY,
  buildTaxonomy, validateParsed,
} from "../src/taxonomy.js";

describe("taxonomy vocabulary", () => {
  it("STYLES includes new entries", () => {
    const styles = [...STYLES];
    for (const s of ["mid-century", "art-nouveau", "gothic", "baroque", "psychedelic", "grunge",
      "memphis", "constructivist", "de-stijl", "bauhaus", "pop-art", "surrealist",
      "wabi-sabi", "tropical", "cottagecore", "cyberpunk"]) {
      expect(styles).toContain(s);
    }
  });

  it("MEDIUMS includes new entries", () => {
    const mediums = [...MEDIUMS];
    for (const m of ["linocut", "lithograph", "screen-print", "etching", "letterpress", "risograph",
      "woodblock", "oil-painting", "gouache", "pastel", "charcoal", "acrylic"]) {
      expect(mediums).toContain(m);
    }
  });

  it("COMPOSITIONS includes new entries", () => {
    const compositions = [...COMPOSITIONS];
    for (const c of ["rule-of-thirds", "symmetrical", "triptych", "diptych", "golden-ratio"]) {
      expect(compositions).toContain(c);
    }
  });

  it("STYLES does not contain mood-only terms (bold, playful)", () => {
    const styles = [...STYLES];
    expect(styles).not.toContain("playful");
    expect(styles).not.toContain("bold");
  });

  it("MOODS does not contain style/density terms (minimal, dense)", () => {
    const moods = [...MOODS];
    expect(moods).not.toContain("minimal");
    expect(moods).not.toContain("dense");
  });

  it("MOODS includes replacement terms (tense, serene)", () => {
    const moods = [...MOODS];
    expect(moods).toContain("tense");
    expect(moods).toContain("serene");
  });

  it("no overlap between STYLES and MOODS", () => {
    const styleSet = new Set<string>(STYLES);
    const moodSet = new Set<string>(MOODS);
    const overlap = [...styleSet].filter((s) => moodSet.has(s));
    expect(overlap).toEqual([]);
  });

  it("CATEGORIES includes new creative disciplines", () => {
    const cats = [...CATEGORIES];
    for (const c of ["furniture-design", "textile-design", "ceramics", "jewelry-design",
      "landscape-design", "film", "street-art", "calligraphy", "sculpture"]) {
      expect(cats).toContain(c);
    }
  });

  it("TAG_VOCABULARY has all 6 groups", () => {
    expect(Object.keys(TAG_VOCABULARY).sort()).toEqual([
      "effects", "finishes", "materials", "photography", "production", "techniques",
    ]);
  });

  it("TAGS flat array contains terms from all groups", () => {
    expect(TAGS).toContain("kraft-paper");
    expect(TAGS).toContain("screen-print");
    expect(TAGS).toContain("matte-finish");
    expect(TAGS).toContain("gradient");
    expect(TAGS).toContain("golden-hour");
    expect(TAGS).toContain("saddle-stitch");
  });

  it("TAGS has no duplicates", () => {
    expect(new Set(TAGS).size).toBe(TAGS.length);
  });

  it("all TAGS follow hyphenation convention", () => {
    for (const tag of TAGS) {
      expect(tag).not.toMatch(/\s/);
      expect(tag).toBe(tag.toLowerCase());
    }
  });

  it("buildTaxonomy includes tags and supports overrides", () => {
    const t = buildTaxonomy();
    expect(t.tags).toContain("kraft-paper");

    const extended = buildTaxonomy({ tags: ["custom-tag"] });
    expect(extended.tags).toContain("kraft-paper");
    expect(extended.tags).toContain("custom-tag");
  });
});

describe("buildTaxonomy", () => {
  it("returns defaults when no overrides", () => {
    const t = buildTaxonomy();
    expect(t.types).toEqual(TYPES);
    expect(t.categories).toEqual(CATEGORIES);
    expect(t.styles).toEqual(STYLES);
  });

  it("extends with user overrides without duplicates", () => {
    const t = buildTaxonomy({
      categories: ["sneaker-design", "branding"], // branding already exists
      styles: ["wabi-sabi"],
    });
    expect(t.categories).toContain("sneaker-design");
    expect(t.categories).toContain("branding");
    // No duplicate
    expect(t.categories.filter((c) => c === "branding")).toHaveLength(1);
    expect(t.styles).toContain("wabi-sabi");
    // Defaults still present
    expect(t.styles).toContain("minimalist");
  });
});

describe("validateParsed", () => {
  const taxonomy = buildTaxonomy();

  const goodParsed: Record<string, string> = {
    type: "photo",
    category: "packaging-design",
    style: "minimalist, japanese",
    mood: "calm, elegant",
    medium: "product-photography",
    composition: "centered, negative-space",
    palette: "kraft-brown, matte-black, off-white",
    subject: "Japanese tea packaging",
    tags: "tea-packaging, kraft-paper, wax-seal",
    colors: "kraft-brown, matte-black, off-white",
    description: "- A package on a table",
    extractedText: "",
  };

  it("returns no corrections or warnings for valid input", () => {
    const { corrections, warnings } = validateParsed(goodParsed, taxonomy);
    expect(corrections).toEqual({});
    expect(warnings).toHaveLength(0);
  });

  // ── Strict: type ──

  it("corrects invalid type to 'other'", () => {
    const { corrections, warnings } = validateParsed(
      { ...goodParsed, type: "meme" },
      taxonomy
    );
    expect(corrections.type).toBe("other");
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("meme");
  });

  it("passes valid type through", () => {
    const { corrections } = validateParsed(
      { ...goodParsed, type: "render-3d" },
      taxonomy
    );
    expect(corrections.type).toBeUndefined();
  });

  // ── Strict: category ──

  it("removes unknown category values", () => {
    const { corrections, warnings } = validateParsed(
      { ...goodParsed, category: "packaging-design, sneaker-art" },
      taxonomy
    );
    expect(corrections.category).toBe("packaging-design");
    expect(warnings[0]).toContain("sneaker-art");
  });

  it("falls back to 'other' when all category values are unknown", () => {
    const { corrections } = validateParsed(
      { ...goodParsed, category: "made-up-thing" },
      taxonomy
    );
    expect(corrections.category).toBe("other");
  });

  it("accepts user-extended categories", () => {
    const extended = buildTaxonomy({ categories: ["sneaker-design"] });
    const { corrections, warnings } = validateParsed(
      { ...goodParsed, category: "sneaker-design" },
      extended
    );
    expect(corrections.category).toBeUndefined();
    expect(warnings).toHaveLength(0);
  });

  // ── Suggested fields: silently accepted ──

  it("silently accepts unknown style values", () => {
    const { corrections, warnings } = validateParsed(
      { ...goodParsed, style: "minimalist, wabi-sabi" },
      taxonomy
    );
    expect(corrections.style).toBeUndefined();
    expect(warnings).toHaveLength(0);
  });

  it("silently accepts unknown mood values", () => {
    const { corrections, warnings } = validateParsed(
      { ...goodParsed, mood: "calm, zen-like" },
      taxonomy
    );
    expect(corrections.mood).toBeUndefined();
    expect(warnings).toHaveLength(0);
  });

  it("silently accepts unknown medium values", () => {
    const { corrections, warnings } = validateParsed(
      { ...goodParsed, medium: "ai-generated" },
      taxonomy
    );
    expect(corrections.medium).toBeUndefined();
    expect(warnings).toHaveLength(0);
  });

  it("silently accepts unknown composition values", () => {
    const { corrections, warnings } = validateParsed(
      { ...goodParsed, composition: "centered, rule-of-thirds" },
      taxonomy
    );
    expect(corrections.composition).toBeUndefined();
    expect(warnings).toHaveLength(0);
  });

  // ── Palette: bare colors silently accepted ──

  it("silently accepts bare palette color names", () => {
    const { corrections, warnings } = validateParsed(
      { ...goodParsed, palette: "kraft-brown, blue, red" },
      taxonomy
    );
    expect(corrections.palette).toBeUndefined();
    expect(warnings).toHaveLength(0);
  });

  // ── Tags: silently auto-fixed ──

  it("silently fixes spaces in tags to hyphens", () => {
    const { corrections, warnings } = validateParsed(
      { ...goodParsed, tags: "tea packaging, kraft paper, wax-seal" },
      taxonomy
    );
    expect(corrections.tags).toBe("tea-packaging, kraft-paper, wax-seal");
    expect(warnings).toHaveLength(0);
  });

  it("no correction when tags are already hyphenated", () => {
    const { corrections } = validateParsed(goodParsed, taxonomy);
    expect(corrections.tags).toBeUndefined();
  });

  // ── Empty fields: no warnings ──

  it("does not warn on empty fields", () => {
    const empty: Record<string, string> = {
      type: "", category: "", style: "", mood: "", medium: "",
      composition: "", palette: "", subject: "", tags: "",
      colors: "", description: "", extractedText: "",
    };
    const { corrections, warnings } = validateParsed(empty, taxonomy);
    expect(warnings).toHaveLength(0);
    expect(Object.keys(corrections)).toHaveLength(0);
  });
});
