import { readFile, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { basename, extname } from "node:path";
import imageSize from "image-size";

export interface ImageMetadata {
  filename: string;
  basename: string;
  extension: string;
  format: string;
  width: number | undefined;
  height: number | undefined;
  sizeBytes: number;
  sizeHuman: string;
  sha256: string;
}

export interface ExtractResult {
  metadata: ImageMetadata;
  buffer: Buffer;
}

const SUPPORTED_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);

const FORMAT_MAP: Record<string, string> = {
  png: "PNG",
  jpg: "JPEG",
  jpeg: "JPEG",
  webp: "WebP",
  gif: "GIF",
};

export function isSupportedFormat(filePath: string): boolean {
  return SUPPORTED_EXTENSIONS.has(extname(filePath).toLowerCase());
}

export function getSupportedFormats(): string[] {
  return [".png", ".jpg", ".jpeg", ".webp", ".gif"];
}

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function mimeTypeFromExtension(
  ext: string
): "image/png" | "image/jpeg" | "image/webp" | "image/gif" {
  const lower = ext.toLowerCase();
  if (lower === ".png") return "image/png";
  if (lower === ".jpg" || lower === ".jpeg") return "image/jpeg";
  if (lower === ".webp") return "image/webp";
  if (lower === ".gif") return "image/gif";
  throw new Error(`Unsupported extension: ${ext}`);
}

/**
 * Extract metadata from a buffer (for URL-fetched or in-memory images).
 * Skips file I/O — takes buffer + filename directly.
 */
export function extractMetadataFromBuffer(
  buffer: Buffer,
  filename: string,
  mimeType?: string
): ImageMetadata {
  const ext = mimeType ? extensionFromMimeType(mimeType) : extname(filename).toLowerCase();
  let dimensions: { width?: number; height?: number; type?: string } = {};
  try {
    dimensions = imageSize(buffer);
  } catch {
    // Unknown format — leave dimensions undefined
  }

  const hash = createHash("sha256").update(buffer).digest("hex");
  const name = basename(filename);

  return {
    filename: name,
    basename: basename(name, extname(name)),
    extension: ext,
    format: FORMAT_MAP[dimensions.type ?? ext.slice(1)] ?? dimensions.type ?? "unknown",
    width: dimensions.width,
    height: dimensions.height,
    sizeBytes: buffer.length,
    sizeHuman: humanSize(buffer.length),
    sha256: hash,
  };
}

function extensionFromMimeType(mimeType: string): string {
  if (mimeType.includes("png")) return ".png";
  if (mimeType.includes("jpeg") || mimeType.includes("jpg")) return ".jpg";
  if (mimeType.includes("webp")) return ".webp";
  if (mimeType.includes("gif")) return ".gif";
  return ".png";
}

export async function extractMetadata(filePath: string): Promise<ExtractResult> {
  const [buffer, fileStat] = await Promise.all([
    readFile(filePath),
    stat(filePath),
  ]);

  const ext = extname(filePath).toLowerCase();
  const dimensions = imageSize(buffer);
  const hash = createHash("sha256").update(buffer).digest("hex");

  return {
    metadata: {
      filename: basename(filePath),
      basename: basename(filePath, extname(filePath)),
      extension: ext,
      format: FORMAT_MAP[dimensions.type ?? ext.slice(1)] ?? dimensions.type ?? "unknown",
      width: dimensions.width,
      height: dimensions.height,
      sizeBytes: fileStat.size,
      sizeHuman: humanSize(fileStat.size),
      sha256: hash,
    },
    buffer,
  };
}
