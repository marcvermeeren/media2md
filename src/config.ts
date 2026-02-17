import { cosmiconfig } from "cosmiconfig";

export interface Media2mdConfig {
  model?: string;
  persona?: string;
  prompt?: string;
  template?: string;
  output?: string;
  recursive?: boolean;
  cache?: boolean;
  concurrency?: number;
}

const explorer = cosmiconfig("media2md", {
  searchPlaces: [
    "media2md.config.json",
    "media2md.config.js",
    ".media2mdrc",
    ".media2mdrc.json",
    ".media2mdrc.yaml",
    ".media2mdrc.yml",
    "package.json",
  ],
});

let cachedConfig: Media2mdConfig | null = null;
let loaded = false;

export async function loadConfig(): Promise<Media2mdConfig> {
  if (loaded) return cachedConfig ?? {};

  try {
    const result = await explorer.search();
    loaded = true;
    if (result && !result.isEmpty) {
      cachedConfig = result.config as Media2mdConfig;
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
  config: Media2mdConfig
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
