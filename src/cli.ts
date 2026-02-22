// Suppress Node.js punycode deprecation warning from dependencies
process.removeAllListeners("warning");
const _origEmit = process.emit;
// @ts-expect-error -- monkey-patch to filter a single noisy warning
process.emit = function (event: string, ...args: unknown[]) {
  if (event === "warning" && (args[0] as { name?: string })?.name === "DeprecationWarning") {
    return false;
  }
  return _origEmit.apply(process, [event, ...args] as Parameters<typeof _origEmit>);
};

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
import { stripFrontmatter } from "./templates/engine.js";
import { discoverImages, runBatch, type BatchResult } from "./batch.js";
import { sidecarPath, formatOutputPath, writeMarkdown } from "./output/writer.js";
import { clearCache, getCacheStats, buildCacheKey, getCached } from "./cache/store.js";
import { extractMetadata, mimeTypeFromExtension } from "./extractors/metadata.js";
import { estimateCost, estimateImageTokens, formatCost, calculateCost, formatModel } from "./cost.js";
import { isUrl, fetchImage, screenshotPage, ContentTypeError } from "./url.js";
import { buildCompareSystemPrompt, buildCompareUserPrompt, formatCompareMarkdown } from "./prompts.js";
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
  .version(`\n  ${pc.cyan(pc.bold("m2md"))} ${pc.dim("v0.2.1")}\n`)
  .argument("[files...]", "Image file(s) or directory to process")
