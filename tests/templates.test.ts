import { describe, it, expect } from "vitest";
import { join } from "node:path";
import { writeFile, rm, mkdir } from "node:fs/promises";
import { renderTemplate, stripFrontmatter } from "../src/templates/engine.js";
import {
  DEFAULT_TEMPLATE,
  MINIMAL_TEMPLATE,
  ALT_TEXT_TEMPLATE,
  DETAILED_TEMPLATE,
  BUILTIN_TEMPLATES,
} from "../src/templates/builtins.js";
import { loadTemplate } from "../src/templates/loader.js";

const sampleVars: Record<string, string> = {
  type: "screenshot",
  category: "ui-design",
  style: "minimalist, flat, corporate",
  mood: "calm, modern",
  medium: "screen-capture",
  composition: "centered, grid",
  palette: "dark-blue, white, light-gray",
  subject: "Dashboard with analytics charts",
  colors: "dark-blue, white, light-gray",
  tags: "dashboard-chart, analytics-panel, navigation-sidebar",
  filename: "test.png",
  basename: "test",
  format: "PNG",
  dimensions: "800x600",
  width: "800",
  height: "600",
  sizeHuman: "42.1 KB",
  sizeBytes: "43110",
  sha256: "abc123def456",
  processedDate: "2026-02-17",
  datetime: "2026-02-17T12:00:00.000Z",
  model: "claude-sonnet-4-5-20250929",
  sourcePath: "./test.png",
  description: "- A dashboard with two chart panels\n- Line chart showing revenue\n- Bar chart showing users",
  extractedText: "**Navigation:** Dashboard | Settings | Logout\n**Chart Title:** Monthly Revenue",
};

describe("built-in templates", () => {
  it("default template includes new structured fields in frontmatter", () => {
    const result = renderTemplate(DEFAULT_TEMPLATE, sampleVars);
    expect(result).toContain("---");
    expect(result).toContain("type: screenshot");
    expect(result).toContain("category: [ui-design]");
    expect(result).toContain("style: [minimalist, flat, corporate]");
    expect(result).toContain("mood: [calm, modern]");
    expect(result).toContain("medium: screen-capture");
    expect(result).toContain("composition: [centered, grid]");
    expect(result).toContain("palette: [dark-blue, white, light-gray]");
    expect(result).toContain('subject: "Dashboard with analytics charts"');
    expect(result).toContain("tags: [dashboard-chart, analytics-panel, navigation-sidebar]");
    expect(result).toContain("source: test.png");
  });

  it("default template renders flat bullet-point description", () => {
    const result = renderTemplate(DEFAULT_TEMPLATE, sampleVars);
    expect(result).toContain("- A dashboard with two chart panels");
    expect(result).toContain("- Line chart showing revenue");
  });

  it("default template uses ## Text heading for extracted text", () => {
    const result = renderTemplate(DEFAULT_TEMPLATE, sampleVars);
    expect(result).toContain("## Text");
    expect(result).toContain("**Navigation:**");
  });

  it("default template does not include sha256, format, size, or # heading", () => {
    const result = renderTemplate(DEFAULT_TEMPLATE, sampleVars);
    expect(result).not.toContain("sha256:");
    expect(result).not.toContain("format: PNG");
    expect(result).not.toContain("size:");
    expect(result).not.toContain("# test");
    expect(result).not.toContain("## Source");
    expect(result).not.toContain("![test]");
  });

  it("default template omits extracted text when empty", () => {
    const vars = { ...sampleVars, extractedText: "" };
    const result = renderTemplate(DEFAULT_TEMPLATE, vars);
    expect(result).not.toContain("## Text");
  });

  it("default template omits new fields when empty (backward compat)", () => {
    const vars = {
      ...sampleVars,
      category: "",
      style: "",
      mood: "",
      medium: "",
      composition: "",
      palette: "",
    };
    const result = renderTemplate(DEFAULT_TEMPLATE, vars);
    expect(result).not.toContain("category:");
    expect(result).not.toContain("style:");
    expect(result).not.toContain("mood:");
    expect(result).not.toContain("medium:");
    expect(result).not.toContain("composition:");
    expect(result).not.toContain("palette:");
  });

  it("minimal template is just description + source link", () => {
    const result = renderTemplate(MINIMAL_TEMPLATE, sampleVars);
    expect(result).toContain("- A dashboard with two chart panels");
    expect(result).toContain("Source: [test.png](./test.png)");
    expect(result).not.toContain("---");
  });

  it("alt-text template is just description", () => {
    const result = renderTemplate(ALT_TEXT_TEMPLATE, sampleVars);
    expect(result).toContain("- A dashboard with two chart panels");
    expect(result).not.toContain("---");
    expect(result).not.toContain("Source:");
  });

  it("detailed template includes new fields, metadata table, and sha256", () => {
    const result = renderTemplate(DETAILED_TEMPLATE, sampleVars);
    expect(result).toContain("| Property | Value |");
    expect(result).toContain("| File | test.png |");
    expect(result).toContain("| Dimensions | 800x600 |");
    expect(result).toContain("sizeBytes: 43110");
    expect(result).toContain("sha256: abc123def456");
    expect(result).toContain("type: screenshot");
    expect(result).toContain("category: [ui-design]");
    expect(result).toContain("style: [minimalist, flat, corporate]");
    expect(result).toContain('subject: "Dashboard with analytics charts"');
    expect(result).toContain("colors: [dark-blue, white, light-gray]");
    expect(result).toContain("tags: [dashboard-chart, analytics-panel, navigation-sidebar]");
    expect(result).toContain("# test");
    expect(result).toContain("![test](./test.png)");
  });

  it("BUILTIN_TEMPLATES map has all templates", () => {
    expect(Object.keys(BUILTIN_TEMPLATES)).toEqual([
      "default",
      "minimal",
      "alt-text",
      "detailed",
    ]);
  });
});

