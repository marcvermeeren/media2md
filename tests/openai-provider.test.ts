import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("openai", () => {
  const createMock = vi.fn();
  return {
    default: class OpenAI {
      chat = { completions: { create: createMock } };
      constructor() {}
      static _createMock = createMock;
    },
  };
});

import OpenAIMod from "openai";
import { OpenAIProvider, DEFAULT_OPENAI_MODEL } from "../src/providers/openai.js";
import type { ImageInput, AnalyzeOptions } from "../src/providers/types.js";

const createMock = (OpenAIMod as unknown as { _createMock: ReturnType<typeof vi.fn> })._createMock;

function makeImage(): ImageInput {
  return {
    buffer: Buffer.from("fake-png-data"),
    mimeType: "image/png",
    filename: "test.png",
  };
}

function makeOptions(overrides?: Partial<AnalyzeOptions>): AnalyzeOptions {
  return {
    systemPrompt: "You are a helpful assistant.",
    userPrompt: "Describe this image.",
    ...overrides,
  };
}

describe("OpenAIProvider", () => {
  beforeEach(() => {
    createMock.mockReset();
  });

  it("builds correct message format with image_url data URI", async () => {
    createMock.mockResolvedValue({
      choices: [{ message: { content: "A test image." } }],
      usage: { prompt_tokens: 100, completion_tokens: 50 },
      model: "gpt-4o-2024-08-06",
    });

    const provider = new OpenAIProvider();
    const image = makeImage();
    await provider.analyze(image, makeOptions());

    const call = createMock.mock.calls[0][0];
    const userMessage = call.messages[1];
    expect(userMessage.role).toBe("user");

    const imageBlock = userMessage.content[0];
    expect(imageBlock.type).toBe("image_url");
    expect(imageBlock.image_url.url).toBe(
      `data:image/png;base64,${image.buffer.toString("base64")}`
    );

    const textBlock = userMessage.content[1];
    expect(textBlock.type).toBe("text");
    expect(textBlock.text).toBe("Describe this image.");
  });

  it("sends system prompt as system message", async () => {
    createMock.mockResolvedValue({
      choices: [{ message: { content: "Response." } }],
      usage: { prompt_tokens: 50, completion_tokens: 20 },
      model: "gpt-4o",
    });

    const provider = new OpenAIProvider();
    await provider.analyze(makeImage(), makeOptions({ systemPrompt: "Be concise." }));

    const call = createMock.mock.calls[0][0];
    expect(call.messages[0]).toEqual({ role: "system", content: "Be concise." });
  });

  it("returns ProviderResponse with usage and model", async () => {
    createMock.mockResolvedValue({
      choices: [{ message: { content: "Described." } }],
      usage: { prompt_tokens: 200, completion_tokens: 100 },
      model: "gpt-4o-2024-08-06",
    });

    const provider = new OpenAIProvider();
    const result = await provider.analyze(makeImage(), makeOptions());

    expect(result.rawText).toBe("Described.");
    expect(result.usage).toEqual({ inputTokens: 200, outputTokens: 100 });
    expect(result.model).toBe("gpt-4o-2024-08-06");
  });

  it("uses default model when none specified", async () => {
    createMock.mockResolvedValue({
      choices: [{ message: { content: "Ok." } }],
      usage: { prompt_tokens: 10, completion_tokens: 5 },
      model: "gpt-4o",
    });

    const provider = new OpenAIProvider();
    await provider.analyze(makeImage(), makeOptions());

    const call = createMock.mock.calls[0][0];
    expect(call.model).toBe("gpt-4o");
  });

  it("uses custom model when provided", async () => {
    createMock.mockResolvedValue({
      choices: [{ message: { content: "Ok." } }],
      usage: { prompt_tokens: 10, completion_tokens: 5 },
      model: "gpt-4o-mini",
    });

    const provider = new OpenAIProvider();
    await provider.analyze(makeImage(), makeOptions({ model: "gpt-4o-mini" }));

    const call = createMock.mock.calls[0][0];
    expect(call.model).toBe("gpt-4o-mini");
  });

  it("throws when no text in response", async () => {
    createMock.mockResolvedValue({
      choices: [{ message: { content: null } }],
      model: "gpt-4o",
    });

    const provider = new OpenAIProvider();
    await expect(provider.analyze(makeImage(), makeOptions())).rejects.toThrow(
      "No text response from API"
    );
  });

  it("exports DEFAULT_OPENAI_MODEL as gpt-4o", () => {
    expect(DEFAULT_OPENAI_MODEL).toBe("gpt-4o");
  });
});
