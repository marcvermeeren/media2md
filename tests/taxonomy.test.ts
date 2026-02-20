import { describe, it, expect } from "vitest";
import {
  TYPES, CATEGORIES, STYLES, MOODS, MEDIUMS, COMPOSITIONS,
  buildTaxonomy, validateParsed,
} from "../src/taxonomy.js";

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
