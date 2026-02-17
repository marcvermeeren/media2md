// Postinstall welcome message for global installs only
// Plain JS — no dependencies, raw ANSI codes

const isGlobal = process.env.npm_config_global === "true";
const isCI = process.env.CI === "true" || process.env.CI === "1";
const noColor =
  process.env.NO_COLOR !== undefined || process.env.TERM === "dumb";

if (!isGlobal || isCI) {
  process.exit(0);
}

const reset = noColor ? "" : "\x1b[0m";
const bold = noColor ? "" : "\x1b[1m";
const dim = noColor ? "" : "\x1b[2m";
const cyan = noColor ? "" : "\x1b[36m";
const green = noColor ? "" : "\x1b[32m";
const magenta = noColor ? "" : "\x1b[35m";

const line = noColor ? "────────────────────────────────────" : `${dim}────────────────────────────────────${reset}`;

const msg = `
  ${line}

  ${bold}${cyan}m2md${reset} installed successfully

  ${dim}Convert images to structured markdown${reset}
  ${dim}with AI vision.${reset}

  ${bold}${cyan}Quick start${reset}
  ${dim}$${reset} ${green}m2md screenshot.png${reset}
  ${dim}$${reset} ${green}m2md ./assets/ -r${reset}
  ${dim}$${reset} ${green}m2md setup${reset}

  ${dim}Requires${reset} ${magenta}ANTHROPIC_API_KEY${reset} ${dim}env variable.${reset}

  ${line}

`;

process.stderr.write(msg);
