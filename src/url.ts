export class ContentTypeError extends Error {
  contentType: string;
  constructor(url: string, contentType: string) {
    super(`URL is not an image (${contentType}): ${url}`);
    this.name = "ContentTypeError";
    this.contentType = contentType;
  }
}

const IMAGE_CONTENT_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

const IMAGE_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".webp", ".gif",
]);

export function isUrl(input: string): boolean {
  return input.startsWith("http://") || input.startsWith("https://");
}

export function looksLikeImageUrl(input: string): boolean {
  try {
    const url = new URL(input);
    const pathname = url.pathname.toLowerCase();
    return [...IMAGE_EXTENSIONS].some((ext) => pathname.endsWith(ext));
  } catch {
    return false;
  }
}

export function filenameFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split("/").filter(Boolean);
    if (segments.length > 0) {
      const last = segments[segments.length - 1];
      // Decode and clean up
      const decoded = decodeURIComponent(last);
      if (decoded.includes(".")) return decoded;
      return decoded;
    }
  } catch {
    // fall through
  }
  // Fallback: use host + hash
  return "image";
}

export function extensionFromMimeType(
  mimeType: string
): string {
  if (mimeType.includes("png")) return ".png";
  if (mimeType.includes("jpeg") || mimeType.includes("jpg")) return ".jpg";
  if (mimeType.includes("webp")) return ".webp";
  if (mimeType.includes("gif")) return ".gif";
  return ".png"; // safe default
}

/**
 * Fetch an image URL and return the buffer + metadata.
 * Throws ContentTypeError if the response is not an image.
 */
export async function fetchImage(
  url: string
): Promise<{ buffer: Buffer; mimeType: string; filename: string }> {
  const response = await fetch(url, {
    headers: { "User-Agent": "m2md/0.1.0 (https://github.com/marcvermeeren/m2md; image-to-markdown CLI tool)" },
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch URL (${response.status}): ${url}`);
  }

  const contentType = (response.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();

  if (!IMAGE_CONTENT_TYPES.has(contentType)) {
    throw new ContentTypeError(url, contentType);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  let filename = filenameFromUrl(url);

  // Ensure filename has an extension matching the content type
  if (!IMAGE_EXTENSIONS.has(filename.substring(filename.lastIndexOf(".")))) {
    filename += extensionFromMimeType(contentType);
  }

  return { buffer, mimeType: contentType, filename };
}

/**
 * Screenshot a web page using Playwright (optional dependency).
 * Returns a PNG buffer.
 */
export async function screenshotPage(
  url: string
): Promise<{ buffer: Buffer; mimeType: string; filename: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let pw: any;
  try {
    // Dynamic module name to avoid TypeScript resolving the optional dep
    const mod = ["play", "wright"].join("");
    pw = await import(mod);
  } catch {
    throw new Error(
      `URL is not an image and Playwright is not installed.\n` +
      `To screenshot web pages, install Playwright:\n\n` +
      `  npm install playwright\n` +
      `  npx playwright install chromium\n`
    );
  }

  const browser = await pw.chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });
    const buffer = Buffer.from(await page.screenshot({ fullPage: true }));
    const filename = filenameFromUrl(url).replace(/\.[^.]+$/, "") + ".png";
    return { buffer, mimeType: "image/png", filename };
  } finally {
    await browser.close();
  }
}
