import { describe, it, expect } from "vitest";
import { estimateImageTokens, estimateCost, formatCost } from "../src/cost.js";
import type { ImageMetadata } from "../src/extractors/metadata.js";

function makeMetadata(width: number, height: number): ImageMetadata {
  return {
    filename: "test.png",
    basename: "test",
    extension: ".png",
    format: "PNG",
    width,
    height,
    sizeBytes: 10000,
    sizeHuman: "10.0 KB",
    sha256: "abc123",
  };
}

describe("estimateImageTokens", () => {
  it("estimates tokens based on dimensions", () => {
    const tokens = estimateImageTokens(makeMetadata(1920, 1080));
    // (1920*1080)/750 = 2764.8 → 2765 + 350 prompt = 3115
    expect(tokens).toBe(3115);
  });

  it("handles small images", () => {
    const tokens = estimateImageTokens(makeMetadata(100, 100));
    // (100*100)/750 = 13.3 → 14 + 350 = 364
    expect(tokens).toBe(364);
  });

  it("falls back to 1000x1000 for unknown dimensions", () => {
    const meta = { ...makeMetadata(0, 0), width: undefined, height: undefined };
    const tokens = estimateImageTokens(meta);
    // (1000*1000)/750 = 1333.3 → 1334 + 350 = 1684
    expect(tokens).toBe(1684);
  });
});

describe("estimateCost", () => {
  it("calculates cost for uncached images", () => {
    const items = [
      { metadata: makeMetadata(1920, 1080), cached: false },
      { metadata: makeMetadata(800, 600), cached: false },
    ];
    const estimate = estimateCost(items, "claude-sonnet-4-5-20250929");
    expect(estimate.files).toBe(2);
    expect(estimate.cached).toBe(0);
    expect(estimate.toProcess).toBe(2);
    expect(estimate.totalInputTokens).toBeGreaterThan(0);
    expect(estimate.totalOutputTokens).toBe(600); // 2 * 300
    expect(estimate.estimatedCost).toBeGreaterThan(0);
  });

  it("excludes cached images from cost", () => {
    const items = [
      { metadata: makeMetadata(1920, 1080), cached: true },
      { metadata: makeMetadata(800, 600), cached: false },
    ];
    const estimate = estimateCost(items, "claude-sonnet-4-5-20250929");
    expect(estimate.cached).toBe(1);
    expect(estimate.toProcess).toBe(1);
    expect(estimate.totalOutputTokens).toBe(300); // only 1 uncached
  });

  it("returns zero cost when all cached", () => {
    const items = [
      { metadata: makeMetadata(1920, 1080), cached: true },
    ];
    const estimate = estimateCost(items, "claude-sonnet-4-5-20250929");
    expect(estimate.estimatedCost).toBe(0);
    expect(estimate.toProcess).toBe(0);
  });

  it("uses higher pricing for opus", () => {
    const items = [
      { metadata: makeMetadata(1920, 1080), cached: false },
    ];
    const sonnet = estimateCost(items, "claude-sonnet-4-5-20250929");
    const opus = estimateCost(items, "claude-opus-4-6");
    expect(opus.estimatedCost).toBeGreaterThan(sonnet.estimatedCost);
  });
});

describe("formatCost", () => {
  it("formats cost estimate as readable string", () => {
    const estimate = estimateCost(
      [
        { metadata: makeMetadata(1920, 1080), cached: false },
        { metadata: makeMetadata(800, 600), cached: true },
      ],
      "claude-sonnet-4-5-20250929"
    );
    const output = formatCost(estimate);
    expect(output).toContain("2 images");
    expect(output).toContain("1 cached");
    expect(output).toContain("1 new");
    expect(output).toContain("input");
    expect(output).toContain("output");
    expect(output).toContain("$");
  });

  it("shows <$0.01 for very small costs", () => {
    const estimate = estimateCost(
      [{ metadata: makeMetadata(100, 100), cached: false }],
      "claude-sonnet-4-5-20250929"
    );
    const output = formatCost(estimate);
    expect(output).toContain("<$0.01");
  });
});
