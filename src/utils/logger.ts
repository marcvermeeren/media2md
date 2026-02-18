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
  // Prefix: 2-space indent + ✓ + space = matches ora indent:2 + spinner char + space
  process.stderr.write(`  ${pc.green("✓")} ${text}\n`);
}

export function failSpinner(text: string): void {
  if (spinner) {
    spinner.stop();
    spinner = null;
  }
  process.stderr.write(`  ${pc.red("✗")} ${text}\n`);
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
export function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*m/g, "");
}

export function progressBar(current: number, total: number, width = 20): string {
  const filled = Math.round((current / total) * width);
  const empty = width - filled;
  return `${pc.cyan("█".repeat(filled))}${pc.dim("░".repeat(empty))}`;
}

interface TableColumn {
  header: string;
  align?: "left" | "right";
}

export function table(columns: TableColumn[], rows: string[][], footer?: string[]): void {
  const gap = "   ";
  const indent = "  ";

  // Calculate column widths from headers and all row/footer values
  const widths = columns.map((col, i) => {
    let max = stripAnsi(col.header).length;
    for (const row of rows) {
      if (row[i] !== undefined) {
        max = Math.max(max, stripAnsi(row[i]).length);
      }
    }
    if (footer && footer[i] !== undefined) {
      max = Math.max(max, stripAnsi(footer[i]).length);
    }
    return max;
  });

  function padCell(text: string, width: number, align: "left" | "right"): string {
    const bare = stripAnsi(text).length;
    const pad = Math.max(0, width - bare);
    return align === "right" ? " ".repeat(pad) + text : text + " ".repeat(pad);
  }

  // Header
  const headerLine = columns.map((col, i) => pc.dim(padCell(col.header, widths[i], col.align ?? "left"))).join(gap);
  process.stderr.write(`${indent}${headerLine}\n`);

  // Separator
  const totalWidth = widths.reduce((a, b) => a + b, 0) + gap.length * (widths.length - 1);
  process.stderr.write(`${indent}${pc.dim("─".repeat(totalWidth))}\n`);

  // Data rows
  for (const row of rows) {
    const line = columns.map((col, i) => padCell(row[i] ?? "", widths[i], col.align ?? "left")).join(gap);
    process.stderr.write(`${indent}${line}\n`);
  }

  // Footer
  if (footer) {
    process.stderr.write(`${indent}${pc.dim("─".repeat(totalWidth))}\n`);
    const footerLine = columns.map((col, i) => pc.bold(padCell(footer[i] ?? "", widths[i], col.align ?? "left"))).join(gap);
    process.stderr.write(`${indent}${footerLine}\n`);
  }
}

export { brand, accent };
