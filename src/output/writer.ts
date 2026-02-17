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

export async function writeMarkdown(
  markdown: string,
  outputPath: string
): Promise<void> {
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, markdown, "utf-8");
}
