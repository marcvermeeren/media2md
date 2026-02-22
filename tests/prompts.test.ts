import { describe, it, expect } from "vitest";
import { buildSystemPrompt, buildUserPrompt } from "../src/prompts.js";

describe("buildSystemPrompt with note", () => {
  const FOCUS_PREFIX = "Focus directive";

  it("appends note after base prompt", () => {
    const prompt = buildSystemPrompt(undefined, "watercolor technique");
    expect(prompt).toContain("expert image analyst");
    expect(prompt).toContain(FOCUS_PREFIX);
    expect(prompt).toContain("watercolor technique");
    const baseEnd = prompt.indexOf("indicate with [unclear]");
    const noteStart = prompt.indexOf(FOCUS_PREFIX);
    expect(noteStart).toBeGreaterThan(baseEnd);
  });

  it("appends note after custom --prompt", () => {
    const prompt = buildSystemPrompt("Describe security issues only", "XSS vectors");
    expect(prompt).toContain("Describe security issues only");
    expect(prompt).toContain(FOCUS_PREFIX);
    expect(prompt).toContain("XSS vectors");
    const customPos = prompt.indexOf("Describe security issues only");
    const notePos = prompt.indexOf(FOCUS_PREFIX);
    expect(notePos).toBeGreaterThan(customPos);
  });

  it("no note produces no focus directive", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).not.toContain(FOCUS_PREFIX);
  });

  it("undefined note produces no focus directive", () => {
    const prompt = buildSystemPrompt(undefined, undefined);
    expect(prompt).not.toContain(FOCUS_PREFIX);
  });

  it("empty string note produces no focus directive", () => {
    const prompt = buildSystemPrompt(undefined, "");
    expect(prompt).not.toContain(FOCUS_PREFIX);
  });
});

describe("buildSystemPrompt field instructions", () => {
  it("includes new section instructions", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("VISUAL_ELEMENTS:");
    expect(prompt).toContain("REFERENCES:");
    expect(prompt).toContain("USE_CASE:");
    expect(prompt).toContain("COLOR_HEX:");
    expect(prompt).toContain("ERA:");
    expect(prompt).toContain("ARTIFACT:");
    expect(prompt).toContain("TYPOGRAPHY:");
    expect(prompt).toContain("SCRIPT:");
    expect(prompt).toContain("CULTURAL_INFLUENCE:");
    expect(prompt).toContain("SEARCH_PHRASES:");
    expect(prompt).toContain("DIMENSIONS:");
  });

  it("SUBJECT instruction includes proper nouns guidance", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("proper nouns");
    expect(prompt).toContain("specific identification");
  });

  it("DESCRIPTION instruction requests sentences not bullets", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("4 sentences, no bullet points");
  });

  it("PALETTE instruction includes material-driven naming", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("material-driven");
    expect(prompt).toContain("concrete-gray");
    expect(prompt).toContain("patina-green");
  });

  it("TAGS instruction prioritizes materials and techniques", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("material names");
    expect(prompt).toContain("technique names");
  });

  it("TAGS instruction caps at 6-8", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("6-8 hyphenated keywords");
  });

  it("SEARCH_PHRASES instruction caps at 8-10", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("8-10 natural language search phrases");
  });

  it("STYLE and MOOD must not share terms rule", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("STYLE and MOOD must not share any terms");
  });

  it("REFERENCES instruction pushes to 3-5", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("3-5 design movements");
  });

  it("DIMENSIONS instruction enforces non-overlapping keys", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("genuinely distinct analytical lens");
  });

  it("PALETTE instruction uses evocative naming guidance", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("bone-white");
    expect(prompt).toContain("ink-black");
    expect(prompt).toContain("NEVER generic");
  });
});

describe("buildUserPrompt", () => {
  it("lists all section names including new fields", () => {
    const prompt = buildUserPrompt("test.png", "PNG");
    expect(prompt).toContain("VISUAL_ELEMENTS:");
    expect(prompt).toContain("REFERENCES:");
    expect(prompt).toContain("USE_CASE:");
    expect(prompt).toContain("COLOR_HEX:");
    expect(prompt).toContain("ERA:");
    expect(prompt).toContain("ARTIFACT:");
    expect(prompt).toContain("TYPOGRAPHY:");
    expect(prompt).toContain("SCRIPT:");
    expect(prompt).toContain("CULTURAL_INFLUENCE:");
    expect(prompt).toContain("SEARCH_PHRASES:");
    expect(prompt).toContain("DIMENSIONS:");
    expect(prompt).toContain("EXTRACTED_TEXT:");
  });
});
