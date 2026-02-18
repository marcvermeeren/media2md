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
import { buildCacheKey, getCached, setCached } from "./cache/store.js";

export interface ProcessOptions {
  model?: string;
  persona?: string;
  prompt?: string;
  note?: string;
  template?: string;
  templateName?: string;
  provider: Provider;
  noCache?: boolean;
}

export interface ProcessResult {
  type: string;
  subject: string;
  description: string;
  extractedText: string;
  colors: string;
  tags: string;
  metadata: ImageMetadata;
  markdown: string;
  cached: boolean;
  usage?: { inputTokens: number; outputTokens: number };
  model?: string;
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

  // Check cache
  const cacheKey = buildCacheKey(metadata.sha256, {
    model: options.model,
    persona: options.persona,
    prompt: options.prompt,
    templateName: options.templateName,
    note: options.note,
  });

  if (!options.noCache) {
    const cached = await getCached(cacheKey);
    if (cached) {
      // Handle legacy cache entries where extractedText was string[]
      const extractedText = Array.isArray(cached.extractedText)
        ? (cached.extractedText as unknown as string[]).join("\n")
        : cached.extractedText;

      return {
        type: cached.type ?? "other",
        subject: cached.subject ?? "",
        description: cached.description,
        extractedText,
        colors: cached.colors ?? "",
        tags: cached.tags ?? "",
        metadata,
        markdown: cached.markdown,
        cached: true,
      };
    }
  }

  // Warn for large files
  if (metadata.sizeBytes > FILE_SIZE_WARNING_BYTES) {
    process.stderr.write(
      `Warning: File is ${metadata.sizeHuman} (Anthropic limit is 20MB)\n`
    );
  }

  // Build prompts
  const systemPrompt = buildSystemPrompt(options.persona, options.prompt, options.note);
  const userPrompt = buildUserPrompt(metadata.filename, metadata.format);

  // Call provider
  const mimeType = mimeTypeFromExtension(metadata.extension);
  const response = await options.provider.analyze(
    { buffer, mimeType, filename: metadata.filename },
    { model: options.model, systemPrompt, userPrompt }
  );

  // Parse response
  const { type, subject, description, extractedText, colors, tags } = parseResponse(
    response.rawText
  );

  // Build template variables
  const dimensions =
    metadata.width && metadata.height
      ? `${metadata.width}x${metadata.height}`
      : "unknown";

  const now = new Date();
  const vars: Record<string, string> = {
    type,
    subject,
    filename: metadata.filename,
    basename: metadata.basename,
    format: metadata.format,
    dimensions,
    width: metadata.width?.toString() ?? "unknown",
    height: metadata.height?.toString() ?? "unknown",
    sizeHuman: metadata.sizeHuman,
    sizeBytes: metadata.sizeBytes.toString(),
    sha256: metadata.sha256,
    processedDate: now.toISOString().split("T")[0],
    datetime: now.toISOString(),
    model: options.model ?? "default",
    persona: options.persona ?? "",
    note: options.note ?? "",
    sourcePath: `./${metadata.filename}`,
    description,
    extractedText,
    colors,
    tags,
  };

  // Render template
  const template = options.template ?? DEFAULT_TEMPLATE;
  const markdown = renderTemplate(template, vars);

  // Store in cache
  if (!options.noCache) {
    await setCached(cacheKey, {
      hash: metadata.sha256,
      type,
      subject,
      markdown,
      description,
      extractedText,
      colors,
      tags,
      model: options.model ?? "default",
      persona: options.persona ?? "",
      cachedAt: now.toISOString(),
    });
  }

  return {
    type,
    subject,
    description,
    extractedText,
    colors,
    tags,
    metadata,
    markdown,
    cached: false,
    usage: response.usage,
    model: response.model,
  };
}
