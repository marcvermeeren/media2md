import { access } from "node:fs/promises";
import { resolve } from "node:path";
import pc from "picocolors";
import { discoverImages } from "./batch.js";
import { processFile } from "./processor.js";
import { sidecarPath, writeMarkdown } from "./output/writer.js";
import { loadTemplate } from "./templates/loader.js";
import { isSupportedFormat } from "./extractors/metadata.js";
import type { Provider } from "./providers/types.js";
import * as logger from "./utils/logger.js";
import { accent, brand } from "./utils/logger.js";
import { formatModel } from "./cost.js";

export interface WatchOptions {
  provider: Provider;
  providerName: string;
  model?: string;
  persona?: string;
  prompt?: string;
  note?: string;
  template?: string;
  output?: string;
  noCache?: boolean;
  verbose?: boolean;
}

export async function startWatch(
  dir: string,
  options: WatchOptions
): Promise<void> {
  const absDir = resolve(dir);

  // Load template once
  let template: string;
  try {
    template = await loadTemplate(options.template);
  } catch (err) {
    logger.error((err as Error).message);
    process.exit(1);
  }

  // Dynamic import — fails gracefully if chokidar is removed
  let chokidar: typeof import("chokidar");
  try {
    chokidar = await import("chokidar");
  } catch {
    logger.error("Watch mode requires chokidar. Install it: npm install chokidar");
    process.exit(1);
  }

  // --- Initial pass: process files without a sidecar .md ---
  logger.blank();
  logger.header("Watch mode");
  logger.info(`Watching ${pc.bold(absDir)}`);
  logger.blank();

  const existing = await discoverImages([absDir], { recursive: true });
  let processed = 0;
  let skipped = 0;

  for (const filePath of existing) {
    const mdPath = sidecarPath(filePath, options.output);
    const exists = await access(mdPath).then(() => true, () => false);
    if (exists) {
      skipped++;
      continue;
    }
    await processOne(filePath, template, options);
    processed++;
  }

  if (processed > 0 || skipped > 0) {
    logger.info(
      `Initial scan: ${brand(String(processed))} processed, ${pc.dim(`${skipped} already had .md`)}`
    );
  } else {
    logger.info("No existing images found.");
  }

  // --- Watch loop ---
  logger.blank();
  logger.info(`Watching for changes... ${pc.dim("(Ctrl+C to stop)")}`);
  logger.blank();

  const queue = new Set<string>();
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const drain = async () => {
    const paths = [...queue];
    queue.clear();
    for (const filePath of paths) {
      await processOne(filePath, template, options);
    }
  };

  const enqueue = (filePath: string) => {
    if (!isSupportedFormat(filePath)) return;
    queue.add(filePath);
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      drain().catch((err) => {
        logger.error(`Queue error: ${(err as Error).message}`);
      });
    }, 300);
  };

  const watcher = chokidar.watch(absDir, {
    ignoreInitial: true,
    ignored: /(^|[/\\])\../, // ignore dotfiles
  });

  watcher.on("add", enqueue);
  watcher.on("change", enqueue);

  // Graceful shutdown
  let watchCount = processed;
  const shutdown = () => {
    try {
      logger.stopSpinner();
      logger.blank();
      logger.success(
        `Watch session complete: ${brand(String(watchCount))} file${watchCount !== 1 ? "s" : ""} processed`
      );
      logger.blank();
    } catch {}
    watcher.close().catch(() => {});
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  // stdin-discarder (used by ora) can leave stdin in raw mode,
  // swallowing the OS-level SIGINT. Listen for Ctrl+C bytes directly as backup.
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on("data", (data: Buffer) => {
      if (data[0] === 0x03) shutdown(); // Ctrl+C
    });
  }

  // Keep the process alive
  async function processOne(
    filePath: string,
    tpl: string,
    opts: WatchOptions
  ): Promise<void> {
    const filename = filePath.split("/").pop() ?? filePath;
    try {
      logger.startSpinner(`Analyzing ${accent(filename)}`);

      const result = await processFile(filePath, {
        model: opts.model,
        persona: opts.persona,
        prompt: opts.prompt,
        note: opts.note,
        template: tpl,
        templateName: opts.template,
        noCache: opts.noCache,
        provider: opts.provider,
        providerName: opts.providerName,
      });

      const outPath = sidecarPath(filePath, opts.output);
      await writeMarkdown(result.markdown, outPath);

      const modelLabel = result.model ? formatModel(result.model) : "";
      const cachedLabel = result.cached ? pc.dim(" (cached)") : "";
      logger.succeedSpinner(
        `${filename} ${pc.dim("→ .md")}${cachedLabel}${modelLabel ? pc.dim(` · ${modelLabel}`) : ""}`
      );

      watchCount++;
    } catch (err) {
      logger.stopSpinner();
      logger.error(`${filename}: ${(err as Error).message}`);
    }
  }
}
