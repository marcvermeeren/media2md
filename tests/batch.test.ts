import { describe, it, expect } from "vitest";
import { join } from "node:path";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { discoverImages, runBatch } from "../src/batch.js";
import { sidecarPath } from "../src/output/writer.js";

const FIXTURES = join(import.meta.dirname, "fixtures");

describe("discoverImages", () => {
  it("discovers a single image file", async () => {
    const files = await discoverImages([join(FIXTURES, "test-image.png")]);
    expect(files).toHaveLength(1);
    expect(files[0]).toContain("test-image.png");
  });

  it("discovers all images in a directory", async () => {
    const files = await discoverImages([FIXTURES]);
    expect(files.length).toBeGreaterThanOrEqual(3);
    expect(files.some((f) => f.endsWith(".png"))).toBe(true);
    expect(files.some((f) => f.endsWith(".jpg"))).toBe(true);
    expect(files.some((f) => f.endsWith(".webp"))).toBe(true);
  });

  it("returns sorted paths", async () => {
    const files = await discoverImages([FIXTURES]);
    const sorted = [...files].sort();
    expect(files).toEqual(sorted);
  });

  it("skips non-image files", async () => {
    const files = await discoverImages([FIXTURES]);
    expect(files.every((f) => /\.(png|jpg|jpeg|webp|gif)$/i.test(f))).toBe(true);
  });

  it("handles recursive directory scanning", async () => {
    const nested = join(FIXTURES, "nested");
    await mkdir(nested, { recursive: true });
    // Create a minimal PNG in nested dir
    const png = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00,
      0x0d, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00,
      0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde,
      0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63,
      0xf8, 0xcf, 0xc0, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01, 0xe2, 0x21,
      0xbc, 0x33, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
      0x42, 0x60, 0x82,
    ]);
    await writeFile(join(nested, "deep.png"), png);

    // Without recursive: shouldn't find nested
    const shallow = await discoverImages([FIXTURES]);
    expect(shallow.some((f) => f.includes("nested"))).toBe(false);

    // With recursive: should find nested
    const deep = await discoverImages([FIXTURES], { recursive: true });
    expect(deep.some((f) => f.includes("deep.png"))).toBe(true);

    await rm(nested, { recursive: true });
  });

  it("handles nonexistent paths gracefully", async () => {
    const files = await discoverImages(["/nonexistent/path"]);
    expect(files).toHaveLength(0);
  });

  it("handles multiple inputs", async () => {
    const files = await discoverImages([
      join(FIXTURES, "test-image.png"),
      join(FIXTURES, "test-image.jpg"),
    ]);
    expect(files).toHaveLength(2);
  });
});

describe("sidecarPath", () => {
  it("creates .md path next to image", () => {
    expect(sidecarPath("/photos/shot.png")).toBe("/photos/shot.md");
    expect(sidecarPath("/docs/screen.jpg")).toBe("/docs/screen.md");
  });

  it("uses output directory when specified", () => {
    expect(sidecarPath("/photos/shot.png", "/output")).toBe("/output/shot.md");
  });
});

describe("runBatch", () => {
  it("processes all items", async () => {
    const results: number[] = [];
    await runBatch([1, 2, 3, 4, 5], 2, async (n) => {
      results.push(n);
    });
    expect(results.sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it("respects concurrency limit", async () => {
    let concurrent = 0;
    let maxConcurrent = 0;

    await runBatch([1, 2, 3, 4, 5, 6], 2, async () => {
      concurrent++;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      await new Promise((r) => setTimeout(r, 10));
      concurrent--;
    });

    expect(maxConcurrent).toBeLessThanOrEqual(2);
  });

  it("handles empty array", async () => {
    const results: number[] = [];
    await runBatch([], 3, async (n: number) => {
      results.push(n);
    });
    expect(results).toEqual([]);
  });
});
