import OpenAI from "openai";
import type { Provider, ImageInput, AnalyzeOptions, ProviderResponse } from "./types.js";

const DEFAULT_MODEL = "gpt-4o";
const MAX_TOKENS = 4096;

export class OpenAIProvider implements Provider {
  async analyze(
    image: ImageInput,
    options: AnalyzeOptions
  ): Promise<ProviderResponse> {
    const client = new OpenAI({ maxRetries: 3 });
    const model = options.model ?? DEFAULT_MODEL;

    const base64 = image.buffer.toString("base64");
    const dataUri = `data:${image.mimeType};base64,${base64}`;

    const response = await client.chat.completions.create({
      model,
      max_tokens: MAX_TOKENS,
      messages: [
        {
          role: "system",
          content: options.systemPrompt,
        },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: dataUri },
            },
            {
              type: "text",
              text: options.userPrompt,
            },
          ],
        },
      ],
    });

    const choice = response.choices[0];
    if (!choice?.message?.content) {
      throw new Error("No text response from API");
    }

    return {
      rawText: choice.message.content,
      usage: response.usage
        ? {
            inputTokens: response.usage.prompt_tokens,
            outputTokens: response.usage.completion_tokens,
          }
        : undefined,
      model: response.model,
    };
  }

  async compare(
    images: ImageInput[],
    options: AnalyzeOptions
  ): Promise<ProviderResponse> {
    const client = new OpenAI({ maxRetries: 3 });
    const model = options.model ?? DEFAULT_MODEL;

    const content: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [];
    for (const image of images) {
      const dataUri = `data:${image.mimeType};base64,${image.buffer.toString("base64")}`;
      content.push({ type: "image_url", image_url: { url: dataUri } });
    }
    content.push({ type: "text", text: options.userPrompt });

    const response = await client.chat.completions.create({
      model,
      max_tokens: MAX_TOKENS,
      messages: [
        { role: "system", content: options.systemPrompt },
        { role: "user", content },
      ],
    });

    const choice = response.choices[0];
    if (!choice?.message?.content) {
      throw new Error("No text response from API");
    }

    return {
      rawText: choice.message.content,
      usage: response.usage
        ? {
            inputTokens: response.usage.prompt_tokens,
            outputTokens: response.usage.completion_tokens,
          }
        : undefined,
      model: response.model,
    };
  }
}

export const DEFAULT_OPENAI_MODEL = DEFAULT_MODEL;