.option("--provider <provider>", "AI provider: anthropic, openai")
  .option("-m, --model <model>", "AI model to use")
  .option("--tier <tier>", "Preset tier: fast (gpt-4o-mini), quality (claude-sonnet)")
  .option("-p, --prompt <prompt>", "Custom instructions for the model")
  .option("-n, --note <note>", "Focus directive — additional aspects for the LLM to note")
  .option("-t, --template <template>", "Template: default, minimal, alt-text, detailed, or path")
  .option("-o, --output <dir>", "Output directory for .md files (default: next to image)")
  .option("--name <pattern>", "Output filename pattern: {filename}, {date}, {type}, {subject}")
  .option("-r, --recursive", "Recursively scan directories")
  .option("--stdout", "Output to stdout instead of writing files")
  .option("--no-frontmatter", "Strip YAML frontmatter from output")
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
  ${pc.dim("$")} m2md diagram.png --template minimal      ${pc.dim("# minimal output")}
  ${pc.dim("$")} m2md photo.jpg -p "List all products"   ${pc.dim("# custom instructions")}
  ${pc.dim("$")} m2md photo.jpg --provider openai         ${pc.dim("# use OpenAI GPT-4o")}
  ${pc.dim("$")} m2md photo.jpg --tier fast              ${pc.dim("# quick + cheap (gpt-4o-mini)")}
  ${pc.dim("$")} m2md photo.jpg --tier quality           ${pc.dim("# best results (claude-sonnet)")}

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

    if (files.length === 0) {
      logger.blank();
      logger.error("No input specified. Provide image files or a URL.");
      logger.blank();
      process.exit(1);
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
    const noFrontmatter = opts.frontmatter === false;
    const applyFrontmatter = (md: string) => noFrontmatter ? stripFrontmatter(md) : md;

    // Provider size limits (base64 encoding adds ~33%)
    const PROVIDER_LIMITS: Record<string, number> = {
      anthropic: 5 * 1024 * 1024,
      openai: 20 * 1024 * 1024,
    };
    const primaryLimit = PROVIDER_LIMITS[providerName] ?? Infinity;
    const altProviderName = providerName === "anthropic" ? "openai" : "anthropic";
    const altApiKeyEnv = altProviderName === "openai" ? "OPENAI_API_KEY" : "ANTHROPIC_API_KEY";
    const altAvailable = !!process.env[altApiKeyEnv];
    const altLimit = PROVIDER_LIMITS[altProviderName] ?? Infinity;

    // Build unified work items: local files + URLs
    type WorkItem = {
      kind: "file"; path: string; useAlt?: boolean;
    } | {
      kind: "url"; url: string; useAlt?: boolean;
    };
    const workItems: WorkItem[] = [
      ...imagePaths.map((p): WorkItem => ({ kind: "file", path: p })),
      ...urlInputs.map((u): WorkItem => ({ kind: "url", url: u })),
    ];

    // Pre-flight size check for local files
    const oversized: { item: WorkItem; size: number; filename: string }[] = [];
    for (const item of workItems) {
      if (item.kind !== "file") continue;
      const s = await stat(resolve(item.path)).catch(() => null);
      if (s && s.size > primaryLimit) {
        oversized.push({ item, size: s.size, filename: item.path.split("/").pop() ?? item.path });
      }
    }

    if (oversized.length > 0) {
      const limitMB = (primaryLimit / (1024 * 1024)).toFixed(0);
      logger.blank();
      logger.warn(
        `${oversized.length} file${oversized.length > 1 ? "s" : ""} exceed${oversized.length === 1 ? "s" : ""} ` +
        `${providerName}'s ${limitMB} MB limit:`
      );
      for (const { filename, size } of oversized) {
        const sizeMB = (size / (1024 * 1024)).toFixed(1);
        logger.info(`  ${pc.dim("•")} ${filename} ${pc.dim(`(${sizeMB} MB)`)}`);
      }

      if (altAvailable) {
        const altLimitMB = (altLimit / (1024 * 1024)).toFixed(0);
        const canFit = oversized.filter((o) => o.size <= altLimit);
        const cantFit = oversized.filter((o) => o.size > altLimit);

        if (canFit.length > 0) {
          const altModel = altProviderName === "openai" ? DEFAULT_OPENAI_MODEL : DEFAULT_ANTHROPIC_MODEL;
          logger.info(
            `  Using ${brand(altProviderName)} (${altLimitMB} MB limit) for ${canFit.length === oversized.length ? "these" : `${canFit.length} of these`}`
          );
          for (const { item } of canFit) {
            item.useAlt = true;
          }
        }
        if (cantFit.length > 0) {
          logger.warn(`  ${cantFit.length} file${cantFit.length > 1 ? "s" : ""} exceed even ${altProviderName}'s ${altLimitMB} MB limit — skipping`);
        }
      } else {
        logger.info(`  Skipping — set ${brand(altApiKeyEnv)} to auto-fallback to ${altProviderName}`);
      }
    }

    // Remove items that can't be processed by any provider
    const skippedFiles = new Set<string>();
    const filteredItems = workItems.filter((item) => {
      if (item.kind !== "file") return true;
      const ov = oversized.find((o) => o.item === item);
      if (!ov) return true; // under limit
      if (item.useAlt) return true; // will use alt provider
      skippedFiles.add(ov.filename);
      return false;
    });

    if (filteredItems.length === 0 && skippedFiles.size > 0) {
      logger.blank();
      logger.error("All files exceed the provider size limit.");
      logger.blank();
      process.exit(1);
    }

    const altProvider: Provider | undefined = filteredItems.some((i) => i.useAlt)
      ? (altProviderName === "openai" ? new OpenAIProvider() : new AnthropicProvider())
      : undefined;
    const altModel = altProviderName === "openai" ? DEFAULT_OPENAI_MODEL : DEFAULT_ANTHROPIC_MODEL;

    const makeProcessOpts = (item: WorkItem) => ({
      model: item.useAlt ? altModel : opts.model,
      prompt: opts.prompt,
      note: opts.note,
      template,
      templateName: opts.template,
      noCache: opts.cache === false,
      provider: item.useAlt && altProvider ? altProvider : provider,
      providerName: item.useAlt ? altProviderName : providerName,
    });

    if (toStdout) {
      // Stdout mode
      const results: BatchResult[] = [];

      const stdoutTotal = filteredItems.length;
      logger.blank();
      for (let i = 0; i < filteredItems.length; i++) {
        const item = filteredItems[i];
        const label = item.kind === "file" ? (item.path.split("/").pop() ?? item.path) : item.url;
        const prefix = stdoutTotal > 1 ? `${pc.dim(`[${i + 1}/${stdoutTotal}]`)} ` : "";
        try {
          const itemOpts = makeProcessOpts(item);
          logger.startSpinner(`${prefix}Analyzing ${accent(label)}${item.useAlt ? pc.dim(` (${altProviderName})`) : ""}`);

          let result;
          if (item.kind === "file") {
            result = await processFile(item.path, itemOpts);
          } else {
            const fetched = await fetchUrl(item.url);
            result = await processBuffer(fetched, itemOpts);
          }

          logger.succeedSpinner(result.cached ? `${prefix}${label} ${pc.dim("(cached)")}` : `${prefix}${label}`);
          results.push({ file: label, success: true });

          process.stdout.write(applyFrontmatter(result.markdown));
          if (filteredItems.length > 1) {
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
      if (failed > 0) {
        process.exit(2);
      }
    } else {
      // Sidecar mode (default) — sequential for clean spinner output
      const total = filteredItems.length;
      const results: (BatchResult & { cached?: boolean })[] = [];
      let totalInputTokens = 0;
      let totalOutputTokens = 0;
      let resolvedModel: string | undefined;
      const startTime = Date.now();

      logger.blank();
      for (let i = 0; i < filteredItems.length; i++) {
        const item = filteredItems[i];
        const label = item.kind === "file" ? (item.path.split("/").pop() ?? item.path) : item.url;
        const filename = item.kind === "file" ? (item.path.split("/").pop() ?? item.path) : undefined;
        const prefix = total > 1 ? `${pc.dim(`[${i + 1}/${total}]`)} ` : "";
        // Progress is shown by the [i/total] prefix — no inline bar needed

        try {
          const itemOpts = makeProcessOpts(item);
          logger.startSpinner(`${prefix}Analyzing ${accent(label)}${item.useAlt ? pc.dim(` (${altProviderName})`) : ""}`);

          let result;
          let fetchedBuffer: { buffer: Buffer; filename: string } | undefined;
          if (item.kind === "file") {
            result = await processFile(item.path, itemOpts);
          } else {
            const fetched = await fetchUrl(item.url);
            fetchedBuffer = fetched;
            result = await processBuffer(fetched, itemOpts);
          }

          if (result.usage) {
            totalInputTokens += result.usage.inputTokens;
            totalOutputTokens += result.usage.outputTokens;
          }
          if (result.model) {
            resolvedModel = result.model;
          }

          if (item.kind === "file") {
            const outPath = opts.name
              ? formatOutputPath(item.path, opts.name as string, {
                  date: new Date().toISOString().split("T")[0],
                  type: result.type,
                  subject: result.subject,
                }, opts.output)
              : sidecarPath(item.path, opts.output);
            if (!result.cached) {
              logger.updateSpinner(`${prefix}Writing ${accent(filename!)}`);
            }
            await writeMarkdown(applyFrontmatter(result.markdown), outPath);
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
            const imgPath = resolve(outDir, imgName);
            const outPath = opts.name
              ? formatOutputPath(imgPath, opts.name as string, {
                  date: new Date().toISOString().split("T")[0],
                  type: result.type,
                  subject: result.subject,
                })
              : resolve(outDir, result.metadata.basename + ".md");
            const outName = outPath.split("/").pop() ?? result.metadata.basename + ".md";

            // Save the downloaded image
            if (fetchedBuffer) {
              await writeFile(imgPath, fetchedBuffer.buffer);
            }

            if (!result.cached) {
              logger.updateSpinner(`${prefix}Writing ${accent(outName)}`);
            }
            await writeMarkdown(applyFrontmatter(result.markdown), outPath);
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
        if (skippedFiles.size > 0) parts.push(`${pc.dim(`${skippedFiles.size} skipped (too large)`)}`);
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

    const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;
    const hasOpenAI = !!process.env.OPENAI_API_KEY;
    let anyValid = false;

    // Check Anthropic
    if (hasAnthropic) {
      logger.success("ANTHROPIC_API_KEY is set");
      logger.startSpinner("Verifying Anthropic key...");
      try {
        const { default: Anthropic } = await import("@anthropic-ai/sdk");
        const client = new Anthropic();
        await client.messages.create({
          model: DEFAULT_ANTHROPIC_MODEL,
          max_tokens: 10,
          messages: [{ role: "user", content: "Hi" }],
        });
        logger.succeedSpinner("Anthropic key is valid");
        anyValid = true;
      } catch {
        logger.stopSpinner();
        logger.error("Anthropic key is invalid or expired");
      }
    } else {
      logger.warn("ANTHROPIC_API_KEY is not set");
    }

    // Check OpenAI
    if (hasOpenAI) {
      logger.success("OPENAI_API_KEY is set");
      logger.startSpinner("Verifying OpenAI key...");
      try {
        const { default: OpenAI } = await import("openai");
        const client = new OpenAI();
        await client.chat.completions.create({
          model: DEFAULT_OPENAI_MODEL,
          max_tokens: 10,
          messages: [{ role: "user", content: "Hi" }],
        });
        logger.succeedSpinner("OpenAI key is valid");
        anyValid = true;
      } catch {
        logger.stopSpinner();
        logger.error("OpenAI key is invalid or expired");
      }
    } else {
      logger.warn("OPENAI_API_KEY is not set");
    }

    logger.blank();
    if (anyValid) {
      process.stderr.write(`  ${pc.green("You're all set!")} Try: ${brand("m2md <image>")}\n`);
      logger.blank();
    } else {
      process.stderr.write(`  ${brand(pc.bold("To set up:"))}\n`);
      process.stderr.write(`  ${pc.dim("1.")} Get a key:\n`);
      process.stderr.write(`     Anthropic: ${brand(pc.underline("https://console.anthropic.com/settings/keys"))}\n`);
      process.stderr.write(`     OpenAI:    ${brand(pc.underline("https://platform.openai.com/api-keys"))}\n`);
      process.stderr.write(`  ${pc.dim("2.")} Add to your shell profile ${pc.dim("(~/.zshrc or ~/.bashrc)")}:\n`);
      logger.blank();
      process.stderr.write(`     ${brand('export ANTHROPIC_API_KEY="sk-ant-..."')}\n`);
      process.stderr.write(`     ${brand('export OPENAI_API_KEY="sk-..."')}\n`);
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
  .option("-p, --prompt <prompt>", "Custom instructions for the model")
  .option("-n, --note <note>", "Focus directive")
  .option("-t, --template <template>", "Template: default, minimal, alt-text, detailed, or path")
  .option("-o, --output <dir>", "Output directory for .md files")
  .option("--name <pattern>", "Output filename pattern: {filename}, {date}, {type}, {subject}")
  .option("--no-frontmatter", "Strip YAML frontmatter from output")
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
      prompt: opts.prompt as string | undefined,
      note: opts.note as string | undefined,
      template: opts.template as string | undefined,
      output: opts.output as string | undefined,
      namePattern: opts.name as string | undefined,
      noFrontmatter: opts.frontmatter === false,
      noCache: opts.cache === false,
      verbose: opts.verbose === true,
    });
  });

// Compare subcommand
program
  .command("compare")
  .description("Compare two or more images side by side")
  .argument("<files...>", "Image files to compare (2 or more)")
  .option("--provider <provider>", "AI provider: anthropic, openai")
  .option("-m, --model <model>", "AI model to use")
  .option("--tier <tier>", "Preset tier: fast (gpt-4o-mini), quality (claude-sonnet)")
  .option("-n, --note <note>", "Focus directive")
  .option("-o, --output <file>", "Output file path (default: stdout)")
  .action(async (files: string[], cliOpts) => {
    const config = await loadConfig();
    const opts = mergeOptions(cliOpts, config);
    resolveTier(opts, config);

    if (files.length < 2) {
      logger.blank();
      logger.error("Compare requires at least 2 images.");
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

    try {
      // Load images
      const images: { buffer: Buffer; mimeType: string; filename: string }[] = [];
      for (const file of files) {
        const absPath = resolve(file);
        const { metadata, buffer } = await extractMetadata(absPath);
        images.push({
          buffer,
          mimeType: mimeTypeFromExtension(metadata.extension),
          filename: metadata.filename,
        });
      }

      const filenames = images.map((img) => img.filename);
      const labels = filenames.map((f, i) => `${accent(f)} (${String.fromCharCode(65 + i)})`);

      logger.blank();
      logger.startSpinner(`Comparing ${labels.join(pc.dim(" vs "))}`);

      const systemPrompt = buildCompareSystemPrompt(opts.note as string | undefined);
      const userPrompt = buildCompareUserPrompt(filenames);

      const response = await provider.compare(
        images.map((img) => ({
          buffer: img.buffer,
          mimeType: img.mimeType as "image/png" | "image/jpeg" | "image/webp" | "image/gif",
          filename: img.filename,
        })),
        { model: opts.model as string, systemPrompt, userPrompt }
      );

      logger.succeedSpinner(`Compared ${filenames.join(pc.dim(" vs "))}`);

      // Format the comparison markdown
      const markdown = formatCompareMarkdown(response.rawText, filenames);

      if (opts.output) {
        const { writeMarkdown } = await import("./output/writer.js");
        await writeMarkdown(markdown, resolve(opts.output as string));
        logger.success(`Written to ${accent(opts.output as string)}`);
      } else {
        process.stdout.write(markdown);
      }

      if (response.usage) {
        const modelLabel = response.model ? formatModel(response.model) : formatModel(opts.model as string);
        const totalTokens = response.usage.inputTokens + response.usage.outputTokens;
        const tokenStr = totalTokens >= 1000 ? `${(totalTokens / 1000).toFixed(1)}K` : totalTokens.toString();
        logger.info(pc.dim(`${modelLabel} · ${tokenStr} tokens`));
      }
      logger.blank();
    } catch (err) {
      logger.stopSpinner();
      handleError(err);
      process.exit(1);
    }
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

function friendlyApiMessage(msg: string): string {
  let text = msg;

  // Try to extract the nested error message from JSON API responses
  try {
    const parsed = JSON.parse(text);
    if (parsed?.error?.message) text = parsed.error.message;
  } catch {
    // Not JSON — check if it contains an embedded JSON body
    const jsonMatch = text.match(/\{[\s\S]*"message"\s*:\s*"([^"]+)"/);
    if (jsonMatch) text = jsonMatch[1];
  }

  // Strip internal API path prefixes like "messages.0.content.0.image.source.base64: "
  text = text.replace(/^messages\.\d+\.content\.\d+\.\S+:\s*/, "");

  return text;
}

function handleError(err: unknown): void {
  if (err instanceof Error) {
    const msg = err.message;
    if ("status" in err) {
      const status = (err as { status: number }).status;
      const friendly = friendlyApiMessage(msg);
      if (status === 401) {
        logger.error("Invalid API key. Check your ANTHROPIC_API_KEY.");
      } else if (status === 400) {
        // Detect image size errors and add helpful context
        if (/image exceeds|too large|payload too large/i.test(friendly)) {
          logger.error(`Image too large: ${friendly}`);
          logger.info(pc.dim("Anthropic limit is 5 MB per image. OpenAI supports up to 20 MB."));
        } else {
          logger.error(`API rejected the request: ${friendly}`);
        }
      } else if (status === 403) {
        logger.error(`Access denied: ${friendly}`);
      } else {
        logger.error(`API error (${status}): ${friendly}`);
      }
    } else {
      logger.error(msg);
    }
  } else {
    logger.error("An unexpected error occurred.");
  }
}

program.parse();
