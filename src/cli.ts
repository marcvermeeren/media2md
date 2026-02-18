import { Command } from "commander";
import { resolve } from "node:path";
import { stat, writeFile, mkdir } from "node:fs/promises";
import pc from "picocolors";
import { loadConfig, mergeOptions, resolveTier, TIER_MAP } from "./config.js";
import { processFile, processBuffer } from "./processor.js";
import { AnthropicProvider, DEFAULT_ANTHROPIC_MODEL } from "./providers/anthropic.js";
import { OpenAIProvider, DEFAULT_OPENAI_MODEL } from "./providers/openai.js";
import type { Provider } from "./providers/types.js";
import { getSupportedFormats } from "./extractors/metadata.js";
import { loadTemplate } from "./templates/loader.js";
import { getPersonaNames } from "./personas/builtins.js";
import { discoverImages, runBatch, type BatchResult } from "./batch.js";
import { sidecarPath, writeMarkdown } from "./output/writer.js";
import { clearCache, getCacheStats, buildCacheKey, getCached } from "./cache/store.js";
import { extractMetadata } from "./extractors/metadata.js";
import { estimateCost, estimateImageTokens, formatCost, calculateCost, formatModel } from "./cost.js";
import { isUrl, fetchImage, screenshotPage, ContentTypeError } from "./url.js";
import * as logger from "./utils/logger.js";
import { brand, accent } from "./utils/logger.js";

const program = new Command();

