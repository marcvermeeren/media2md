import { describe, it, expect, beforeEach } from "vitest";
import { join } from "node:path";
import { rm, readdir } from "node:fs/promises";
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
  markdown: "# Test\n\nSome markdown\n",
  description: "A test image",
  extractedText: ["Hello", "World"],
  model: "claude-sonnet-4-5-20250929",
  persona: "",
  cachedAt: "2026-02-17T12:00:00.000Z",
};

describe("buildCacheKey", () => {
  it("returns a hex hash string", () => {
    const key = buildCacheKey("abc123", {});
    expect(key).toMatch(/^[a-f0-9]{64}$/);
  });

  it("same inputs produce same key", () => {
    const a = buildCacheKey("abc", { model: "x", persona: "y" });
    const b = buildCacheKey("abc", { model: "x", persona: "y" });
    expect(a).toBe(b);
  });

  it("different model produces different key", () => {
    const a = buildCacheKey("abc", { model: "model-a" });
    const b = buildCacheKey("abc", { model: "model-b" });
    expect(a).not.toBe(b);
  });

  it("different persona produces different key", () => {
    const a = buildCacheKey("abc", { persona: "brand" });
    const b = buildCacheKey("abc", { persona: "design" });
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
    expect(result!.markdown).toBe("# Test\n\nSome markdown\n");
    expect(result!.description).toBe("A test image");
    expect(result!.extractedText).toEqual(["Hello", "World"]);
  });

  it("overwrites existing entry", async () => {
    const key = "overwrite-key";
    await setCached(key, sampleEntry);
    await setCached(key, { ...sampleEntry, description: "Updated" });

    const result = await getCached(key);
    expect(result!.description).toBe("Updated");
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
