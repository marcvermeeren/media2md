import { describe, it, expect } from "vitest";
import { isUrl, looksLikeImageUrl, filenameFromUrl } from "../src/url.js";

describe("isUrl", () => {
  it("detects http URLs", () => {
    expect(isUrl("http://example.com/image.png")).toBe(true);
  });

  it("detects https URLs", () => {
    expect(isUrl("https://example.com/image.png")).toBe(true);
  });

  it("rejects file paths", () => {
    expect(isUrl("./image.png")).toBe(false);
    expect(isUrl("/abs/path/image.png")).toBe(false);
    expect(isUrl("image.png")).toBe(false);
  });

  it("rejects other protocols", () => {
    expect(isUrl("ftp://example.com/image.png")).toBe(false);
  });
});

describe("looksLikeImageUrl", () => {
  it("detects image extensions in URL path", () => {
    expect(looksLikeImageUrl("https://example.com/photo.jpg")).toBe(true);
    expect(looksLikeImageUrl("https://example.com/photo.png")).toBe(true);
    expect(looksLikeImageUrl("https://example.com/photo.webp")).toBe(true);
    expect(looksLikeImageUrl("https://example.com/photo.gif")).toBe(true);
    expect(looksLikeImageUrl("https://example.com/photo.jpeg")).toBe(true);
  });

  it("rejects non-image URLs", () => {
    expect(looksLikeImageUrl("https://example.com/page.html")).toBe(false);
    expect(looksLikeImageUrl("https://example.com/")).toBe(false);
  });

  it("handles query strings (still an image URL)", () => {
    expect(looksLikeImageUrl("https://example.com/photo.png?w=100")).toBe(true);
  });

  it("rejects URLs with non-image extension before query", () => {
    expect(looksLikeImageUrl("https://example.com/page.php?img=photo.png")).toBe(false);
  });

  it("handles invalid URLs", () => {
    expect(looksLikeImageUrl("not-a-url")).toBe(false);
  });
});

describe("filenameFromUrl", () => {
  it("extracts filename from simple URL", () => {
    expect(filenameFromUrl("https://example.com/photo.png")).toBe("photo.png");
  });

  it("extracts filename from nested path", () => {
    expect(filenameFromUrl("https://example.com/assets/images/photo.jpg")).toBe("photo.jpg");
  });

  it("decodes URL-encoded characters", () => {
    expect(filenameFromUrl("https://example.com/my%20photo.png")).toBe("my photo.png");
  });

  it("handles URLs without file extension", () => {
    expect(filenameFromUrl("https://example.com/image")).toBe("image");
  });

  it("uses hostname for root URLs", () => {
    expect(filenameFromUrl("https://example.com/")).toBe("example-com");
  });
});
