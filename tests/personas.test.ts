import { describe, it, expect } from "vitest";
import { buildSystemPrompt } from "../src/prompts.js";
import {
  BUILTIN_PERSONAS,
  getPersonaNames,
} from "../src/personas/builtins.js";

describe("personas", () => {
  it("getPersonaNames returns all persona names", () => {
    const names = getPersonaNames();
    expect(names).toContain("brand");
    expect(names).toContain("design");
    expect(names).toContain("developer");
    expect(names).toContain("accessibility");
    expect(names).toContain("marketing");
    expect(names).toHaveLength(5);
  });

  it("all personas have required fields", () => {
    for (const [key, persona] of Object.entries(BUILTIN_PERSONAS)) {
      expect(persona.name).toBe(key);
      expect(persona.description).toBeTruthy();
      expect(persona.modifier).toBeTruthy();
    }
  });
});

describe("buildSystemPrompt with personas", () => {
  it("returns base prompt with no persona", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("expert image analyst");
    expect(prompt).not.toContain("brand analyst");
  });

  it("appends brand persona modifier", () => {
    const prompt = buildSystemPrompt("brand");
    expect(prompt).toContain("expert image analyst");
    expect(prompt).toContain("brand analyst");
    expect(prompt).toContain("Positioning and messaging");
  });

  it("appends design persona modifier", () => {
    const prompt = buildSystemPrompt("design");
    expect(prompt).toContain("UI/UX designer");
    expect(prompt).toContain("Typography");
  });

  it("appends developer persona modifier", () => {
    const prompt = buildSystemPrompt("developer");
    expect(prompt).toContain("software developer");
  });

  it("appends accessibility persona modifier", () => {
    const prompt = buildSystemPrompt("accessibility");
    expect(prompt).toContain("accessibility expert");
    expect(prompt).toContain("Color contrast");
  });

  it("appends marketing persona modifier", () => {
    const prompt = buildSystemPrompt("marketing");
    expect(prompt).toContain("marketing analyst");
    expect(prompt).toContain("Calls to action");
  });

  it("treats unknown persona as freeform string", () => {
    const prompt = buildSystemPrompt("focus on colors");
    expect(prompt).toContain("Additional context: focus on colors");
  });

  it("custom --prompt overrides persona", () => {
    const prompt = buildSystemPrompt("brand", "Describe security issues only");
    expect(prompt).toContain("Describe security issues only");
    expect(prompt).not.toContain("brand analyst");
  });

  it("custom --prompt works without persona", () => {
    const prompt = buildSystemPrompt(undefined, "Be very concise");
    expect(prompt).toContain("Be very concise");
  });
});
