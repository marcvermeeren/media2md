import { execSync } from "node:child_process";
import { mkdtemp, writeFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

/**
 * Read an image from the system clipboard and save it to a temp file.
 * Returns the path to the temp PNG file.
 *
 * macOS: tries pngpaste first (handles all formats), then falls back to
 *        osascript with multiple clipboard types (PNG, TIFF, JPEG).
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

  // Try pngpaste first — it uses the native Cocoa NSPasteboard API, which
  // properly resolves "promised" clipboard data from apps like Figma and Sketch.
  // osascript cannot access promised data.
  const hasPngpaste = (() => {
    try {
      execSync("which pngpaste", { stdio: ["pipe", "pipe", "pipe"] });
      return true;
    } catch { return false; }
  })();

  if (hasPngpaste) {
    try {
      execSync(`pngpaste "${outPath}"`, {
        timeout: 5000,
        stdio: ["pipe", "pipe", "pipe"],
      });
      const s = await stat(outPath).catch(() => null);
      if (s && s.size > 0) return outPath;
    } catch {
      // pngpaste found nothing — fall through to osascript
    }
  }

  // Try multiple clipboard types via osascript: PNG, TIFF, JPEG
  // Figma, Sketch, and some apps copy as TIFF; screenshots are usually PNG
  const formats: { cls: string; ext: string }[] = [
    { cls: "«class PNGf»", ext: "png" },
    { cls: "«class TIFF»", ext: "tiff" },
    { cls: "«class JPEG»", ext: "jpeg" },
  ];

  for (const { cls, ext } of formats) {
    const rawPath = join(dir, `clipboard.${ext}`);
    const script = `
set theFile to POSIX file "${rawPath}"
try
  set imgData to the clipboard as ${cls}
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
      const s = await stat(rawPath).catch(() => null);
      if (!s || s.size === 0) continue;

      // If already PNG, we're done
      if (ext === "png") return rawPath;

      // Convert TIFF/JPEG to PNG via sips (built into macOS)
      try {
        execSync(`sips -s format png "${rawPath}" --out "${outPath}" 2>/dev/null`, {
          timeout: 5000,
          stdio: ["pipe", "pipe", "pipe"],
        });
        return outPath;
      } catch {
        // sips failed — return raw file, it's still a valid image
        return rawPath;
      }
    } catch {
      // This format not on clipboard, try next
      continue;
    }
  }

  const hint = hasPngpaste
    ? "Copy an image first (e.g. screenshot with Cmd+Shift+4).\n  Note: Figma's \"Copy as PNG\" doesn't put image data on the system clipboard.\n  Use Figma's Export instead, or screenshot the selection with Cmd+Shift+4."
    : "Some apps (Figma, Sketch) use lazy clipboard data that requires pngpaste.\n  Install it with: brew install pngpaste";

  throw new Error(
    `No image found on clipboard. ${hint}`
  );
}

async function readClipboardLinux(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "m2md-clipboard-"));
  const outPath = join(dir, "clipboard.png");

  // Try PNG first, then any image type
  const targets = ["image/png", "image/jpeg", "image/tiff", "image/bmp"];

  for (const target of targets) {
    try {
      const buffer = execSync(`xclip -selection clipboard -t ${target} -o`, {
        timeout: 5000,
        stdio: ["pipe", "pipe", "pipe"],
        maxBuffer: 50 * 1024 * 1024,
      });
      if (buffer.length > 0) {
        await writeFile(outPath, buffer);
        return outPath;
      }
    } catch {
      continue;
    }
  }

  throw new Error(
    "No image found on clipboard. Copy an image first, or install xclip: sudo apt install xclip"
  );
}
