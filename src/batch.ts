import { readdir, stat } from "node:fs/promises";
import { join, resolve, extname } from "node:path";
import { isSupportedFormat } from "./extractors/metadata.js";

export interface DiscoverOptions {
  recursive?: boolean;
}

export async function discoverImages(
  inputs: string[],
  options: DiscoverOptions = {}
): Promise<string[]> {
  const files: string[] = [];

  for (const input of inputs) {
    const absPath = resolve(input);
    const fileStat = await stat(absPath).catch(() => null);

    if (!fileStat) {
      // Could be a glob that was already expanded by the shell — skip missing
      continue;
    }

    if (fileStat.isDirectory()) {
      const found = await scanDirectory(absPath, options.recursive ?? false);
      files.push(...found);
    } else if (fileStat.isFile() && isSupportedFormat(absPath)) {
      files.push(absPath);
    }
  }

  return files.sort();
}

async function scanDirectory(
  dir: string,
  recursive: boolean
): Promise<string[]> {
  const files: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isFile() && isSupportedFormat(entry.name)) {
      files.push(fullPath);
    } else if (entry.isDirectory() && recursive) {
      try {
        const sub = await scanDirectory(fullPath, true);
        files.push(...sub);
      } catch {
        // Directory may have been removed between listing and scanning
      }
    }
  }

  return files;
}

export interface BatchResult {
  file: string;
  success: boolean;
  outputPath?: string;
  error?: string;
}

export async function runBatch<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>
): Promise<void> {
  const queue = [...items];
  const workers: Promise<void>[] = [];

  for (let i = 0; i < Math.min(concurrency, items.length); i++) {
    workers.push(
      (async () => {
        while (queue.length > 0) {
          const item = queue.shift()!;
          await fn(item);
        }
      })()
    );
  }

  await Promise.all(workers);
}