program
  .name("m2md")
  .description("Convert images to structured markdown with AI vision")
  .configureOutput({
    writeOut: (str) => process.stderr.write(str),
    writeErr: (str) => process.stderr.write(str),
    outputError: (str) => process.stderr.write(str),
  })
  .version(`\n  ${pc.cyan(pc.bold("m2md"))} ${pc.dim("v0.1.0")}\n`)
  .argument("<files...>", "Image file(s) or directory to process")
  .option("--provider <provider>", "AI provider: anthropic, openai")
  .option("-m, --model <model>", "AI model to use")
  .option("--tier <tier>", "Preset tier: fast (gpt-4o-mini), quality (claude-sonnet)")
  .option("-p, --persona <persona>", `Persona: ${getPersonaNames().join(", ")}`)
  .option("--prompt <prompt>", "Custom prompt (overrides persona)")
  .option("-n, --note <note>", "Focus directive — additional aspects for the LLM to note")
  .option("-t, --template <template>", "Template: default, minimal, alt-text, detailed, or path")
  .option("-o, --output <dir>", "Output directory for .md files (default: next to image)")
  .option("-r, --recursive", "Recursively scan directories")
  .option("--stdout", "Output to stdout instead of writing files")
  .option("--no-cache", "Skip cache, force re-processing")
  .option("--estimate", "Show estimated cost without processing")
  .option("--dry-run", "Show what would be processed without calling API")
  .option("--concurrency <n>", "Max concurrent API calls", "5")
  .option("-v, --verbose", "Show detailed processing info")
  .addHelpText(
    "after",
    `
${brand(pc.bold("Examples:"))}
  ${pc.dim("$")} m2md screenshot.png                     ${pc.dim("# writes screenshot.md next to it")}
  ${pc.dim("$")} m2md screenshot.png -o ./docs/           ${pc.dim("# writes to docs/screenshot.md")}
  ${pc.dim("$")} m2md screenshot.png --stdout              ${pc.dim("# print to stdout")}
  ${pc.dim("$")} m2md screenshot.png --stdout | pbcopy     ${pc.dim("# copy to clipboard")}
  ${pc.dim("$")} m2md ./assets/                           ${pc.dim("# batch, .md next to each image")}
  ${pc.dim("$")} m2md ./assets/ -r -o ./docs/             ${pc.dim("# recursive, output dir")}
  ${pc.dim("$")} m2md photo.jpg --persona brand           ${pc.dim("# brand analyst lens")}
  ${pc.dim("$")} m2md diagram.png --template minimal      ${pc.dim("# minimal output")}
  ${pc.dim("$")} m2md photo.jpg --provider openai         ${pc.dim("# use OpenAI GPT-4o")}
  ${pc.dim("$")} m2md photo.jpg --tier fast              ${pc.dim("# quick + cheap (gpt-4o-mini)")}
  ${pc.dim("$")} m2md photo.jpg --tier quality           ${pc.dim("# best results (claude-sonnet)")}

${brand(pc.bold("Personas:"))} ${getPersonaNames().map((n) => accent(n)).join(pc.dim(", "))}

${brand(pc.bold("Templates:"))} ${["default", "minimal", "alt-text", "detailed"].map((n) => accent(n)).join(pc.dim(", "))}${pc.dim(", or path to .md file")}

${brand(pc.bold("Environment:"))}
  ${pc.bold("ANTHROPIC_API_KEY")}    Your Anthropic API key ${pc.dim("(required for anthropic provider)")}
                       Get one at ${brand(pc.underline("https://console.anthropic.com/settings/keys"))}
  ${pc.bold("OPENAI_API_KEY")}       Your OpenAI API key ${pc.dim("(required for openai provider)")}
                       Get one at ${brand(pc.underline("https://platform.openai.com/api-keys"))}

${brand(pc.bold("Supported formats:"))} ${getSupportedFormats().map((f) => pc.dim(f)).join(", ")}
`
  )
  .action(async (files: string[], cliOpts) => {
    // Load config file and merge with CLI options (CLI takes precedence)
    const config = await loadConfig();
    const opts = mergeOptions(cliOpts, config);

    // Resolve tier into provider/model (only fills undefined values)
    resolveTier(opts, config);

    // Validate tier if explicitly provided
    if (opts.tier && !TIER_MAP[opts.tier as string]) {
      logger.blank();
      logger.error(`Unknown tier: ${opts.tier}. Supported: ${Object.keys(TIER_MAP).join(", ")}`);
      logger.blank();
      process.exit(1);
    }

    // Resolve provider and default model
    const providerName = opts.provider ?? "anthropic";
    if (providerName !== "anthropic" && providerName !== "openai") {
      logger.blank();
      logger.error(`Unknown provider: ${providerName}. Supported: anthropic, openai`);
      logger.blank();
      process.exit(1);
    }
    const defaultModel = providerName === "openai" ? DEFAULT_OPENAI_MODEL : DEFAULT_ANTHROPIC_MODEL;
    if (!opts.model) {
      opts.model = defaultModel;
    }

    // Try joining args as a single path if individual files aren't found
    // Handles unquoted filenames with spaces: m2md Screenshot 2026-02-13 at 17.07.21.png
    const resolvedFiles = await resolveFileArgs(files);

    // Split URLs from file paths
    const urlInputs = resolvedFiles.filter(isUrl);
    const fileInputs = resolvedFiles.filter((f) => !isUrl(f));

    // Discover local files
    const imagePaths = fileInputs.length > 0
      ? await discoverImages(fileInputs, { recursive: opts.recursive })
      : [];

    if (imagePaths.length === 0 && urlInputs.length === 0) {
      logger.blank();
      logger.warn("No supported images found.");
      logger.blank();
      process.exit(0);
    }

    // --estimate: show cost preview and exit
    if (opts.estimate || opts.dryRun) {
      const items: { metadata: Awaited<ReturnType<typeof extractMetadata>>["metadata"]; cached: boolean; path: string }[] = [];

      for (const filePath of imagePaths) {
        const { metadata } = await extractMetadata(filePath);
        const key = buildCacheKey(metadata.sha256, {
          model: opts.model,
          persona: opts.persona,
          prompt: opts.prompt,
          templateName: opts.template,
          note: opts.note,
          provider: providerName,
        });
        const cached = opts.cache !== false ? (await getCached(key)) !== null : false;
        items.push({ metadata, cached, path: filePath });
      }

      if (opts.dryRun) {
        logger.header("Dry run");

        const newCount = items.filter((item) => !item.cached).length;
        let totalEstTokens = 0;

        const rows = items.map((item) => {
          const name = item.path.split("/").pop() ?? item.path;
          const status = item.cached ? pc.dim("cached") : pc.green("new");
          const size = item.metadata.sizeHuman;
          let estTokens: string;
          if (item.cached) {
            estTokens = pc.dim("—");
          } else {
            const tokens = estimateImageTokens(item.metadata);
            totalEstTokens += tokens;
            estTokens = `~${tokens.toLocaleString()}`;
          }
          return [name, status, size, estTokens];
        });

        const footer = [
          `${items.length} file${items.length !== 1 ? "s" : ""}`,
          newCount > 0 ? `${newCount} new` : "",
          "",
          totalEstTokens > 0 ? `~${totalEstTokens.toLocaleString()}` : "",
        ];

        logger.table(
          [
            { header: "File" },
            { header: "Status" },
            { header: "Size", align: "right" },
            { header: "Est. tokens", align: "right" },
          ],
          rows,
          footer,
        );
      }

      const estimate = estimateCost(items, opts.model);
      logger.blank();
      logger.summary(formatCost(estimate).split("\n"));

      if (!opts.dryRun) {
        logger.info(`Run without ${brand("--estimate")} to process.`);
        logger.blank();
      }
      process.exit(0);
    }

    // Check for API key (after estimate/dry-run which don't need it)
    const apiKeyEnv = providerName === "openai" ? "OPENAI_API_KEY" : "ANTHROPIC_API_KEY";
    if (!process.env[apiKeyEnv]) {
      const keyUrls: Record<string, string> = {
        anthropic: "https://console.anthropic.com/settings/keys",
        openai: "https://platform.openai.com/api-keys",
      };
      const examples: Record<string, string> = {
        anthropic: 'export ANTHROPIC_API_KEY="sk-ant-..."',
        openai: 'export OPENAI_API_KEY="sk-..."',
      };
      logger.blank();
      process.stderr.write(`  ${pc.bold(pc.red("No API key found."))}\n`);
      logger.blank();
      process.stderr.write(`  m2md requires ${brand(apiKeyEnv)} for the ${providerName} provider.\n`);
      logger.blank();
      process.stderr.write(`  ${brand(pc.bold("Quick setup:"))}\n`);
      process.stderr.write(`  ${pc.dim("1.")} Get a key at ${brand(pc.underline(keyUrls[providerName]))}\n`);
      process.stderr.write(`  ${pc.dim("2.")} Add to your shell profile:\n`);
      logger.blank();
      process.stderr.write(`     ${brand(examples[providerName])}\n`);
      logger.blank();
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

    const provider: Provider = providerName === "openai" ? new OpenAIProvider() : new AnthropicProvider();
    const concurrency = parseInt(opts.concurrency, 10) || 5;
    const toStdout = opts.stdout === true;

    // Build unified work items: local files + URLs
    type WorkItem = { kind: "file"; path: string } | { kind: "url"; url: string };
    const workItems: WorkItem[] = [
      ...imagePaths.map((p): WorkItem => ({ kind: "file", path: p })),
      ...urlInputs.map((u): WorkItem => ({ kind: "url", url: u })),
    ];

    const processOpts = {
      model: opts.model,
      persona: opts.persona,
      prompt: opts.prompt,
      note: opts.note,
      template,
      templateName: opts.template,
      noCache: opts.cache === false,
      provider,
      providerName,
    };

    if (toStdout) {
      // Stdout mode
      const results: BatchResult[] = [];

      const stdoutTotal = workItems.length;
      logger.blank();
      for (let i = 0; i < workItems.length; i++) {
        const item = workItems[i];
        const label = item.kind === "file" ? (item.path.split("/").pop() ?? item.path) : item.url;
        const prefix = stdoutTotal > 1 ? `${pc.dim(`[${i + 1}/${stdoutTotal}]`)} ` : "";
        const barLine = stdoutTotal > 1 ? `\n\n  ${logger.progressBar(i, stdoutTotal)} ${pc.dim(`${i}/${stdoutTotal}`)}` : "";
        try {
          logger.startSpinner(`${prefix}Analyzing ${accent(label)}${barLine}`);

          let result;
          if (item.kind === "file") {
            result = await processFile(item.path, processOpts);
          } else {
            const fetched = await fetchUrl(item.url);
            result = await processBuffer(fetched, processOpts);
          }

          logger.succeedSpinner(result.cached ? `${prefix}${label} ${pc.dim("(cached)")}` : `${prefix}${label}`);
          results.push({ file: label, success: true });

          process.stdout.write(result.markdown);
          if (workItems.length > 1) {
            process.stdout.write("\n---\n\n");
          }
        } catch (err) {
          logger.stopSpinner();
          const msg = err instanceof Error ? err.message : "Unknown error";
          results.push({ file: label, success: false, error: msg });
          logger.error(`${label}: ${msg}`);
        }
      }

      const failed = results.filter((r) => !r.success).length;
      logger.blank();
      if (failed > 0) process.exit(2);
    } else {
      // Sidecar mode (default) — sequential for clean spinner output
      const total = workItems.length;
      const results: (BatchResult & { cached?: boolean })[] = [];
      let totalInputTokens = 0;
      let totalOutputTokens = 0;
      let resolvedModel: string | undefined;
      const startTime = Date.now();

      logger.blank();
      for (let i = 0; i < workItems.length; i++) {
        const item = workItems[i];
        const label = item.kind === "file" ? (item.path.split("/").pop() ?? item.path) : item.url;
        const filename = item.kind === "file" ? (item.path.split("/").pop() ?? item.path) : undefined;
        const prefix = total > 1 ? `${pc.dim(`[${i + 1}/${total}]`)} ` : "";
        const barLine = total > 1 ? `\n\n  ${logger.progressBar(i, total)} ${pc.dim(`${i}/${total}`)}` : "";

        try {
          logger.startSpinner(`${prefix}Analyzing ${accent(label)}${barLine}`);

          let result;
          let fetchedBuffer: { buffer: Buffer; filename: string } | undefined;
          if (item.kind === "file") {
            result = await processFile(item.path, processOpts);
          } else {
            const fetched = await fetchUrl(item.url);
            fetchedBuffer = fetched;
            result = await processBuffer(fetched, processOpts);
          }

          if (result.usage) {
            totalInputTokens += result.usage.inputTokens;
            totalOutputTokens += result.usage.outputTokens;
          }
          if (result.model) {
            resolvedModel = result.model;
          }

          if (item.kind === "file") {
            const outPath = sidecarPath(item.path, opts.output);
            if (!result.cached) {
              const writeBar = total > 1 ? `\n\n  ${logger.progressBar(i, total)} ${pc.dim(`${i}/${total}`)}` : "";
              logger.updateSpinner(`${prefix}Writing ${accent(filename!)}${writeBar}`);
            }
            await writeMarkdown(result.markdown, outPath);
            results.push({ file: item.path, success: true, outputPath: outPath, cached: result.cached });
            logger.succeedSpinner(
              result.cached
                ? `${prefix}${filename} ${pc.dim("→ .md (cached)")}`
                : `${prefix}${filename} ${pc.dim("→ .md")}`
            );
          } else {
            // URL: save image + write sidecar .md to output dir or cwd
            const outDir = opts.output ?? ".";
            await mkdir(resolve(outDir), { recursive: true });
            const imgName = result.metadata.filename;
            const outName = result.metadata.basename + ".md";
            const imgPath = resolve(outDir, imgName);
            const outPath = resolve(outDir, outName);

            // Save the downloaded image
            if (fetchedBuffer) {
              await writeFile(imgPath, fetchedBuffer.buffer);
            }

            if (!result.cached) {
              const writeBar = total > 1 ? `\n\n  ${logger.progressBar(i, total)} ${pc.dim(`${i}/${total}`)}` : "";
              logger.updateSpinner(`${prefix}Writing ${accent(outName)}${writeBar}`);
            }
            await writeMarkdown(result.markdown, outPath);
            results.push({ file: item.url, success: true, outputPath: outPath, cached: result.cached });
            logger.succeedSpinner(
              result.cached
                ? `${prefix}${label} ${pc.dim(`→ ${imgName} + ${outName} (cached)`)}`
                : `${prefix}${label} ${pc.dim(`→ ${imgName} + ${outName}`)}`
            );
          }

          if (opts.verbose) {
            logger.info(`Format: ${result.metadata.format} | ${result.metadata.width}x${result.metadata.height} | ${result.metadata.sizeHuman}`);
            if (result.usage) {
              logger.info(`Tokens: ${result.usage.inputTokens.toLocaleString()} in + ${result.usage.outputTokens.toLocaleString()} out`);
            }
          }
        } catch (err) {
          logger.stopSpinner();
          const msg = err instanceof Error ? err.message : "Unknown error";
          results.push({ file: label, success: false, error: msg });
          handleError(err);
        }
      }

      // Summary
      const succeeded = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success).length;
      const cachedCount = results.filter((r) => r.cached).length;
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

      logger.blank();
      if (failed === 0) {
        const parts = [`${brand(succeeded.toString())} file${succeeded > 1 ? "s" : ""} processed`];
        if (cachedCount > 0) parts.push(`${pc.dim(`${cachedCount} from cache`)}`);
        const modelLabel = resolvedModel ? formatModel(resolvedModel) : formatModel(opts.model);
        parts.push(pc.dim(modelLabel));
        if (opts.verbose && totalInputTokens > 0) {
          const totalTokens = totalInputTokens + totalOutputTokens;
          const tokenStr = totalTokens >= 1000 ? `${(totalTokens / 1000).toFixed(1)}K` : totalTokens.toString();
          parts.push(pc.dim(`${tokenStr} tokens`));
          const cost = calculateCost(totalInputTokens, totalOutputTokens, resolvedModel ?? opts.model);
          parts.push(pc.dim(`$${cost.toFixed(2)}`));
        }
        parts.push(pc.dim(`${elapsed}s`));
        logger.success(parts.join(pc.dim(" · ")));
      } else {
        logger.warn(`${succeeded} processed, ${failed} failed ${pc.dim(`· ${elapsed}s`)}`);
        process.exit(2);
      }
      logger.blank();
    }
  });

