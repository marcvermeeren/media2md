import { describe, it, expect, beforeEach } from "vitest";
import { join } from "node:path";
import { readFile, rm } from "node:fs/promises";
import { writeMarkdown, sidecarPath, formatOutputPath } from "../src/output/writer.js";

const TMP_DIR = join(import.meta.dirname, "fixtures", "tmp-writer");

beforeEach(async () => {
  await rm(TMP_DIR, { recursive: true, force: true });
});

describe("writeMarkdown", () => {
  it("creates the file with correct content", async () => {
    const outPath = join(TMP_DIR, "test.md");
    await writeMarkdown("# Hello\n\nWorld\n", outPath);

    const content = await readFile(outPath, "utf-8");
    expect(content).toBe("# Hello\n\nWorld\n");
  });

  it("creates nested directories if needed", async () => {
    const outPath = join(TMP_DIR, "deep", "nested", "dir", "test.md");
    await writeMarkdown("content", outPath);

    const content = await readFile(outPath, "utf-8");
    expect(content).toBe("content");
  });

  it("overwrites existing file", async () => {
    const outPath = join(TMP_DIR, "overwrite.md");
    await writeMarkdown("first", outPath);
    await writeMarkdown("second", outPath);

    const content = await readFile(outPath, "utf-8");
    expect(content).toBe("second");
  });
});

describe("sidecarPath", () => {
  it("replaces image extension with .md", () => {
    expect(sidecarPath("/photos/shot.png")).toBe("/photos/shot.md");
    expect(sidecarPath("/photos/shot.jpg")).toBe("/photos/shot.md");
    expect(sidecarPath("/photos/shot.jpeg")).toBe("/photos/shot.md");
    expect(sidecarPath("/photos/shot.webp")).toBe("/photos/shot.md");
    expect(sidecarPath("/photos/shot.gif")).toBe("/photos/shot.md");
  });

  it("places in output directory when specified", () => {
    expect(sidecarPath("/photos/shot.png", "/docs")).toBe("/docs/shot.md");
  });

  it("handles filenames with dots", () => {
    expect(sidecarPath("/photos/my.screenshot.png")).toBe(
      "/photos/my.screenshot.md"
    );
  });

  it("handles filenames with spaces", () => {
    expect(sidecarPath("/photos/Screenshot 2026-02-17.png")).toBe(
      "/photos/Screenshot 2026-02-17.md"
    );
  });
});

describe("formatOutputPath", () => {
  it("replaces {filename} with image basename", () => {
    expect(formatOutputPath("/photos/shot.png", "{filename}", {})).toBe(
      "/photos/shot.md"
    );
  });

  it("replaces {date} with provided date", () => {
    expect(
      formatOutputPath("/photos/shot.png", "{date}-{filename}", { date: "2026-02-18" })
    ).toBe("/photos/2026-02-18-shot.md");
  });

  it("replaces {type} with slugified type", () => {
    expect(
      formatOutputPath("/photos/shot.png", "{type}-{filename}", { type: "Screenshot" })
    ).toBe("/photos/screenshot-shot.md");
  });

  it("replaces {subject} with slugified subject", () => {
    expect(
      formatOutputPath("/photos/shot.png", "{subject}", { subject: "Dashboard with charts" })
    ).toBe("/photos/dashboard-with-charts.md");
  });

  it("appends .md if not in pattern", () => {
    expect(formatOutputPath("/photos/shot.png", "{filename}", {})).toBe(
      "/photos/shot.md"
    );
  });

  it("does not double .md", () => {
    expect(formatOutputPath("/photos/shot.png", "{filename}.md", {})).toBe(
      "/photos/shot.md"
    );
  });

  it("uses output directory when specified", () => {
    expect(
      formatOutputPath("/photos/shot.png", "{date}-{filename}", { date: "2026-02-18" }, "/docs")
    ).toBe("/docs/2026-02-18-shot.md");
  });

  it("combines all placeholders", () => {
    expect(
      formatOutputPath("/photos/shot.png", "{date}-{type}-{filename}", {
        date: "2026-02-18",
        type: "photo",
      })
    ).toBe("/photos/2026-02-18-photo-shot.md");
  });
});
