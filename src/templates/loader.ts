import { readFile } from "node:fs/promises";
import { BUILTIN_TEMPLATES, DEFAULT_TEMPLATE } from "./builtins.js";

export async function loadTemplate(nameOrPath?: string): Promise<string> {
  if (!nameOrPath) return DEFAULT_TEMPLATE;

  // Check built-in templates first
  if (nameOrPath in BUILTIN_TEMPLATES) {
    return BUILTIN_TEMPLATES[nameOrPath];
  }

  // Try loading as a file path
  try {
    return await readFile(nameOrPath, "utf-8");
  } catch {
    const builtinNames = Object.keys(BUILTIN_TEMPLATES).join(", ");
    throw new Error(
      `Template not found: "${nameOrPath}". Built-in templates: ${builtinNames}. Or provide a path to a template file.`
    );
  }
}
