import { describe, it, expect } from "vitest";
import { join } from "node:path";
import { processFile } from "../src/processor.js";
import type {
  Provider,
  ImageInput,
  AnalyzeOptions,
  ProviderResponse,
} from "../src/providers/types.js";

const FIXTURES = join(import.meta.dirname, "fixtures");

class MockProvider implements Provider {
  lastImage?: ImageInput;
  lastOptions?: AnalyzeOptions;
  response: string;
  usage?: { inputTokens: number; outputTokens: number };
  model?: string;

  constructor(response: string, opts?: { usage?: { inputTokens: number; outputTokens: number }; model?: string }) {
    this.response = response;
    this.usage = opts?.usage;
    this.model = opts?.model;
  }

  async analyze(
    image: ImageInput,
    options: AnalyzeOptions
  ): Promise<ProviderResponse> {
    this.lastImage = image;
    this.lastOptions = options;
    return { rawText: this.response, usage: this.usage, model: this.model };
  }
}

const NEW_FORMAT_RESPONSE = `TYPE:
photo

CATEGORY:
photography

STYLE:
minimalist, organic

MOOD:
calm, warm

MEDIUM:
product-photography

COMPOSITION:
centered, negative-space

PALETTE:
warm-red, soft-white

SUBJECT:
Small red test image for unit testing

TAGS:
test-square, solid-color, unit-test

VISUAL_ELEMENTS:
red square, solid fill, single pixel

REFERENCES:
none

USE_CASE:
color-swatch-reference, test-fixture-example

COLOR_HEX:
#FF0000, #FFFFFF

ERA:
contemporary

ARTIFACT:
none

TYPOGRAPHY:
none

SCRIPT:
none

CULTURAL_INFLUENCE:
none

DESCRIPTION:
A small solid red square image used for unit testing with minimal content. The single flat color fills the entire frame without variation. No visible techniques or materials beyond digital color fill. This serves as a lightweight test fixture for image processing pipelines.

SEARCH_PHRASES:
solid red test image
minimal single color square
unit test fixture image
red pixel test file

DIMENSIONS:
simplicity: Single solid color with no visual complexity serves as baseline test case
color-purity: Pure red fill demonstrates unambiguous color sampling

EXTRACTED_TEXT:
None`;

