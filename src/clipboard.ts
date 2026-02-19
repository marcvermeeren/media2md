import { execSync } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

/**
 * Read an image from the system clipboard and save it to a temp file.
 * Returns the path to the temp PNG file.
 *
 * macOS: uses osascript to extract clipboard image data.
 * Linux: uses xclip to read clipboard image.
 */
export async function readClipboardImage(): Promise<string> {
  const platform = process.platform;

  if (platform === "darwin") {
    return readClipboardMacOS();
  } else if (platform === "linux") {
    return readClipboardLinux();
  } else {
    throw new Error(`Clipboard support is not available on ${platform}. Supported: macOS, Linux.`);
  }
}

async function readClipboardMacOS(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "m2md-clipboard-"));
  const outPath = join(dir, "clipboard.png");

  const script = `
set theFile to POSIX file "${outPath}"
try
  set imgData to the clipboard as «class PNGf»
  set fileRef to open for access theFile with write permission
  set eof of fileRef to 0
  write imgData to fileRef
  close access fileRef
on error errMsg
  try
    close access theFile
  end try
  error "No image on clipboard"
end try
`.trim();

  try {
    execSync(`osascript -e '${script.replace(/'/g, "'\\''")}'`, {
      timeout: 5000,
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch {
    throw new Error(
      "No image found on clipboard. Copy an image first (e.g. screenshot with Cmd+Shift+4)."
    );
  }

  return outPath;
}

async function readClipboardLinux(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "m2md-clipboard-"));
  const outPath = join(dir, "clipboard.png");

  try {
    const buffer = execSync("xclip -selection clipboard -t image/png -o", {
      timeout: 5000,
      stdio: ["pipe", "pipe", "pipe"],
      maxBuffer: 50 * 1024 * 1024,
    });
    await writeFile(outPath, buffer);
  } catch {
    throw new Error(
      "No image found on clipboard. Copy an image first, or install xclip: sudo apt install xclip"
    );
  }

  return outPath;
}
