import { describe, it, expect, beforeEach } from "vitest";
import { join } from "node:path";
import { rm } from "node:fs/promises";
import {
  buildCacheKey,
  getCached,
  setCached,
  clearCache,
  getCacheStats,
  type CacheEntry,
} from "../src/cache/store.js";

const TEST_CACHE_DIR = join(import.meta.dirname, "fixtures", "tmp-cache");

// Point cache to a test directory
beforeEach(async () => {
  process.env.M2MD_CACHE_DIR = TEST_CACHE_DIR;
  await rm(TEST_CACHE_DIR, { recursive: true, force: true });
});

const sampleEntry: CacheEntry = {
  hash: "abc123",
  type: "screenshot",
  subject: "A test dashboard",
  markdown: "# Test\n\nSome markdown\n",
  description: "A test image",
  extractedText: "**Heading:** Hello World",
  colors: "blue, white, gray",
  tags: "dashboard, chart, heading",
  model: "claude-sonnet-4-5-20250929",
  cachedAt: "2026-02-17T12:00:00.000Z",
};

describe("buildCacheKey", () => {
  it("returns a hex hash string", () => {
    const key = buildCacheKey("abc123", {});
    expect(key).toMatch(/^[a-f0-9]{64}$/);
  });

  it("same inputs produce same key", () => {
    const a = buildCacheKey("abc", { model: "x", prompt: "y" });
    const b = buildCacheKey("abc", { model: "x", prompt: "y" });
    expect(a).toBe(b);
  });

  it("different model produces different key", () => {
    const a = buildCacheKey("abc", { model: "model-a" });
    const b = buildCacheKey("abc", { model: "model-b" });
    expect(a).not.toBe(b);
  });

  it("different prompt produces different key", () => {
    const a = buildCacheKey("abc", { prompt: "focus on colors" });
    const b = buildCacheKey("abc", { prompt: "focus on layout" });
    expect(a).not.toBe(b);
  });

  it("different template produces different key", () => {
    const a = buildCacheKey("abc", { templateName: "default" });
    const b = buildCacheKey("abc", { templateName: "minimal" });
    expect(a).not.toBe(b);
  });
});

describe("getCached / setCached", () => {
  it("returns null for cache miss", async () => {
    const result = await getCached("nonexistent-key");
    expect(result).toBeNull();
  });

  it("stores and retrieves a cache entry", async () => {
    const key = "test-key-123";
    await setCached(key, sampleEntry);

    const result = await getCached(key);
    expect(result).not.toBeNull();
    expect(result!.hash).toBe("abc123");
    expect(result!.type).toBe("screenshot");
    expect(result!.subject).toBe("A test dashboard");
    expect(result!.markdown).toBe("# Test\n\nSome markdown\n");
    expect(result!.description).toBe("A test image");
    expect(result!.extractedText).toBe("**Heading:** Hello World");
  });

  it("overwrites existing entry", async () => {
    const key = "overwrite-key";
    await setCached(key, sampleEntry);
    await setCached(key, { ...sampleEntry, description: "Updated" });

    const result = await getCached(key);
    expect(result!.description).toBe("Updated");
  });

  it("round-trips new fields through cache", async () => {
    const key = "new-fields-key";
    const entry: CacheEntry = {
      ...sampleEntry,
      visualElements: "glass bottle, kraft label, wax seal",
      references: "Swiss International Style, Dieter Rams",
      useCase: "packaging-layout-inspiration, color-palette-reference",
      colorHex: "#2C1810, #F5E6D3, #8B4513",
      era: "mid-century",
      artifact: "packaging-box",
      typography: "futura, sans-serif",
      script: "latin, english",
      culturalInfluence: "japanese-wabi-sabi, scandinavian-functionalism",
      searchPhrases: "minimalist Japanese tea packaging\nkraft paper box with wax seal",
      dimensions: "craft-quality: Hand-applied gold foil\nmaterial-palette: Raw kraft and matte black",
    };

    await setCached(key, entry);
    const result = await getCached(key);

    expect(result).not.toBeNull();
    expect(result!.visualElements).toBe("glass bottle, kraft label, wax seal");
    expect(result!.references).toBe("Swiss International Style, Dieter Rams");
    expect(result!.useCase).toBe("packaging-layout-inspiration, color-palette-reference");
    expect(result!.colorHex).toBe("#2C1810, #F5E6D3, #8B4513");
    expect(result!.era).toBe("mid-century");
    expect(result!.artifact).toBe("packaging-box");
    expect(result!.typography).toBe("futura, sans-serif");
    expect(result!.script).toBe("latin, english");
    expect(result!.culturalInfluence).toBe("japanese-wabi-sabi, scandinavian-functionalism");
    expect(result!.searchPhrases).toContain("minimalist Japanese tea packaging");
    expect(result!.dimensions).toContain("craft-quality:");
  });

  it("old cache entries without new fields still load (backward compat)", async () => {
    const key = "old-entry-key";
    // Simulate an old cache entry that lacks the new fields
    await setCached(key, sampleEntry);

    const result = await getCached(key);
    expect(result).not.toBeNull();
    expect(result!.type).toBe("screenshot");
    expect(result!.subject).toBe("A test dashboard");
    // New fields should be undefined (not present in old entries)
    expect(result!.visualElements).toBeUndefined();
    expect(result!.references).toBeUndefined();
    expect(result!.useCase).toBeUndefined();
    expect(result!.colorHex).toBeUndefined();
    expect(result!.era).toBeUndefined();
    expect(result!.artifact).toBeUndefined();
    expect(result!.typography).toBeUndefined();
    expect(result!.script).toBeUndefined();
    expect(result!.culturalInfluence).toBeUndefined();
    expect(result!.searchPhrases).toBeUndefined();
    expect(result!.dimensions).toBeUndefined();
  });
});

describe("clearCache", () => {
  it("clears all entries", async () => {
    await setCached("key-1", sampleEntry);
    await setCached("key-2", { ...sampleEntry, hash: "def456" });

    const count = await clearCache();
    expect(count).toBe(2);

    expect(await getCached("key-1")).toBeNull();
    expect(await getCached("key-2")).toBeNull();
  });

  it("returns 0 for empty cache", async () => {
    const count = await clearCache();
    expect(count).toBe(0);
  });
});

describe("getCacheStats", () => {
  it("reports empty cache", async () => {
    const stats = await getCacheStats();
    expect(stats.entries).toBe(0);
    expect(stats.sizeBytes).toBe(0);
  });

  it("reports correct entry count and size", async () => {
    await setCached("key-1", sampleEntry);
    await setCached("key-2", { ...sampleEntry, hash: "def456" });

    const stats = await getCacheStats();
    expect(stats.entries).toBe(2);
    expect(stats.sizeBytes).toBeGreaterThan(0);
    expect(stats.cacheDir).toBe(TEST_CACHE_DIR);
  });
});
