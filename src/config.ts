import { cosmiconfig } from "cosmiconfig";

export interface M2mdConfig {
  model?: string;
  persona?: string;
  prompt?: string;
  template?: string;
  output?: string;
  recursive?: boolean;
  cache?: boolean;
  concurrency?: number;
}

const explorer = cosmiconfig("m2md", {
  searchPlaces: [
    "m2md.config.json",
    "m2md.config.js",
    ".m2mdrc",
    ".m2mdrc.json",
    ".m2mdrc.yaml",
    ".m2mdrc.yml",
    "package.json",
  ],
});

let cachedConfig: M2mdConfig | null = null;
let loaded = false;

export async function loadConfig(): Promise<M2mdConfig> {
  if (loaded) return cachedConfig ?? {};

  try {
    const result = await explorer.search();
    loaded = true;
    if (result && !result.isEmpty) {
      cachedConfig = result.config as M2mdConfig;
      return cachedConfig;
    }
  } catch {
    // Malformed config — ignore silently
  }

  loaded = true;
  return {};
}

/**
 * Merge CLI options with config file values.
 * CLI flags take precedence over config file.
 */
export function mergeOptions<T extends Record<string, unknown>>(
  cliOpts: T,
  config: M2mdConfig
): T {
  const merged = { ...cliOpts };

  for (const [key, value] of Object.entries(config)) {
    // Only apply config value if CLI didn't set it
    // Commander sets defaults, so check if it's still the default
    if (merged[key] === undefined || merged[key] === null) {
      (merged as Record<string, unknown>)[key] = value;
    }
  }

  return merged;
}
