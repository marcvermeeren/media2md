import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { processFile } from "./processor.js";
import { loadTemplate } from "./templates/loader.js";
import { AnthropicProvider, DEFAULT_ANTHROPIC_MODEL } from "./providers/anthropic.js";
import { OpenAIProvider, DEFAULT_OPENAI_MODEL } from "./providers/openai.js";
import type { Provider } from "./providers/types.js";

const server = new McpServer({
  name: "m2md",
  version: "0.1.0",
});

server.tool(
  "describe_image",
  "Analyze an image file and return structured markdown with AI-generated description, extracted text, and metadata",
  {
    filePath: z.string().describe("Absolute path to the image file"),
    provider: z.enum(["anthropic", "openai"]).optional().describe("AI provider (default: anthropic)"),
    model: z.string().optional().describe("AI model to use"),
    persona: z.string().optional().describe("Persona: brand, design, developer, accessibility, marketing"),
    prompt: z.string().optional().describe("Custom prompt (overrides persona)"),
    note: z.string().optional().describe("Focus directive — additional aspects to note"),
    template: z.string().optional().describe("Template: default, minimal, alt-text, detailed"),
  },
  async ({ filePath, provider: providerName, model, persona, prompt, note, template: templateName }) => {
    try {
      const name = providerName ?? "anthropic";
      const defaultModel = name === "openai" ? DEFAULT_OPENAI_MODEL : DEFAULT_ANTHROPIC_MODEL;
      const resolvedModel = model ?? defaultModel;

      const providerInstance: Provider = name === "openai"
        ? new OpenAIProvider()
        : new AnthropicProvider();

      const template = await loadTemplate(templateName);

      const result = await processFile(filePath, {
        model: resolvedModel,
        persona,
        prompt,
        note,
        template,
        templateName,
        provider: providerInstance,
        providerName: name,
      });

      return {
        content: [{ type: "text" as const, text: result.markdown }],
      };
    } catch (err) {
      return {
        content: [{ type: "text" as const, text: `Error: ${(err as Error).message}` }],
        isError: true,
      };
    }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  process.stderr.write(`m2md MCP server error: ${err}\n`);
  process.exit(1);
});
