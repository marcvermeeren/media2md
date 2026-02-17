import { Command } from "commander";
import { resolve } from "node:path";
import { stat } from "node:fs/promises";
import pc from "picocolors";
import { processFile } from "./processor.js";
import { AnthropicProvider, DEFAULT_ANTHROPIC_MODEL } from "./providers/anthropic.js";
import { getSupportedFormats } from "./extractors/metadata.js";
import { loadTemplate } from "./templates/loader.js";
import { getPersonaNames } from "./personas/builtins.js";
import { discoverImages, runBatch, type BatchResult } from "./batch.js";
import { sidecarPath, writeMarkdown } from "./output/writer.js";
import * as logger from "./utils/logger.js";

const program = new Command();

program
  .name("media2md")
  .description("Convert images to structured markdown with AI vision")
  .version("0.1.0")
  .argument("<files...>", "Image file(s) or directory to process")
  .option("-m, --model <model>", "AI model to use", DEFAULT_ANTHROPIC_MODEL)
  .option("-p, --persona <persona>", `Persona: ${getPersonaNames().join(", ")}`)
  .option("--prompt <prompt>", "Custom prompt (overrides persona)")
  .option("-t, --template <template>", "Template: default, minimal, alt-text, detailed, or path")
  .option("-o, --output <dir>", "Output directory for .md files (default: next to image)")
  .option("-r, --recursive", "Recursively scan directories")
  .option("--stdout", "Output to stdout instead of writing files")
  .option("--concurrency <n>", "Max concurrent API calls", "5")
  .option("-v, --verbose", "Show detailed processing info")
  .addHelpText(
    "after",
    `
${pc.bold("Examples:")}
  ${pc.dim("$")} media2md screenshot.png                     ${pc.dim("# writes screenshot.md next to it")}
  ${pc.dim("$")} media2md screenshot.png -o ./docs/           ${pc.dim("# writes to docs/screenshot.md")}
  ${pc.dim("$")} media2md screenshot.png --stdout              ${pc.dim("# print to stdout")}
  ${pc.dim("$")} media2md screenshot.png --stdout | pbcopy     ${pc.dim("# copy to clipboard")}
  ${pc.dim("$")} media2md ./assets/                           ${pc.dim("# batch, .md next to each image")}
  ${pc.dim("$")} media2md ./assets/ -r -o ./docs/             ${pc.dim("# recursive, output dir")}
  ${pc.dim("$")} media2md photo.jpg --persona brand           ${pc.dim("# brand analyst lens")}
  ${pc.dim("$")} media2md diagram.png --template minimal      ${pc.dim("# minimal output")}

${pc.bold("Personas:")} ${getPersonaNames().join(", ")}

${pc.bold("Templates:")} default, minimal, alt-text, detailed, or path to .md file

${pc.bold("Environment:")}
  ANTHROPIC_API_KEY    Your Anthropic API key (required)
                       Get one at ${pc.underline("https://console.anthropic.com/settings/keys")}

${pc.bold("Supported formats:")} ${getSupportedFormats().join(", ")}
`
  )
  .action(async (files: string[], opts) => {
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

    // Load template
    let template: string;
    try {
      template = await loadTemplate(opts.template);
    } catch (err) {
      logger.error((err as Error).message);
      process.exit(1);
    }

    const provider = new AnthropicProvider();
    const concurrency = parseInt(opts.concurrency, 10) || 5;

    // Try joining args as a single path if individual files aren't found
    // Handles unquoted filenames with spaces: media2md Screenshot 2026-02-13 at 17.07.21.png
    const resolvedFiles = await resolveFileArgs(files);

    // Discover files
    const imagePaths = await discoverImages(resolvedFiles, { recursive: opts.recursive });

    if (imagePaths.length === 0) {
      logger.warn("No supported images found.");
      process.exit(0);
    }

    const toStdout = opts.stdout === true;

    if (toStdout) {
      // Stdout mode
      const results: BatchResult[] = [];
      let processed = 0;

      for (const filePath of imagePaths) {
        const filename = filePath.split("/").pop() ?? filePath;
        try {
          logger.startSpinner(`Analyzing ${filename}...`);

          const result = await processFile(filePath, {
            model: opts.model,
            persona: opts.persona,
            prompt: opts.prompt,
            template,
            provider,
          });

          logger.succeedSpinner(`Analyzed ${filename}`);
          processed++;
          results.push({ file: filePath, success: true });

          process.stdout.write(result.markdown);
          if (imagePaths.length > 1) {
            process.stdout.write("\n---\n\n");
          }
        } catch (err) {
          logger.stopSpinner();
          const msg = err instanceof Error ? err.message : "Unknown error";
          results.push({ file: filePath, success: false, error: msg });
          logger.error(`${filename}: ${msg}`);
        }
      }

      const failed = results.filter((r) => !r.success).length;
      if (failed > 0) process.exit(2);
    } else {
      // Sidecar mode (default) — sequential for clean spinner output
      const total = imagePaths.length;
      const results: BatchResult[] = [];

      for (let i = 0; i < imagePaths.length; i++) {
        const filePath = imagePaths[i];
        const filename = filePath.split("/").pop() ?? filePath;
        const prefix = total > 1 ? `[${i + 1}/${total}] ` : "";

        try {
          logger.startSpinner(`${prefix}Analyzing ${filename}...`);

          const result = await processFile(filePath, {
            model: opts.model,
            persona: opts.persona,
            prompt: opts.prompt,
            template,
            provider,
          });

          const outPath = sidecarPath(filePath, opts.output);
          const outName = outPath.split("/").pop() ?? outPath;
          logger.updateSpinner(`${prefix}Writing ${outName}...`);
          await writeMarkdown(result.markdown, outPath);

          results.push({ file: filePath, success: true, outputPath: outPath });
          logger.succeedSpinner(`${prefix}${filename} → ${outName}`);

          if (opts.verbose) {
            logger.info(`  Format: ${result.metadata.format} | ${result.metadata.width}x${result.metadata.height} | ${result.metadata.sizeHuman}`);
            logger.info(`  Extracted ${result.extractedText.length} text segments`);
          }
        } catch (err) {
          logger.stopSpinner();
          const msg = err instanceof Error ? err.message : "Unknown error";
          results.push({ file: filePath, success: false, error: msg });
          handleError(err);
        }
      }

      // Summary
      const succeeded = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success).length;

      if (failed === 0) {
        logger.success(`Done. ${succeeded} file${succeeded > 1 ? "s" : ""} processed.`);
      } else {
        logger.warn(`Done. ${succeeded} processed, ${failed} failed.`);
        process.exit(2);
      }
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

async function resolveFileArgs(args: string[]): Promise<string[]> {
  if (args.length <= 1) return args;

  // Check if individual args exist as files/dirs
  const checks = await Promise.all(
    args.map(async (a) => {
      const s = await stat(resolve(a)).catch(() => null);
      return s !== null;
    })
  );

  // If all args resolve individually, use them as-is
  if (checks.every(Boolean)) return args;

  // If none resolve, try joining them as a single path (spaces in filename)
  if (checks.every((c) => !c)) {
    const joined = args.join(" ");
    const s = await stat(resolve(joined)).catch(() => null);
    if (s !== null) return [joined];
  }

  // Mixed: return as-is, let downstream handle missing files
  return args;
}

function handleError(err: unknown): void {
  if (err instanceof Error) {
    const msg = err.message;
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
}

program.parse();
