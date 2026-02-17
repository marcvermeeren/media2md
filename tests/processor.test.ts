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

  constructor(response: string) {
    this.response = response;
  }

  async analyze(
    image: ImageInput,
    options: AnalyzeOptions
  ): Promise<ProviderResponse> {
    this.lastImage = image;
    this.lastOptions = options;
    return { rawText: this.response };
  }
}

describe("processFile", () => {
  it("processes a PNG file end-to-end", async () => {
    const provider = new MockProvider(`DESCRIPTION:
A small red test image used for unit testing.

EXTRACTED_TEXT:
None`);

    const result = await processFile(join(FIXTURES, "test-image.png"), {
      provider,
      noCache: true,
    });

    expect(result.description).toBe(
      "A small red test image used for unit testing."
    );
    expect(result.extractedText).toEqual([]);
    expect(result.metadata.filename).toBe("test-image.png");
    expect(result.metadata.format).toBe("PNG");
    expect(result.markdown).toContain("source: test-image.png");
    expect(result.markdown).toContain("format: PNG");
    expect(result.markdown).toContain("# test-image");
    expect(result.markdown).toContain(
      "A small red test image used for unit testing."
    );
    // No extracted text section since none was found
    expect(result.markdown).not.toContain("## Extracted Text");
  });

  it("includes extracted text as bullet list", async () => {
    const provider = new MockProvider(`DESCRIPTION:
A screenshot of a form.

EXTRACTED_TEXT:
Username
Password
Submit`);

    const result = await processFile(join(FIXTURES, "test-image.png"), {
      provider,
      noCache: true,
    });

    expect(result.extractedText).toEqual(["Username", "Password", "Submit"]);
    expect(result.markdown).toContain("## Extracted Text");
    expect(result.markdown).toContain("- Username");
    expect(result.markdown).toContain("- Password");
    expect(result.markdown).toContain("- Submit");
  });

  it("includes frontmatter with metadata", async () => {
    const provider = new MockProvider(`DESCRIPTION:
Test.

EXTRACTED_TEXT:
None`);

    const result = await processFile(join(FIXTURES, "test-image.png"), {
      provider,
      noCache: true,
    });

    expect(result.markdown).toMatch(/^---\n/);
    expect(result.markdown).toContain("sha256:");
    expect(result.markdown).toContain("dimensions: 1x1");
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
    const provider = new MockProvider(`DESCRIPTION:
A JPEG test image.

EXTRACTED_TEXT:
None`);

    const result = await processFile(join(FIXTURES, "test-image.jpg"), {
      provider,
      noCache: true,
    });

    expect(result.metadata.format).toBe("JPEG");
    expect(provider.lastImage?.mimeType).toBe("image/jpeg");
  });
});
