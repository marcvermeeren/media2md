import { access } from "node:fs/promises";
import { extname } from "node:path";
import {
  extractMetadata,
  extractMetadataFromBuffer,
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
import { type Taxonomy, buildTaxonomy, validateParsed } from "./taxonomy.js";

export interface ProcessOptions {
  model?: string;
  prompt?: string;
  note?: string;
  template?: string;
  templateName?: string;
  provider: Provider;
  providerName?: string;
  noCache?: boolean;
  taxonomy?: Taxonomy;
}

export interface ProcessResult {
  type: string;
  category: string;
  style: string;
  mood: string;
  medium: string;
  composition: string;
  palette: string;
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
  validationWarnings?: string[];
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

  return _processCore(metadata, buffer, options);
}

export interface BufferInput {
  buffer: Buffer;
  filename: string;
  mimeType: string;
}

/**
 * Process an in-memory image buffer (e.g. from a URL fetch).
 * Same pipeline as processFile but skips file I/O.
 */
export async function processBuffer(
  input: BufferInput,
  options: ProcessOptions
): Promise<ProcessResult> {
  const metadata = extractMetadataFromBuffer(input.buffer, input.filename, input.mimeType);
  return _processCore(metadata, input.buffer, options);
}

async function _processCore(
  metadata: ImageMetadata,
  buffer: Buffer,
  options: ProcessOptions
): Promise<ProcessResult> {
  // Check cache
  const cacheKey = buildCacheKey(metadata.sha256, {
    model: options.model,
    prompt: options.prompt,
    templateName: options.templateName,
    note: options.note,
    provider: options.providerName,
  });

  if (!options.noCache) {
    const cached = await getCached(cacheKey);
    if (cached) {
      return {
        type: cached.type ?? "other",
        category: cached.category ?? "",
        style: cached.style ?? "",
        mood: cached.mood ?? "",
        medium: cached.medium ?? "",
        composition: cached.composition ?? "",
        palette: cached.palette ?? "",
        subject: cached.subject ?? "",
        description: cached.description,
        extractedText: cached.extractedText,
        colors: cached.colors ?? "",
        tags: cached.tags ?? "",
        metadata,
        markdown: cached.markdown,
        cached: true,
      };
    }
  }

  // Build prompts
  const systemPrompt = buildSystemPrompt(options.prompt, options.note, options.taxonomy);
  const userPrompt = buildUserPrompt(metadata.filename, metadata.format);

  // Call provider
  const mimeType = mimeTypeFromExtension(metadata.extension);
  const response = await options.provider.analyze(
    { buffer, mimeType, filename: metadata.filename },
    { model: options.model, systemPrompt, userPrompt }
  );

  // Detect model refusals (e.g. OpenAI content moderation)
  if (isRefusal(response.rawText)) {
    throw new Error(`Model refused to process ${metadata.filename} — content may have been flagged by the provider's safety filter`);
  }

  // Parse response
  const parsed = parseResponse(response.rawText);

  // Validate against taxonomy (silently corrects strict fields)
  const taxonomy = options.taxonomy ?? buildTaxonomy();
  const { corrections, warnings } = validateParsed(parsed as unknown as Record<string, string>, taxonomy);

  // Apply corrections over parsed values
  const validated = { ...parsed, ...corrections };
  const {
    type, category, style, mood, medium, composition, palette,
    subject, description, extractedText, colors, tags,
  } = validated;

  // Build template variables
  const dimensions =
    metadata.width && metadata.height
      ? `${metadata.width}x${metadata.height}`
      : "unknown";

  const now = new Date();
  const vars: Record<string, string> = {
    type,
    category,
    style,
    mood,
    medium,
    composition,
    palette,
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
      category,
      style,
      mood,
      medium,
      composition,
      palette,
      subject,
      markdown,
      description,
      extractedText,
      colors,
      tags,
      model: options.model ?? "default",
      cachedAt: now.toISOString(),
    });
  }

  return {
    type,
    category,
    style,
    mood,
    medium,
    composition,
    palette,
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
    validationWarnings: warnings.length ? warnings : undefined,
  };
}

const REFUSAL_PATTERNS = [
  /^i'?m sorry,? i can'?t/i,
  /^i cannot assist/i,
  /^i'?m unable to/i,
  /^i can'?t (help|provide|assist|describe|analyze)/i,
  /^sorry,? but i (can'?t|cannot|am unable)/i,
  /^i'?m not able to/i,
  /^i apologize,? but/i,
];

function isRefusal(text: string): boolean {
  const trimmed = text.trim();
  // Refusals are short — a real description would be longer
  if (trimmed.length > 300) return false;
  return REFUSAL_PATTERNS.some((re) => re.test(trimmed));
}
