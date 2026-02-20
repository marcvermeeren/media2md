import { readFile, writeFile, readdir, rm, mkdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { createHash } from "node:crypto";

export interface CacheEntry {
  hash: string;
  type: string;
  category?: string;
  style?: string;
  mood?: string;
  medium?: string;
  composition?: string;
  palette?: string;
  subject: string;
  markdown: string;
  description: string;
  extractedText: string;
  colors?: string;
  tags?: string;
  model: string;
  cachedAt: string;
}

export interface CacheStats {
  entries: number;
  sizeBytes: number;
  sizeHuman: string;
  cacheDir: string;
}

function getCacheDir(): string {
  if (process.env.M2MD_CACHE_DIR) return process.env.M2MD_CACHE_DIR;
  if (process.env.XDG_CACHE_HOME) return join(process.env.XDG_CACHE_HOME, "m2md");
  return join(homedir(), ".cache", "m2md");
}

function entryPath(key: string): string {
  return join(getCacheDir(), `${key}.json`);
}

/**
 * Build a cache key from the image content hash + options that affect output.
 * Changing model, prompt, or template invalidates cache for the same image.
 */
export function buildCacheKey(
  contentHash: string,
  opts: { model?: string; prompt?: string; templateName?: string; note?: string; provider?: string }
): string {
  const parts = [
    contentHash,
    opts.model ?? "",
    opts.prompt ?? "",
    opts.templateName ?? "",
    opts.note ?? "",
    opts.provider ?? "",
  ];
  return createHash("sha256").update(parts.join("|")).digest("hex");
}

export async function ensureCacheDir(): Promise<void> {
  await mkdir(getCacheDir(), { recursive: true });
}

export async function getCached(key: string): Promise<CacheEntry | null> {
  try {
    const data = await readFile(entryPath(key), "utf-8");
    return JSON.parse(data) as CacheEntry;
  } catch {
    return null;
  }
}

export async function setCached(key: string, entry: CacheEntry): Promise<void> {
  await ensureCacheDir();
  await writeFile(entryPath(key), JSON.stringify(entry, null, 2), "utf-8");
}

export async function clearCache(): Promise<number> {
  const dir = getCacheDir();
  let count = 0;
  try {
    const files = await readdir(dir);
    for (const file of files) {
      if (file.endsWith(".json")) {
        await rm(join(dir, file));
        count++;
      }
    }
  } catch {
    // Cache dir doesn't exist — nothing to clear
  }
  return count;
}

export async function getCacheStats(): Promise<CacheStats> {
  const dir = getCacheDir();
  let entries = 0;
  let sizeBytes = 0;

  try {
    const files = await readdir(dir);
    for (const file of files) {
      if (file.endsWith(".json")) {
        entries++;
        const s = await stat(join(dir, file));
        sizeBytes += s.size;
      }
    }
  } catch {
    // Cache dir doesn't exist
  }

  return {
    entries,
    sizeBytes,
    sizeHuman: humanSize(sizeBytes),
    cacheDir: dir,
  };
}

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