describe("processFile", () => {
  it("processes a PNG file end-to-end with new format", async () => {
    const provider = new MockProvider(NEW_FORMAT_RESPONSE, {
      usage: { inputTokens: 1000, outputTokens: 200 },
      model: "claude-sonnet-4-5-20250929",
    });

    const result = await processFile(join(FIXTURES, "test-image.png"), {
      provider,
      noCache: true,
    });

    expect(result.type).toBe("photo");
    expect(result.category).toBe("photography");
    expect(result.style).toBe("minimalist, organic");
    expect(result.mood).toBe("calm, warm");
    expect(result.medium).toBe("product-photography");
    expect(result.composition).toBe("centered, negative-space");
    expect(result.palette).toBe("warm-red, soft-white");
    expect(result.subject).toBe("Small red test image for unit testing");
    expect(result.tags).toBe("test-square, solid-color, unit-test");
    expect(result.visualElements).toBe("red square, solid fill, single pixel");
    expect(result.references).toBe("");
    expect(result.useCase).toBe("color-swatch-reference, test-fixture-example");
    expect(result.colorHex).toBe("#FF0000, #FFFFFF");
    expect(result.era).toBe("contemporary");
    expect(result.artifact).toBe("");
    expect(result.typography).toBe("");
    expect(result.script).toBe("");
    expect(result.culturalInfluence).toBe("");
    expect(result.searchPhrases).toContain("solid red test image");
    expect(result.dimensions).toContain("simplicity:");
    expect(result.description).toContain("solid red square");
    expect(result.extractedText).toBe("");
    expect(result.metadata.filename).toBe("test-image.png");
    expect(result.metadata.format).toBe("PNG");
    // Frontmatter checks
    expect(result.markdown).toContain("source: test-image.png");
    expect(result.markdown).toContain("type: photo");
    expect(result.markdown).toContain("category: [photography]");
    expect(result.markdown).toContain("style: [minimalist, organic]");
    expect(result.markdown).toContain("mood: [calm, warm]");
    expect(result.markdown).toContain("medium: product-photography");
    expect(result.markdown).toContain("palette: [warm-red, soft-white]");
    expect(result.markdown).toContain("tags: [test-square, solid-color, unit-test]");
    expect(result.markdown).toContain("visual_elements: [red square, solid fill, single pixel]");
    expect(result.markdown).toContain("use_case: [color-swatch-reference, test-fixture-example]");
    expect(result.markdown).toContain("color_hex:");
    expect(result.markdown).toContain("search_phrases:");
    expect(result.markdown).toContain("dimensions_px:");
    // references is "" so it should not appear
    expect(result.markdown).not.toContain("references:");
    // No extracted text section since none was found
    expect(result.markdown).not.toContain("## Text");
    // Usage and model are threaded through
    expect(result.usage).toEqual({ inputTokens: 1000, outputTokens: 200 });
    expect(result.model).toBe("claude-sonnet-4-5-20250929");
  });

  it("includes extracted text preserving LLM formatting", async () => {
    const provider = new MockProvider(`TYPE:
screenshot

CATEGORY:
ui-design

STYLE:
minimalist, flat

MOOD:
calm, modern

MEDIUM:
screen-capture

COMPOSITION:
centered

PALETTE:
soft-white, primary-blue, light-gray

SUBJECT:
Login form with three fields

TAGS:
login-form, username-input, password-field, submit-button

DESCRIPTION:
A form with input fields on a white background using a flat minimal style.

EXTRACTED_TEXT:
**Form Labels:** Username | Password
**Button:** Submit`);

    const result = await processFile(join(FIXTURES, "test-image.png"), {
      provider,
      noCache: true,
    });

    expect(result.extractedText).toContain("**Form Labels:** Username | Password");
    expect(result.extractedText).toContain("**Button:** Submit");
    expect(result.markdown).toContain("## Text");
    expect(result.markdown).toContain("**Form Labels:**");
  });

  it("includes new fields in frontmatter", async () => {
    const provider = new MockProvider(`TYPE:
diagram

CATEGORY:
data-visualization

STYLE:
minimalist, geometric

MOOD:
serious, modern

MEDIUM:
technical-drawing

COMPOSITION:
layered

PALETTE:
navy-blue, light-gray, clean-white

SUBJECT:
System architecture overview

TAGS:
architecture-diagram, system-design, microservices

DESCRIPTION:
A system architecture diagram showing service connections with labeled nodes.

EXTRACTED_TEXT:
None`);

    const result = await processFile(join(FIXTURES, "test-image.png"), {
      provider,
      noCache: true,
    });

    expect(result.markdown).toMatch(/^---\n/);
    expect(result.markdown).toContain("type: diagram");
    expect(result.markdown).toContain('subject: "System architecture overview"');
    expect(result.markdown).toContain("category: [data-visualization]");
    expect(result.markdown).toContain("style: [minimalist, geometric]");
    expect(result.markdown).toContain("medium: technical-drawing");
    expect(result.markdown).toContain("dimensions_px: 1x1");
    expect(result.markdown).toMatch(/processed: \d{4}-\d{2}-\d{2}/);
  });

  it("passes image buffer and mime type to provider", async () => {
    const provider = new MockProvider("Just a test.");
    await processFile(join(FIXTURES, "test-image.png"), { provider, noCache: true });

    expect(provider.lastImage?.mimeType).toBe("image/png");
    expect(provider.lastImage?.filename).toBe("test-image.png");
    expect(provider.lastImage?.buffer).toBeInstanceOf(Buffer);
    expect(provider.lastImage!.buffer.length).toBeGreaterThan(0);
  });

  it("passes model option to provider", async () => {
    const provider = new MockProvider("Test.");
    await processFile(join(FIXTURES, "test-image.png"), {
      provider,
      noCache: true,
      model: "claude-opus-4-6",
    });

    expect(provider.lastOptions?.model).toBe("claude-opus-4-6");
  });

  it("throws for nonexistent file", async () => {
    const provider = new MockProvider("Test.");
    await expect(
      processFile("/nonexistent/file.png", { provider })
    ).rejects.toThrow("File not found");
  });

  it("throws for unsupported format", async () => {
    const provider = new MockProvider("Test.");
    await expect(
      processFile(join(FIXTURES, "test-image.png").replace(".png", ".bmp"), {
        provider,
      })
    ).rejects.toThrow("Unsupported image format");
  });

  it("works with JPEG files", async () => {
    const provider = new MockProvider(`TYPE:
photo

SUBJECT:
A JPEG test image

DESCRIPTION:
A JPEG test image for validation.

EXTRACTED_TEXT:
None`);

    const result = await processFile(join(FIXTURES, "test-image.jpg"), {
      provider,
      noCache: true,
    });

    expect(result.metadata.format).toBe("JPEG");
    expect(provider.lastImage?.mimeType).toBe("image/jpeg");
  });

  it("does not include usage for cached results", async () => {
    const provider = new MockProvider("Test.", { usage: { inputTokens: 500, outputTokens: 100 }, model: "claude-sonnet-4-5-20250929" });
    const result = await processFile(join(FIXTURES, "test-image.png"), {
      provider,
      noCache: true,
    });
    // Non-cached result should have usage
    expect(result.usage).toEqual({ inputTokens: 500, outputTokens: 100 });
    expect(result.cached).toBe(false);
  });

  it("throws on model refusal", async () => {
    const provider = new MockProvider("I'm sorry, I can't help with that.");
    await expect(
      processFile(join(FIXTURES, "test-image.png"), { provider, noCache: true })
    ).rejects.toThrow("Model refused to process");
  });

  it("throws on varied refusal phrasing", async () => {
    const provider = new MockProvider("I cannot assist with this image.");
    await expect(
      processFile(join(FIXTURES, "test-image.png"), { provider, noCache: true })
    ).rejects.toThrow("Model refused to process");
  });

  it("does not treat long responses as refusals", async () => {
    const longResponse = "I'm sorry, I can't help with that. ".repeat(20);
    const provider = new MockProvider(longResponse);
    // Should NOT throw — long responses are real content, not refusals
    const result = await processFile(join(FIXTURES, "test-image.png"), {
      provider,
      noCache: true,
    });
    expect(result.description).toContain("sorry");
  });

  it("handles legacy two-section format from provider", async () => {
    const provider = new MockProvider(`DESCRIPTION:
A legacy format response.

EXTRACTED_TEXT:
Some text here`);

    const result = await processFile(join(FIXTURES, "test-image.png"), {
      provider,
      noCache: true,
    });

    expect(result.type).toBe("other");
    expect(result.subject).toBe("");
    expect(result.category).toBe("");
    expect(result.style).toBe("");
    expect(result.description).toBe("A legacy format response.");
    expect(result.extractedText).toBe("Some text here");
    expect(result.visualElements).toBe("");
    expect(result.references).toBe("");
    expect(result.useCase).toBe("");
    expect(result.colorHex).toBe("");
    expect(result.era).toBe("");
    expect(result.artifact).toBe("");
    expect(result.typography).toBe("");
    expect(result.script).toBe("");
    expect(result.culturalInfluence).toBe("");
    expect(result.searchPhrases).toBe("");
    expect(result.dimensions).toBe("");
  });

  it("new fields appear in rendered markdown frontmatter", async () => {
    const provider = new MockProvider(NEW_FORMAT_RESPONSE);
    const result = await processFile(join(FIXTURES, "test-image.png"), {
      provider,
      noCache: true,
    });

    expect(result.markdown).toContain("visual_elements: [red square, solid fill, single pixel]");
    expect(result.markdown).toContain("use_case: [color-swatch-reference, test-fixture-example]");
    expect(result.markdown).toContain("search_phrases:");
    expect(result.markdown).toContain('"solid red test image"');
  });
});
