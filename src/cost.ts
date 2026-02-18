import type { ImageMetadata } from "./extractors/metadata.js";

// Pricing per million tokens (as of 2025)
const PRICING: Record<string, { input: number; output: number }> = {
  "claude-sonnet-4-5-20250929": { input: 3.0, output: 15.0 },
  "claude-opus-4-6": { input: 15.0, output: 75.0 },
  "claude-haiku-4-5-20251001": { input: 0.8, output: 4.0 },
  "gpt-4o": { input: 2.5, output: 10.0 },
  "gpt-4o-mini": { input: 0.15, output: 0.60 },
};

const DEFAULT_PRICING = { input: 3.0, output: 15.0 };

// Average output tokens per image (description + extracted text)
const AVG_OUTPUT_TOKENS = 300;

// System + user prompt tokens (roughly)
const PROMPT_TOKENS = 350;

/**
 * Estimate input tokens for an image based on dimensions.
 * Anthropic's vision: roughly (width * height) / 750 tokens for the image itself.
 */
export function estimateImageTokens(metadata: ImageMetadata): number {
  const w = metadata.width ?? 1000;
  const h = metadata.height ?? 1000;
  const imageTokens = Math.ceil((w * h) / 750);
  return imageTokens + PROMPT_TOKENS;
}

export interface CostEstimate {
  files: number;
  cached: number;
  toProcess: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  estimatedCost: number;
  model: string;
  currency: string;
}

export function estimateCost(
  metadataList: { metadata: ImageMetadata; cached: boolean }[],
  model: string
): CostEstimate {
  const cached = metadataList.filter((m) => m.cached).length;
  const toProcess = metadataList.filter((m) => !m.cached);

  let totalInputTokens = 0;
  for (const item of toProcess) {
    totalInputTokens += estimateImageTokens(item.metadata);
  }

  const totalOutputTokens = toProcess.length * AVG_OUTPUT_TOKENS;
  const pricing = PRICING[model] ?? DEFAULT_PRICING;
  const estimatedCost =
    (totalInputTokens / 1_000_000) * pricing.input +
    (totalOutputTokens / 1_000_000) * pricing.output;

  return {
    files: metadataList.length,
    cached,
    toProcess: toProcess.length,
    totalInputTokens,
    totalOutputTokens,
    estimatedCost,
    model,
    currency: "USD",
  };
}

/**
 * Calculate actual cost from real token usage.
 */
export function calculateCost(inputTokens: number, outputTokens: number, model: string): number {
  const pricing = PRICING[model] ?? DEFAULT_PRICING;
  return (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output;
}

/**
 * Shorten a full model ID for display:
 * "claude-sonnet-4-5-20250929" → "sonnet-4-5"
 * "gpt-4o-mini" → "gpt-4o-mini"
 */
export function formatModel(model: string): string {
  if (model.startsWith("claude-")) {
    return model.replace("claude-", "").split("-2")[0];
  }
  return model;
}

export function formatCost(estimate: CostEstimate): string {
  const cost = estimate.estimatedCost;
  const costStr = cost < 0.01
    ? "<$0.01"
    : `~$${cost.toFixed(2)}`;

  const filesLabel = `${estimate.files} image${estimate.files !== 1 ? "s" : ""}`;
  const cacheNote = estimate.cached > 0
    ? ` (${estimate.cached} cached, ${estimate.toProcess} new)`
    : "";

  const modelShort = formatModel(estimate.model);

  const lines = [
    `  Files     ${filesLabel}${cacheNote}`,
    `  Tokens    ~${estimate.totalInputTokens.toLocaleString()} in + ~${estimate.totalOutputTokens.toLocaleString()} out`,
    `  Cost      ${costStr} (${modelShort})`,
  ];

  return lines.join("\n");
}
