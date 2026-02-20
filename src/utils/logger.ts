import pc from "picocolors";

const isTTY = process.stderr.isTTY ?? false;

// Brand color — consistent cyan accent
const brand = pc.cyan;
const accent = pc.magenta;

// ── Custom spinner ─────────────────────────────────────────────────
// On resize, terminals reflow the active line across multiple rows.
// \r only goes to col 0 of the bottom row, leaving ghost text above.
// Fix: track written length, cursor-up to the top of the reflowed
// region, then erase from there to end of screen.

const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const INTERVAL = 80;

let spinnerText = "";
let spinnerFrame = 0;
let spinnerTimer: ReturnType<typeof setInterval> | null = null;
let prevWrittenLen = 0;

process.on("SIGINT", () => {
  if (spinnerTimer) {
    clearInterval(spinnerTimer);
    spinnerTimer = null;
    clearSpinnerLine();
  }
  process.exit(130);
});

// Truncate a string containing ANSI codes to a visible width
function truncateAnsi(str: string, maxWidth: number): string {
  if (maxWidth <= 0) return "";
  let visible = 0;
  let i = 0;
  while (i < str.length && visible < maxWidth) {
    if (str[i] === "\x1b") {
      const end = str.indexOf("m", i);
      if (end !== -1) { i = end + 1; continue; }
    }
    visible++;
    i++;
  }
  if (i >= str.length) return str;
  return str.slice(0, i) + "\x1b[0m";
}

function clearSpinnerLine(): void {
  const cols = process.stderr.columns || 80;
  const lines = prevWrittenLen > 0 ? Math.ceil(prevWrittenLen / cols) : 1;
  if (lines > 1) {
    process.stderr.write(`\x1b[${lines - 1}A`);
  }
  process.stderr.write(`\r\x1b[J`);
  prevWrittenLen = 0;
}

function renderSpinner(): void {
  const frame = pc.cyan(FRAMES[spinnerFrame % FRAMES.length]);
  const cols = process.stderr.columns || 80;
  const line = `  ${frame} ${spinnerText}`;
  const output = truncateAnsi(line, cols - 1);

  if (spinnerFrame > 0) clearSpinnerLine();

  process.stderr.write(output);
  prevWrittenLen = stripAnsi(output).length;
  spinnerFrame++;
}

// Re-render immediately on resize (don't wait for next 80ms tick)
if (isTTY) {
  process.stderr.on("resize", () => {
    if (spinnerTimer) renderSpinner();
  });
}

export function startSpinner(text: string): void {
  if (!isTTY) {
    process.stderr.write(pc.dim(`  ${text}\n`));
    return;
  }
  spinnerText = text;
  spinnerFrame = 0;
  prevWrittenLen = 0;
  renderSpinner();
  spinnerTimer = setInterval(renderSpinner, INTERVAL);
}

export function updateSpinner(text: string): void {
  if (spinnerTimer) {
    spinnerText = text;
  } else if (!isTTY) {
    process.stderr.write(pc.dim(`  ${text}\n`));
  }
}

export function stopSpinner(): void {
  if (spinnerTimer) {
    clearInterval(spinnerTimer);
    spinnerTimer = null;
    clearSpinnerLine();
  }
}

export function succeedSpinner(text: string): void {
  if (spinnerTimer) {
    clearInterval(spinnerTimer);
    spinnerTimer = null;
    clearSpinnerLine();
  }
  process.stderr.write(`  ${pc.green("✓")} ${text}\n`);
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
