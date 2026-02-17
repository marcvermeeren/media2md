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
const yellow = noColor ? "" : "\x1b[33m";

const msg = `
${bold}${cyan}media2md${reset} installed successfully!

${dim}Convert images to structured markdown with AI vision.${reset}

${bold}Quick start:${reset}
  ${green}media2md screenshot.png${reset}        ${dim}# outputs markdown to stdout${reset}
  ${green}media2md setup${reset}                  ${dim}# configure your API key${reset}

${yellow}Requires ANTHROPIC_API_KEY environment variable.${reset}
`;

process.stderr.write(msg);