// Setup subcommand
program
  .command("setup")
  .description("Configure API key and verify setup")
  .action(async () => {
    logger.header("m2md setup");

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
        logger.blank();
        process.stderr.write(`  ${pc.green("You're all set!")} Try: ${brand("m2md <image>")}\n`);
        logger.blank();
      } catch {
        logger.stopSpinner();
        logger.error("API key is invalid or expired");
        logger.blank();
        process.stderr.write(`  Get a new key at ${brand(pc.underline("https://console.anthropic.com/settings/keys"))}\n`);
        logger.blank();
        process.exit(1);
      }
    } else {
      logger.warn("ANTHROPIC_API_KEY is not set");
      logger.blank();
      process.stderr.write(`  ${brand(pc.bold("To set up:"))}\n`);
      process.stderr.write(`  ${pc.dim("1.")} Get a key at ${brand(pc.underline("https://console.anthropic.com/settings/keys"))}\n`);
      process.stderr.write(`  ${pc.dim("2.")} Add to your shell profile ${pc.dim("(~/.zshrc or ~/.bashrc)")}:\n`);
      logger.blank();
      process.stderr.write(`     ${brand('export ANTHROPIC_API_KEY="sk-ant-..."')}\n`);
      logger.blank();
      process.stderr.write(`  ${pc.dim("3.")} Reload your shell: ${brand("source ~/.zshrc")}\n`);
      process.stderr.write(`  ${pc.dim("4.")} Verify: ${brand("m2md setup")}\n`);
      logger.blank();
      process.exit(1);
    }
  });

