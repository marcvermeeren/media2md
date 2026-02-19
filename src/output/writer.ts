import { writeFile, mkdir } from "node:fs/promises";
import { dirname, join, basename, extname } from "node:path";

export interface WriteOptions {
  /** Output directory. If set, writes there instead of sidecar. */
  outputDir?: string;
  /** Force stdout even for batch. */
  stdout?: boolean;
}

export function sidecarPath(imagePath: string, outputDir?: string): string {
  const name = basename(imagePath, extname(imagePath)) + ".md";
  if (outputDir) {
    return join(outputDir, name);
  }
  return join(dirname(imagePath), name);
}

/**
 * Build an output path from a naming pattern.
 * Supported placeholders: {filename}, {date}, {type}, {subject}
 * Always appends .md if not already present.
 */
export function formatOutputPath(
  imagePath: string,
  pattern: string,
  vars: { date?: string; type?: string; subject?: string },
  outputDir?: string,
): string {
  const base = basename(imagePath, extname(imagePath));
  const date = vars.date ?? new Date().toISOString().split("T")[0];

  let name = pattern
    .replace(/\{filename\}/g, base)
    .replace(/\{date\}/g, date)
    .replace(/\{type\}/g, slugify(vars.type || "image"))
    .replace(/\{subject\}/g, slugify(vars.subject || base));

  if (!name.endsWith(".md")) name += ".md";

  const dir = outputDir ?? dirname(imagePath);
  return join(dir, name);
}

function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function writeMarkdown(
  markdown: string,
  outputPath: string
): Promise<void> {
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, markdown, "utf-8");
}
