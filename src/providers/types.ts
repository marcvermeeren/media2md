export interface ImageInput {
  buffer: Buffer;
  mimeType: "image/png" | "image/jpeg" | "image/webp" | "image/gif";
  filename: string;
}

export interface ProviderResponse {
  rawText: string;
  usage?: { inputTokens: number; outputTokens: number };
  model?: string;
}

export interface AnalyzeOptions {
  model?: string;
  systemPrompt: string;
  userPrompt: string;
}

export interface Provider {
  analyze(image: ImageInput, options: AnalyzeOptions): Promise<ProviderResponse>;
  compare(images: ImageInput[], options: AnalyzeOptions): Promise<ProviderResponse>;
}