// Cache subcommand
const cacheCmd = program.command("cache").description("Manage the result cache");

cacheCmd
  .command("status")
  .description("Show cache stats")
  .action(async () => {
    const stats = await getCacheStats();
    logger.header("Cache");
    logger.summary([
      `  Entries   ${brand(String(stats.entries))}`,
      `  Size      ${brand(stats.sizeHuman)}`,
      `  Location  ${pc.dim(stats.cacheDir)}`,
    ]);
  });

cacheCmd
  .command("clear")
  .description("Clear all cached results")
  .action(async () => {
    const count = await clearCache();
    logger.blank();
    if (count > 0) {
      logger.success(`Cleared ${brand(String(count))} cached result${count > 1 ? "s" : ""}.`);
    } else {
      logger.info("Cache is already empty.");
    }
    logger.blank();
  });

// Watch subcommand
program
  .command("watch")
  .description("Watch a directory and auto-process new/changed images")
  .argument("<dir>", "Directory to watch")
  .option("--provider <provider>", "AI provider: anthropic, openai")
  .option("-m, --model <model>", "AI model to use")
  .option("--tier <tier>", "Preset tier: fast (gpt-4o-mini), quality (claude-sonnet)")
  .option("-p, --persona <persona>", `Persona: ${getPersonaNames().join(", ")}`)
  .option("--prompt <prompt>", "Custom prompt (overrides persona)")
  .option("-n, --note <note>", "Focus directive")
  .option("-t, --template <template>", "Template: default, minimal, alt-text, detailed, or path")
  .option("-o, --output <dir>", "Output directory for .md files")
  .option("--no-cache", "Skip cache, force re-processing")
  .option("-v, --verbose", "Show detailed processing info")
  .action(async (dir: string, cliOpts) => {
    const config = await loadConfig();
    const opts = mergeOptions(cliOpts, config);
    resolveTier(opts, config);

    if (opts.tier && !TIER_MAP[opts.tier as string]) {
      logger.blank();
      logger.error(`Unknown tier: ${opts.tier}. Supported: ${Object.keys(TIER_MAP).join(", ")}`);
      logger.blank();
      process.exit(1);
    }

    const providerName = (opts.provider as string) ?? "anthropic";
    if (providerName !== "anthropic" && providerName !== "openai") {
      logger.blank();
      logger.error(`Unknown provider: ${providerName}. Supported: anthropic, openai`);
      logger.blank();
      process.exit(1);
    }
    const defaultModel = providerName === "openai" ? DEFAULT_OPENAI_MODEL : DEFAULT_ANTHROPIC_MODEL;
    if (!opts.model) opts.model = defaultModel;

    const apiKeyEnv = providerName === "openai" ? "OPENAI_API_KEY" : "ANTHROPIC_API_KEY";
    if (!process.env[apiKeyEnv]) {
      logger.blank();
      logger.error(`${apiKeyEnv} is required for the ${providerName} provider.`);
      logger.blank();
      process.exit(1);
    }

    const provider: Provider = providerName === "openai" ? new OpenAIProvider() : new AnthropicProvider();

    // Dynamic import to keep startup fast
    const { startWatch } = await import("./watch.js");
    await startWatch(dir, {
      provider,
      providerName,
      model: opts.model as string,
      persona: opts.persona as string | undefined,
      prompt: opts.prompt as string | undefined,
      note: opts.note as string | undefined,
      template: opts.template as string | undefined,
      output: opts.output as string | undefined,
      noCache: opts.cache === false,
      verbose: opts.verbose === true,
    });
  });

async function fetchUrl(url: string): Promise<{ buffer: Buffer; filename: string; mimeType: string }> {
  try {
    return await fetchImage(url);
  } catch (err) {
    if (err instanceof ContentTypeError) {
      // Not an image — try Playwright screenshot
      return await screenshotPage(url);
    }
    throw err;
  }
}

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
