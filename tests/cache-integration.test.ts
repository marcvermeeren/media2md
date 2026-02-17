import { describe, it, expect, beforeEach } from "vitest";
import { join } from "node:path";
import { rm } from "node:fs/promises";
import { processFile } from "../src/processor.js";
import type {
  Provider,
  ImageInput,
  AnalyzeOptions,
  ProviderResponse,
} from "../src/providers/types.js";

const FIXTURES = join(import.meta.dirname, "fixtures");
const TEST_CACHE_DIR = join(import.meta.dirname, "fixtures", "tmp-integ-cache");

class CountingProvider implements Provider {
  callCount = 0;

  async analyze(
    _image: ImageInput,
    _options: AnalyzeOptions
  ): Promise<ProviderResponse> {
    this.callCount++;
    return {
      rawText: `DESCRIPTION:\nCall number ${this.callCount}.\n\nEXTRACTED_TEXT:\nNone`,
    };
  }
}

beforeEach(async () => {
  process.env.M2MD_CACHE_DIR = TEST_CACHE_DIR;
  await rm(TEST_CACHE_DIR, { recursive: true, force: true });
});

describe("cache integration with processor", () => {
  it("second call returns cached result without calling provider", async () => {
    const provider = new CountingProvider();
    const file = join(FIXTURES, "test-image.png");

    const first = await processFile(file, { provider });
    expect(first.cached).toBe(false);
    expect(provider.callCount).toBe(1);

    const second = await processFile(file, { provider });
    expect(second.cached).toBe(true);
    expect(provider.callCount).toBe(1); // NOT incremented
    expect(second.description).toBe(first.description);
    expect(second.markdown).toBe(first.markdown);
  });

  it("--no-cache forces provider call even with cached result", async () => {
    const provider = new CountingProvider();
    const file = join(FIXTURES, "test-image.png");

    await processFile(file, { provider });
    expect(provider.callCount).toBe(1);

    await processFile(file, { provider, noCache: true });
    expect(provider.callCount).toBe(2);
  });

  it("different model invalidates cache", async () => {
    const provider = new CountingProvider();
    const file = join(FIXTURES, "test-image.png");

    await processFile(file, { provider, model: "model-a" });
    expect(provider.callCount).toBe(1);

    await processFile(file, { provider, model: "model-b" });
    expect(provider.callCount).toBe(2);
  });

  it("different persona invalidates cache", async () => {
    const provider = new CountingProvider();
    const file = join(FIXTURES, "test-image.png");

    await processFile(file, { provider, persona: "brand" });
    expect(provider.callCount).toBe(1);

    await processFile(file, { provider, persona: "design" });
    expect(provider.callCount).toBe(2);
  });

  it("different template name invalidates cache", async () => {
    const provider = new CountingProvider();
    const file = join(FIXTURES, "test-image.png");

    await processFile(file, { provider, templateName: "default" });
    expect(provider.callCount).toBe(1);

    await processFile(file, { provider, templateName: "minimal" });
    expect(provider.callCount).toBe(2);
  });

  it("different file produces different cache entry", async () => {
    const provider = new CountingProvider();

    await processFile(join(FIXTURES, "test-image.png"), { provider });
    await processFile(join(FIXTURES, "test-image.jpg"), { provider });
    expect(provider.callCount).toBe(2);
  });
});
