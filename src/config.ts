import { cosmiconfig } from "cosmiconfig";

export interface M2mdConfig {
  provider?: string;
  model?: string;
  tier?: string;
  persona?: string;
  prompt?: string;
  note?: string;
  template?: string;
  output?: string;
  name?: string;
  noFrontmatter?: boolean;
  recursive?: boolean;
  cache?: boolean;
  concurrency?: number;
}

export const TIER_MAP: Record<string, { provider: string; model: string }> = {
  fast: { provider: "openai", model: "gpt-4o-mini" },
  quality: { provider: "anthropic", model: "claude-sonnet-4-5-20250929" },
};

/**
 * Resolve tier into provider/model, only when they aren't explicitly set.
 * Precedence: explicit --provider/--model > --tier > config > defaults
 */
export function resolveTier(
  opts: Record<string, unknown>,
  config: M2mdConfig
): void {
  const tier = (opts.tier as string | undefined) ?? config.tier;
  if (!tier) return;

  const mapping = TIER_MAP[tier];
  if (!mapping) return;

  if (opts.provider === undefined) {
    opts.provider = mapping.provider;
  }
  if (opts.model === undefined) {
    opts.model = mapping.model;
  }
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
    // Map config noFrontmatter → Commander's frontmatter flag
    if (key === "noFrontmatter") {
      if (merged["frontmatter"] === undefined || merged["frontmatter"] === true) {
        // CLI didn't explicitly set --no-frontmatter, apply config
        if (value === true) {
          (merged as Record<string, unknown>)["frontmatter"] = false;
        }
      }
      continue;
    }

    // Only apply config value if CLI didn't set it
    // Commander sets defaults, so check if it's still the default
    if (merged[key] === undefined || merged[key] === null) {
      (merged as Record<string, unknown>)[key] = value;
    }
  }

  return merged;
}
