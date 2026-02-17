import ora, { type Ora } from "ora";
import pc from "picocolors";

const isTTY = process.stderr.isTTY ?? false;

let spinner: Ora | null = null;

// Brand color — consistent cyan accent
const brand = pc.cyan;
const accent = pc.magenta;

export function startSpinner(text: string): void {
  if (!isTTY) {
    process.stderr.write(pc.dim(`  ${text}\n`));
    return;
  }
  spinner = ora({
    text,
    stream: process.stderr,
    spinner: "dots",
    color: "cyan",
    indent: 2,
  }).start();
}

export function updateSpinner(text: string): void {
  if (spinner) {
    spinner.text = text;
  } else if (!isTTY) {
    process.stderr.write(pc.dim(`  ${text}\n`));
  }
}

export function stopSpinner(): void {
  if (spinner) {
    spinner.stop();
    spinner = null;
  }
}

export function succeedSpinner(text: string): void {
  if (spinner) {
    spinner.stop();
    spinner = null;
  }
  process.stderr.write(pc.green(`  ✓ ${text}\n`));
}

export function failSpinner(text: string): void {
  if (spinner) {
    spinner.stop();
    spinner = null;
  }
  process.stderr.write(pc.red(`  ✗ ${text}\n`));
}

export function success(msg: string): void {
  process.stderr.write(pc.green(`  ✓ ${msg}\n`));
}

export function error(msg: string): void {
  process.stderr.write(pc.red(`  ✗ ${msg}\n`));
}

export function warn(msg: string): void {
  process.stderr.write(pc.yellow(`  ⚠ ${msg}\n`));
}

export function info(msg: string): void {
  process.stderr.write(pc.dim(`  ${msg}\n`));
}

export function blank(): void {
  process.stderr.write("\n");
}

export function header(text: string): void {
  process.stderr.write(`\n  ${brand(pc.bold(text))}\n\n`);
}

export function summary(lines: string[]): void {
  process.stderr.write("\n");
  const boxWidth = Math.max(...lines.map((l) => stripAnsi(l).length)) + 4;
  const border = pc.dim("─".repeat(boxWidth));
  process.stderr.write(`  ${border}\n`);
  for (const line of lines) {
    process.stderr.write(`  ${line}\n`);
  }
  process.stderr.write(`  ${border}\n\n`);
}

// Strip ANSI escape codes for length calculation
function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*m/g, "");
}

export { brand, accent };
