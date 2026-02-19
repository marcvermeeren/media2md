import Anthropic from "@anthropic-ai/sdk";
import type { Provider, ImageInput, AnalyzeOptions, ProviderResponse } from "./types.js";

const DEFAULT_MODEL = "claude-sonnet-4-5-20250929";
const MAX_TOKENS = 4096;

export class AnthropicProvider implements Provider {
  async analyze(
    image: ImageInput,
    options: AnalyzeOptions
  ): Promise<ProviderResponse> {
    const client = new Anthropic({ maxRetries: 3 });
    const model = options.model ?? DEFAULT_MODEL;

    const base64 = image.buffer.toString("base64");

    const response = await client.messages.create({
      model,
      max_tokens: MAX_TOKENS,
      system: options.systemPrompt,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: image.mimeType,
                data: base64,
              },
            },
            {
              type: "text",
              text: options.userPrompt,
            },
          ],
        },
      ],
    });

    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("No text response from API");
    }

    return {
      rawText: textBlock.text,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
      model: response.model,
    };
  }

  async compare(
    images: ImageInput[],
    options: AnalyzeOptions
  ): Promise<ProviderResponse> {
    const client = new Anthropic({ maxRetries: 3 });
    const model = options.model ?? DEFAULT_MODEL;

    const content: Anthropic.Messages.ContentBlockParam[] = [];
    for (const image of images) {
      content.push({
        type: "image",
        source: {
          type: "base64",
          media_type: image.mimeType,
          data: image.buffer.toString("base64"),
        },
      });
    }
    content.push({ type: "text", text: options.userPrompt });

    const response = await client.messages.create({
      model,
      max_tokens: MAX_TOKENS,
      system: options.systemPrompt,
      messages: [{ role: "user", content }],
    });

    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("No text response from API");
    }

    return {
      rawText: textBlock.text,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
      model: response.model,
    };
  }
}

export const DEFAULT_ANTHROPIC_MODEL = DEFAULT_MODEL;
