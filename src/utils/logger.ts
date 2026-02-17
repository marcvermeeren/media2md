import ora, { type Ora } from "ora";
import pc from "picocolors";

const isTTY = process.stderr.isTTY ?? false;

let spinner: Ora | null = null;

export function startSpinner(text: string): void {
  if (!isTTY) return;
  spinner = ora({ text, stream: process.stderr }).start();
}

export function updateSpinner(text: string): void {
  if (spinner) spinner.text = text;
}

export function stopSpinner(): void {
  if (spinner) {
    spinner.stop();
    spinner = null;
  }
}

export function succeedSpinner(text: string): void {
  if (spinner) {
    spinner.succeed(text);
    spinner = null;
  }
}

export function success(msg: string): void {
  process.stderr.write(pc.green(`✓ ${msg}\n`));
}

export function error(msg: string): void {
  process.stderr.write(pc.red(`✗ ${msg}\n`));
}

export function warn(msg: string): void {
  process.stderr.write(pc.yellow(`⚠ ${msg}\n`));
}

export function info(msg: string): void {
  process.stderr.write(pc.dim(`${msg}\n`));
}
