import { describe, it, expect } from "vitest";
import {
  buildCompareSystemPrompt,
  buildCompareUserPrompt,
  formatCompareMarkdown,
} from "../src/prompts.js";

describe("formatCompareMarkdown", () => {
  it("parses a well-formatted response with all 4 sections", () => {
    const rawText = `SUMMARY:
Both images show the same dashboard but with different color themes.

SIMILARITIES:
- Same layout structure with sidebar and main content area
- Both have navigation bar at top

DIFFERENCES:
- Image A uses a dark theme, Image B uses a light theme
- Image A has blue accent colors, Image B uses green

VERDICT:
Image A (dark theme) provides better contrast for data visualization.`;

    const result = formatCompareMarkdown(rawText, ["dark.png", "light.png"]);

    expect(result).toContain("# Comparison");
    expect(result).toContain("- **Image A:** dark.png");
    expect(result).toContain("- **Image B:** light.png");
    expect(result).toContain("## Summary");
    expect(result).toContain("Both images show the same dashboard");
    expect(result).toContain("## Similarities");
    expect(result).toContain("Same layout structure");
    expect(result).toContain("## Differences");
    expect(result).toContain("dark theme");
    expect(result).toContain("## Verdict");
    expect(result).toContain("better contrast");
  });

  it("handles a partially formatted response (missing sections)", () => {
    const rawText = `SUMMARY:
Two screenshots of a form.

DIFFERENCES:
- Image A has validation errors shown, Image B does not`;

    const result = formatCompareMarkdown(rawText, ["a.png", "b.png"]);

    expect(result).toContain("## Summary");
    expect(result).toContain("Two screenshots of a form");
    expect(result).toContain("## Differences");
    expect(result).toContain("validation errors");
    // Missing sections should not appear
    expect(result).not.toContain("## Similarities");
    expect(result).not.toContain("## Verdict");
  });

  it("falls back to raw text when no sections are found", () => {
    const rawText = "These images look very similar but have subtle color differences.";

    const result = formatCompareMarkdown(rawText, ["x.png", "y.png"]);

    expect(result).toContain("# Comparison");
    expect(result).toContain("- **Image A:** x.png");
    expect(result).toContain("- **Image B:** y.png");
    expect(result).toContain("These images look very similar");
    // Should not have section headings
    expect(result).not.toContain("## Summary");
  });

  it("handles 3+ images with correct labels", () => {
    const rawText = "Just some text.";
    const result = formatCompareMarkdown(rawText, ["a.png", "b.png", "c.png"]);

    expect(result).toContain("- **Image A:** a.png");
    expect(result).toContain("- **Image B:** b.png");
    expect(result).toContain("- **Image C:** c.png");
  });
});

describe("buildCompareSystemPrompt", () => {
  it("returns base compare prompt without note", () => {
    const prompt = buildCompareSystemPrompt();
    expect(prompt).toContain("expert image analyst comparing");
    expect(prompt).toContain("SUMMARY:");
    expect(prompt).toContain("SIMILARITIES:");
    expect(prompt).toContain("DIFFERENCES:");
    expect(prompt).toContain("VERDICT:");
    expect(prompt).not.toContain("Focus directive");
  });

  it("appends focus directive when note provided", () => {
    const prompt = buildCompareSystemPrompt("focus on typography");
    expect(prompt).toContain("Focus directive");
    expect(prompt).toContain("focus on typography");
  });
});

describe("buildCompareUserPrompt", () => {
  it("includes all filenames with labels", () => {
    const prompt = buildCompareUserPrompt(["before.png", "after.png"]);
    expect(prompt).toContain("Compare these 2 images");
    expect(prompt).toContain("Image A: before.png");
    expect(prompt).toContain("Image B: after.png");
    expect(prompt).toContain("SUMMARY:");
  });

  it("handles 3 images", () => {
    const prompt = buildCompareUserPrompt(["v1.png", "v2.png", "v3.png"]);
    expect(prompt).toContain("Compare these 3 images");
    expect(prompt).toContain("Image A: v1.png");
    expect(prompt).toContain("Image B: v2.png");
    expect(prompt).toContain("Image C: v3.png");
  });
});
