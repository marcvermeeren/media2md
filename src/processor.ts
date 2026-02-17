import { access } from "node:fs/promises";
import { extname } from "node:path";
import {
  extractMetadata,
  isSupportedFormat,
  getSupportedFormats,
  mimeTypeFromExtension,
  type ImageMetadata,
} from "./extractors/metadata.js";
import type { Provider } from "./providers/types.js";
import { parseResponse } from "./parser.js";
import { buildSystemPrompt, buildUserPrompt } from "./prompts.js";
import { renderTemplate } from "./templates/engine.js";
import { DEFAULT_TEMPLATE } from "./templates/builtins.js";

export interface ProcessOptions {
  model?: string;
  persona?: string;
  provider: Provider;
}

export interface ProcessResult {
  description: string;
  extractedText: string[];
  metadata: ImageMetadata;
  markdown: string;
}

const FILE_SIZE_WARNING_BYTES = 15 * 1024 * 1024; // 15MB

export async function processFile(
  filePath: string,
  options: ProcessOptions
): Promise<ProcessResult> {
  // Validate format (check before file access — no I/O needed)
  if (!isSupportedFormat(filePath)) {
    const ext = extname(filePath);
    const supported = getSupportedFormats().join(", ");
    throw new Error(
      `Unsupported image format: ${ext}. Supported formats: ${supported}`
    );
  }

  // Validate file exists
  await access(filePath).catch(() => {
    throw new Error(`File not found: ${filePath}`);
  });

  // Extract metadata and get buffer (single read)
  const { metadata, buffer } = await extractMetadata(filePath);

  // Warn for large files
  if (metadata.sizeBytes > FILE_SIZE_WARNING_BYTES) {
    process.stderr.write(
      `Warning: File is ${metadata.sizeHuman} (Anthropic limit is 20MB)\n`
    );
  }

  // Build prompts
  const systemPrompt = buildSystemPrompt(options.persona);
  const userPrompt = buildUserPrompt(metadata.filename, metadata.format);

  // Call provider
  const mimeType = mimeTypeFromExtension(metadata.extension);
  const response = await options.provider.analyze(
    { buffer, mimeType, filename: metadata.filename },
    { model: options.model, systemPrompt, userPrompt }
  );

  // Parse response
  const { description, extractedText } = parseResponse(response.rawText);

  // Format extracted text as bullet list
  const extractedTextFormatted =
    extractedText.length > 0
      ? extractedText.map((line) => `- ${line}`).join("\n")
      : "";

  // Build template variables
  const dimensions =
    metadata.width && metadata.height
      ? `${metadata.width}x${metadata.height}`
      : "unknown";

  const vars: Record<string, string> = {
    filename: metadata.filename,
    basename: metadata.basename,
    format: metadata.format,
    dimensions,
    sizeHuman: metadata.sizeHuman,
    sha256: metadata.sha256,
    processedDate: new Date().toISOString().split("T")[0],
    model: options.model ?? "default",
    description,
    extractedText: extractedTextFormatted,
  };

  // Render template
  const markdown = renderTemplate(DEFAULT_TEMPLATE, vars);

  return { description, extractedText, metadata, markdown };
}
