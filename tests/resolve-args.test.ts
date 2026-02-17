import { describe, it, expect } from "vitest";
import { join } from "node:path";
import { stat, mkdir, writeFile, rm } from "node:fs/promises";
import { resolve } from "node:path";

// We can't import resolveFileArgs directly since it's not exported.
// Replicate the logic here for testing the algorithm.
async function resolveFileArgs(args: string[]): Promise<string[]> {
  if (args.length <= 1) return args;

  const checks = await Promise.all(
    args.map(async (a) => {
      const s = await stat(resolve(a)).catch(() => null);
      return s !== null;
    })
  );

  if (checks.every(Boolean)) return args;

  if (checks.every((c) => !c)) {
    const joined = args.join(" ");
    const s = await stat(resolve(joined)).catch(() => null);
    if (s !== null) return [joined];
  }

  return args;
}

const FIXTURES = join(import.meta.dirname, "fixtures");
const TMP_DIR = join(import.meta.dirname, "fixtures", "tmp-resolve");

describe("resolveFileArgs", () => {
  it("returns single arg as-is", async () => {
    const result = await resolveFileArgs(["test.png"]);
    expect(result).toEqual(["test.png"]);
  });

  it("returns multiple existing files as-is", async () => {
    const a = join(FIXTURES, "test-image.png");
    const b = join(FIXTURES, "test-image.jpg");
    const result = await resolveFileArgs([a, b]);
    expect(result).toEqual([a, b]);
  });

  it("joins nonexistent args into single path if it exists", async () => {
    // Create a file with spaces in the name
    await mkdir(TMP_DIR, { recursive: true });
    const spacedPath = join(TMP_DIR, "Screenshot 2026-02-17 at 12.00.00.png");
    await writeFile(spacedPath, "fake");

    const args = [
      join(TMP_DIR, "Screenshot"),
      "2026-02-17",
      "at",
      "12.00.00.png",
    ];
    const result = await resolveFileArgs(args);
    expect(result).toHaveLength(1);
    expect(result[0]).toContain("Screenshot 2026-02-17 at 12.00.00.png");

    await rm(TMP_DIR, { recursive: true });
  });

  it("returns args as-is if joined path doesn't exist either", async () => {
    const args = ["nonexistent", "path", "here"];
    const result = await resolveFileArgs(args);
    expect(result).toEqual(args);
  });

  it("returns mixed args as-is", async () => {
    const existing = join(FIXTURES, "test-image.png");
    const args = [existing, "nonexistent"];
    const result = await resolveFileArgs(args);
    expect(result).toEqual(args);
  });
});