describe("stripFrontmatter", () => {
  it("removes YAML frontmatter from markdown", () => {
    const input = "---\ntype: screenshot\nsubject: test\n---\n\n# Hello\n\nWorld\n";
    expect(stripFrontmatter(input)).toBe("# Hello\n\nWorld\n");
  });

  it("returns markdown unchanged when no frontmatter", () => {
    const input = "# Hello\n\nWorld\n";
    expect(stripFrontmatter(input)).toBe("# Hello\n\nWorld\n");
  });

  it("only strips leading frontmatter, not mid-document ---", () => {
    const input = "---\ntype: test\n---\n\nContent\n\n---\n\nMore content\n";
    const result = stripFrontmatter(input);
    expect(result).toBe("Content\n\n---\n\nMore content\n");
  });

  it("returns empty string for empty input", () => {
    expect(stripFrontmatter("")).toBe("");
  });

  it("does not strip --- used as horizontal rule (no frontmatter)", () => {
    const input = "# Heading\n\nSome text\n\n---\n\nMore text\n";
    expect(stripFrontmatter(input)).toBe(input);
  });

  it("works with default template output", () => {
    const rendered = renderTemplate(DEFAULT_TEMPLATE, sampleVars);
    const stripped = stripFrontmatter(rendered);
    expect(stripped).not.toContain("type: screenshot");
    expect(stripped).not.toMatch(/^---/);
    expect(stripped).toContain("- A dashboard with two chart panels");
  });
});

describe("loadTemplate", () => {
  const tmpDir = join(import.meta.dirname, "fixtures", "tmp-templates");

  it("returns default template when no name given", async () => {
    const tmpl = await loadTemplate();
    expect(tmpl).toBe(DEFAULT_TEMPLATE);
  });

  it("returns default template by name", async () => {
    const tmpl = await loadTemplate("default");
    expect(tmpl).toBe(DEFAULT_TEMPLATE);
  });

  it("returns minimal template by name", async () => {
    const tmpl = await loadTemplate("minimal");
    expect(tmpl).toBe(MINIMAL_TEMPLATE);
  });

  it("returns alt-text template by name", async () => {
    const tmpl = await loadTemplate("alt-text");
    expect(tmpl).toBe(ALT_TEXT_TEMPLATE);
  });

  it("loads custom template from file", async () => {
    await mkdir(tmpDir, { recursive: true });
    const customPath = join(tmpDir, "custom.md");
    await writeFile(customPath, "Custom: {{description}}\n", "utf-8");

    const tmpl = await loadTemplate(customPath);
    expect(tmpl).toBe("Custom: {{description}}\n");

    await rm(tmpDir, { recursive: true });
  });

  it("throws for unknown template name", async () => {
    await expect(loadTemplate("nonexistent")).rejects.toThrow(
      "Template not found"
    );
  });
});
