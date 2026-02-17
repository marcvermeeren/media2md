import { describe, it, expect } from "vitest";
import { join } from "node:path";
import {
  extractMetadata,
  isSupportedFormat,
  getSupportedFormats,
  mimeTypeFromExtension,
} from "../src/extractors/metadata.js";

const FIXTURES = join(import.meta.dirname, "fixtures");

describe("extractMetadata", () => {
  it("extracts PNG metadata", async () => {
    const { metadata, buffer } = await extractMetadata(
      join(FIXTURES, "test-image.png")
    );
    expect(metadata.filename).toBe("test-image.png");
    expect(metadata.basename).toBe("test-image");
    expect(metadata.extension).toBe(".png");
    expect(metadata.format).toBe("PNG");
    expect(metadata.width).toBe(1);
    expect(metadata.height).toBe(1);
    expect(metadata.sizeBytes).toBeGreaterThan(0);
    expect(metadata.sizeHuman).toMatch(/\d+ B/);
    expect(metadata.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBe(metadata.sizeBytes);
  });

  it("extracts JPEG metadata", async () => {
    const { metadata } = await extractMetadata(
      join(FIXTURES, "test-image.jpg")
    );
    expect(metadata.format).toBe("JPEG");
    expect(metadata.extension).toBe(".jpg");
    expect(metadata.width).toBe(1);
    expect(metadata.height).toBe(1);
  });

  it("extracts WebP metadata", async () => {
    const { metadata } = await extractMetadata(
      join(FIXTURES, "test-image.webp")
    );
    expect(metadata.format).toBe("WebP");
    expect(metadata.extension).toBe(".webp");
    expect(metadata.width).toBe(1);
    expect(metadata.height).toBe(1);
  });

  it("returns consistent SHA-256 hash", async () => {
    const first = await extractMetadata(join(FIXTURES, "test-image.png"));
    const second = await extractMetadata(join(FIXTURES, "test-image.png"));
    expect(first.metadata.sha256).toBe(second.metadata.sha256);
  });

  it("throws for nonexistent file", async () => {
    await expect(extractMetadata("/nonexistent/file.png")).rejects.toThrow();
  });
});

describe("isSupportedFormat", () => {
  it("accepts supported formats", () => {
    expect(isSupportedFormat("photo.png")).toBe(true);
    expect(isSupportedFormat("photo.jpg")).toBe(true);
    expect(isSupportedFormat("photo.jpeg")).toBe(true);
    expect(isSupportedFormat("photo.webp")).toBe(true);
    expect(isSupportedFormat("photo.gif")).toBe(true);
  });

  it("rejects unsupported formats", () => {
    expect(isSupportedFormat("photo.bmp")).toBe(false);
    expect(isSupportedFormat("photo.svg")).toBe(false);
    expect(isSupportedFormat("photo.tiff")).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(isSupportedFormat("photo.PNG")).toBe(true);
    expect(isSupportedFormat("photo.JPG")).toBe(true);
  });
});

describe("getSupportedFormats", () => {
  it("returns array of extensions", () => {
    const formats = getSupportedFormats();
    expect(formats).toContain(".png");
    expect(formats).toContain(".jpg");
    expect(formats).toContain(".webp");
  });
});

describe("mimeTypeFromExtension", () => {
  it("maps extensions to MIME types", () => {
    expect(mimeTypeFromExtension(".png")).toBe("image/png");
    expect(mimeTypeFromExtension(".jpg")).toBe("image/jpeg");
    expect(mimeTypeFromExtension(".jpeg")).toBe("image/jpeg");
    expect(mimeTypeFromExtension(".webp")).toBe("image/webp");
    expect(mimeTypeFromExtension(".gif")).toBe("image/gif");
  });

  it("throws for unsupported extension", () => {
    expect(() => mimeTypeFromExtension(".bmp")).toThrow("Unsupported extension");
  });
});
