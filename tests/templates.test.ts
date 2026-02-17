import { describe, it, expect } from "vitest";
import { join } from "node:path";
import { writeFile, rm, mkdir } from "node:fs/promises";
import { renderTemplate } from "../src/templates/engine.js";
import {
  DEFAULT_TEMPLATE,
  MINIMAL_TEMPLATE,
  ALT_TEXT_TEMPLATE,
  DETAILED_TEMPLATE,
  BUILTIN_TEMPLATES,
} from "../src/templates/builtins.js";
import { loadTemplate } from "../src/templates/loader.js";

const sampleVars: Record<string, string> = {
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
  persona: "brand",
  sourcePath: "./test.png",
  description: "A test screenshot showing a dashboard.",
  extractedText: "- Dashboard\n- Settings\n- Logout",
};

describe("built-in templates", () => {
  it("default template includes frontmatter and all sections", () => {
    const result = renderTemplate(DEFAULT_TEMPLATE, sampleVars);
    expect(result).toContain("---");
    expect(result).toContain("source: test.png");
    expect(result).toContain("format: PNG");
    expect(result).toContain("# test");
    expect(result).toContain("## Description");
    expect(result).toContain("## Extracted Text");
    expect(result).toContain("- Dashboard");
    expect(result).toContain("## Source");
    expect(result).toContain("![test](./test.png)");
    expect(result).toContain("persona: brand");
  });

  it("default template omits extracted text when empty", () => {
    const vars = { ...sampleVars, extractedText: "" };
    const result = renderTemplate(DEFAULT_TEMPLATE, vars);
    expect(result).not.toContain("## Extracted Text");
  });

  it("default template omits persona when empty", () => {
    const vars = { ...sampleVars, persona: "" };
    const result = renderTemplate(DEFAULT_TEMPLATE, vars);
    expect(result).not.toContain("persona:");
  });

  it("minimal template is just description + source link", () => {
    const result = renderTemplate(MINIMAL_TEMPLATE, sampleVars);
    expect(result).toContain("A test screenshot showing a dashboard.");
    expect(result).toContain("Source: [test.png](./test.png)");
    expect(result).not.toContain("---");
    expect(result).not.toContain("## Description");
  });

  it("alt-text template is just description", () => {
    const result = renderTemplate(ALT_TEXT_TEMPLATE, sampleVars);
    expect(result.trim()).toBe("A test screenshot showing a dashboard.");
  });

  it("detailed template includes metadata table", () => {
    const result = renderTemplate(DETAILED_TEMPLATE, sampleVars);
    expect(result).toContain("| Property | Value |");
    expect(result).toContain("| File | test.png |");
    expect(result).toContain("| Dimensions | 800x600 |");
    expect(result).toContain("sizeBytes: 43110");
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
