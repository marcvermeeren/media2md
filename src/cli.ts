import { Command } from "commander";
import pc from "picocolors";
import { processFile } from "./processor.js";
import { AnthropicProvider, DEFAULT_ANTHROPIC_MODEL } from "./providers/anthropic.js";
import { getSupportedFormats } from "./extractors/metadata.js";
import * as logger from "./utils/logger.js";

const program = new Command();

program
  .name("media2md")
  .description("Convert images to structured markdown with AI vision")
  .version("0.1.0")
  .argument("<file>", "Image file to process")
  .option("-m, --model <model>", "AI model to use", DEFAULT_ANTHROPIC_MODEL)
  .option("-p, --persona <persona>", "Additional context for the AI analyst")
  .option("-v, --verbose", "Show detailed processing info")
  .addHelpText(
    "after",
    `
${pc.bold("Examples:")}
  ${pc.dim("$")} media2md screenshot.png
  ${pc.dim("$")} media2md photo.jpg --model claude-opus-4-6
  ${pc.dim("$")} media2md diagram.png --persona "Focus on architecture patterns"
  ${pc.dim("$")} media2md screenshot.png | pbcopy

${pc.bold("Environment:")}
  ANTHROPIC_API_KEY    Your Anthropic API key (required)
                       Get one at ${pc.underline("https://console.anthropic.com/settings/keys")}

${pc.bold("Supported formats:")} ${getSupportedFormats().join(", ")}
`
  )
  .action(async (file: string, opts: { model: string; persona?: string; verbose?: boolean }) => {
    // Check for API key
    if (!process.env.ANTHROPIC_API_KEY) {
      process.stderr.write(
        `\n${pc.bold(pc.red("No API key found."))}\n\n` +
          `media2md requires an Anthropic API key to analyze images.\n\n` +
          `${pc.bold("Quick setup:")}\n` +
          `  1. Get a key at ${pc.underline("https://console.anthropic.com/settings/keys")}\n` +
          `  2. Add to your shell profile:\n\n` +
          `     ${pc.cyan('export ANTHROPIC_API_KEY="sk-ant-..."')}\n\n` +
          `  Or run: ${pc.cyan("media2md setup")}\n\n`
      );
      process.exit(1);
    }

    const provider = new AnthropicProvider();

    try {
      logger.startSpinner("Analyzing image...");

      const result = await processFile(file, {
        model: opts.model,
        persona: opts.persona,
        provider,
      });

      logger.succeedSpinner(
        `Processed ${pc.bold(result.metadata.filename)} (${result.metadata.sizeHuman})`
      );

      if (opts.verbose) {
        logger.info(`Format: ${result.metadata.format} | ${result.metadata.width}x${result.metadata.height}`);
        logger.info(`Model: ${opts.model}`);
        logger.info(`Extracted ${result.extractedText.length} text segments`);
      }

      // Output markdown to stdout (only thing that goes to stdout)
      process.stdout.write(result.markdown);
    } catch (err) {
      logger.stopSpinner();

      if (err instanceof Error) {
        const msg = err.message;

        // Anthropic SDK error handling
        if ("status" in err) {
          const status = (err as { status: number }).status;
          if (status === 401) {
            logger.error("Invalid API key. Check your ANTHROPIC_API_KEY.");
          } else if (status === 400) {
            logger.error(`API rejected the request: ${msg}`);
          } else if (status === 403) {
            logger.error(`Access denied: ${msg}`);
          } else {
            logger.error(`API error (${status}): ${msg}`);
          }
        } else {
          logger.error(msg);
        }
      } else {
        logger.error("An unexpected error occurred.");
      }

      process.exit(1);
    }
  });

// Setup subcommand
program
  .command("setup")
  .description("Configure API key and verify setup")
  .action(async () => {
    process.stderr.write(`\n${pc.bold("media2md setup")}\n\n`);

    if (process.env.ANTHROPIC_API_KEY) {
      logger.success("ANTHROPIC_API_KEY is set");

      logger.startSpinner("Verifying API key...");
      try {
        const { default: Anthropic } = await import("@anthropic-ai/sdk");
        const client = new Anthropic();
        await client.messages.create({
          model: DEFAULT_ANTHROPIC_MODEL,
          max_tokens: 10,
          messages: [{ role: "user", content: "Hi" }],
        });
        logger.succeedSpinner("API key is valid");
        process.stderr.write(`\n${pc.green("You're all set!")} Try: ${pc.cyan("media2md <image>")}\n\n`);
      } catch {
        logger.stopSpinner();
        logger.error("API key is invalid or expired");
        process.stderr.write(
          `\nGet a new key at ${pc.underline("https://console.anthropic.com/settings/keys")}\n\n`
        );
        process.exit(1);
      }
    } else {
      logger.warn("ANTHROPIC_API_KEY is not set");
      process.stderr.write(
        `\n${pc.bold("To set up:")}\n` +
          `  1. Get a key at ${pc.underline("https://console.anthropic.com/settings/keys")}\n` +
          `  2. Add to your shell profile (~/.zshrc or ~/.bashrc):\n\n` +
          `     ${pc.cyan('export ANTHROPIC_API_KEY="sk-ant-..."')}\n\n` +
          `  3. Reload your shell: ${pc.cyan("source ~/.zshrc")}\n` +
          `  4. Verify: ${pc.cyan("media2md setup")}\n\n`
      );
      process.exit(1);
    }
  });

program.parse();
