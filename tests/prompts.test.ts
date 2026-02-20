import { describe, it, expect } from "vitest";
import { buildSystemPrompt } from "../src/prompts.js";

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
