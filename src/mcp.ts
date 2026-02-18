import { execSync } from "node:child_process";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { processFile } from "./processor.js";
import { loadTemplate } from "./templates/loader.js";
import { AnthropicProvider, DEFAULT_ANTHROPIC_MODEL } from "./providers/anthropic.js";
import { OpenAIProvider, DEFAULT_OPENAI_MODEL } from "./providers/openai.js";
import type { Provider } from "./providers/types.js";

/**
 * Resolve API keys that aren't in the environment.
 * GUI apps like Claude Desktop don't inherit shell env vars,
 * so we spawn a login shell to extract them.
 */
function resolveEnvKeys(): void {
  const keys = ["ANTHROPIC_API_KEY", "OPENAI_API_KEY"];
  const missing = keys.filter((k) => !process.env[k]);
  if (missing.length === 0) return;

  try {
    // Source common shell profile files to find API keys.
    // Can't use -i (interactive) as it outputs prompts that corrupt MCP stdio.
    const home = process.env.HOME ?? "";
    const rcFiles = [
      `${home}/.zshrc`,
      `${home}/.bashrc`,
      `${home}/.zprofile`,
      `${home}/.bash_profile`,
      `${home}/.profile`,
    ];
    const sources = rcFiles
      .map((f) => `[ -f "${f}" ] && . "${f}" 2>/dev/null`)
      .join("; ");
    const prints = missing.map((k) => `echo "${k}=$\{${k}:-}"`).join("; ");
    const output = execSync(`/bin/sh -c '${sources}; ${prints}'`, {
      encoding: "utf-8",
      timeout: 3000,
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();

    for (const line of output.split("\n")) {
      const eq = line.indexOf("=");
      if (eq === -1) continue;
      const key = line.slice(0, eq);
      const value = line.slice(eq + 1);
      if (value && missing.includes(key)) {
        process.env[key] = value;
      }
    }
  } catch {
    // Silent — keys may just not be configured
  }
}

resolveEnvKeys();

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

      const apiKeyEnv = name === "openai" ? "OPENAI_API_KEY" : "ANTHROPIC_API_KEY";
      if (!process.env[apiKeyEnv]) {
        throw new Error(
          `${apiKeyEnv} is not set. Add it to your shell profile or pass it via the MCP server env config.`
        );
      }

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
