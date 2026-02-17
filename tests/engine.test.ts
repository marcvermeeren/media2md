import { describe, it, expect } from "vitest";
import { renderTemplate } from "../src/templates/engine.js";

describe("renderTemplate", () => {
  it("replaces simple variables", () => {
    const result = renderTemplate("Hello {{name}}!", { name: "World" });
    expect(result).toBe("Hello World!\n");
  });

  it("replaces multiple variables", () => {
    const result = renderTemplate("{{a}} and {{b}}", { a: "X", b: "Y" });
    expect(result).toBe("X and Y\n");
  });

  it("replaces missing variables with empty string", () => {
    const result = renderTemplate("Hello {{name}}!", {});
    expect(result).toBe("Hello !\n");
  });

  it("replaces undefined variables with empty string", () => {
    const result = renderTemplate("Hello {{name}}!", { name: undefined });
    expect(result).toBe("Hello !\n");
  });

  it("renders {{#if}} block when variable is truthy", () => {
    const result = renderTemplate("A{{#if show}}\nB\n{{/if}}C", {
      show: "yes",
    });
    expect(result).toBe("A\nB\nC\n");
  });

  it("removes {{#if}} block when variable is falsy", () => {
    const result = renderTemplate("A\n{{#if show}}B\n{{/if}}C", {});
    expect(result).toBe("A\nC\n");
  });

  it("removes {{#if}} block when variable is undefined", () => {
    const result = renderTemplate("A\n{{#if show}}B\n{{/if}}C", {
      show: undefined,
    });
    expect(result).toBe("A\nC\n");
  });

  it("removes {{#if}} block when variable is empty string", () => {
    const result = renderTemplate("A\n{{#if show}}B\n{{/if}}C", {
      show: "",
    });
    expect(result).toBe("A\nC\n");
  });

  it("handles multiple {{#if}} blocks", () => {
    const tmpl = "{{#if a}}A{{/if}}\n{{#if b}}B{{/if}}";
    expect(renderTemplate(tmpl, { a: "yes" })).toBe("A\n");
    expect(renderTemplate(tmpl, { b: "yes" })).toBe("B\n");
    expect(renderTemplate(tmpl, { a: "yes", b: "yes" })).toBe("A\nB\n");
  });

  it("handles variables inside {{#if}} blocks", () => {
    const result = renderTemplate("{{#if show}}Hello {{name}}{{/if}}", {
      show: "yes",
      name: "World",
    });
    expect(result).toBe("Hello World\n");
  });

  it("collapses excessive blank lines", () => {
    const result = renderTemplate("A\n\n\n\n\nB", {});
    expect(result).toBe("A\n\nB\n");
  });

  it("works with realistic template", () => {
    const template = `---
title: {{title}}
---

# {{title}}

{{description}}

{{#if notes}}
## Notes

{{notes}}
{{/if}}
`;
    const result = renderTemplate(template, {
      title: "Test",
      description: "A test document",
      notes: "Some notes",
    });
    expect(result).toContain("title: Test");
    expect(result).toContain("# Test");
    expect(result).toContain("A test document");
    expect(result).toContain("## Notes");
    expect(result).toContain("Some notes");
  });
});
