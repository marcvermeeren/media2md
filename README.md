# m2md

Turn images into structured, searchable markdown with AI vision.

I have 20 years of visual references (design inspiration, screenshots, diagrams, mood boards) scattered across folders. I use Obsidian for note-taking and wanted my vault to work for media too, not just text. The problem: images are invisible to search, to AI context windows, to `grep`. You can't find "that minimalist Japanese packaging with the kraft paper texture" in a folder of PNGs.

m2md fixes that. One command turns any image into a structured `.md` sidecar with AI-generated descriptions, extracted text, typed metadata, and tags. Ready for full-text search, vector search, and LLM retrieval.

```bash
npm install -g media2md
```

## Quick start

```bash
# Describe a screenshot → writes screenshot.md next to it
m2md screenshot.png

# Batch an entire directory
m2md ./assets/

# Print to stdout (pipe to clipboard, another tool, etc.)
m2md screenshot.png --stdout | pbcopy

# Describe an image from a URL
m2md https://example.com/photo.png
```

## Features

- AI-powered image descriptions via Claude or OpenAI vision
- Text extraction (OCR) from screenshots, documents, diagrams
- YAML frontmatter with 25+ structured fields (type, style, mood, era, typography, palette, references, etc.)
- Sidecar `.md` files next to images — makes directories greppable
- Provider tiers — `--tier fast` for cheap/quick, `--tier quality` for best results
- URL support — pass image URLs directly, or screenshot web pages via Playwright
- Watch mode — auto-process new/changed images in a directory
- Custom instructions (`--prompt`) and focus directives (`--note`)
- 4 built-in templates (default, minimal, alt-text, detailed) plus custom templates
- Content-hash caching — skip unchanged files automatically
- Cost estimation before processing (`--estimate`, `--dry-run`)
- Batch processing with concurrency control
- MCP server for AI agent integration (Claude Desktop, etc.)
- Programmatic API for use as a library

## Usage

### Single file

```bash
m2md screenshot.png                     # writes screenshot.md next to it
m2md screenshot.png -o ./docs/          # writes to docs/screenshot.md
m2md screenshot.png --stdout            # print to stdout
```

### Batch

```bash
m2md ./assets/                          # .md sidecar next to each image
m2md ./assets/ -r                       # recursive
m2md ./assets/ -r -o ./docs/            # recursive, custom output dir
m2md ./assets/*.png                     # glob
```

### Tiers

Quick presets instead of picking provider + model:

```bash
m2md screenshot.png --tier fast         # gpt-4o-mini — quick + cheap
m2md screenshot.png --tier quality      # claude-sonnet — best results (default behavior)
```

| Tier | Provider | Model | Best for |
|------|----------|-------|----------|
| `fast` | OpenAI | gpt-4o-mini | Quick passes, large batches, drafts |
| `quality` | Anthropic | claude-sonnet | Final output, detailed descriptions |

Explicit `--provider` / `--model` flags always override `--tier`.

### Providers

By default m2md uses Anthropic's Claude. Switch to OpenAI with `--provider`:

```bash
m2md screenshot.png                             # Anthropic Claude (default)
m2md screenshot.png --provider openai           # OpenAI GPT-4o
m2md screenshot.png --provider openai -m gpt-4o-mini  # specific model
```

### URLs

Pass image URLs directly — m2md downloads and processes them:

```bash
m2md https://example.com/screenshot.png                # image URL → download + describe
m2md https://example.com/landing-page                  # non-image URL → screenshot via Playwright
m2md screenshot.png https://example.com/photo.jpg      # mix local files + URLs
```

For non-image URLs, m2md takes a full-page screenshot using Playwright (optional dependency):

```bash
npm install playwright
npx playwright install chromium   # downloads the Chromium browser binary
```

### Watch mode

Auto-process new and changed images in a directory:

```bash
m2md watch ./assets/                    # watch for new/changed images
m2md watch ./assets/ --tier fast        # watch with fast tier
m2md watch ./assets/ -o ./docs/         # custom output directory
m2md watch ./assets/ -p "List all product names"  # watch with custom instructions
```

On startup, existing images without a `.md` sidecar are processed. Then m2md watches for new/changed files and processes them automatically. Press `Ctrl+C` to stop.

### Compare mode

Compare two or more images in a single API call:

```bash
m2md compare before.png after.png                # compare two images
m2md compare v1.png v2.png v3.png                 # compare multiple versions
m2md compare a.png b.png -n "focus on typography" # with focus directive
m2md compare a.png b.png -o comparison.md         # write to file
```

Outputs structured markdown with Summary, Similarities, Differences, and Verdict sections. Images are labeled A, B, C, etc.

### Custom instructions (`--prompt`)

Tell the model what to do differently. Instructions are appended to the built-in system prompt, so you get the structured output format plus your custom behavior:

```bash
m2md screenshot.png -p "List all visible product names and prices"
m2md ./assets/ -p "Identify every UI component and its state"
m2md photo.jpg -p "Describe from a security auditor's perspective"
```

### Focus directives (`--note`)

A lightweight nudge that's **additive** — it tells the model to pay extra attention to something without changing the analysis instructions. Combine with `--prompt` or use on its own:

```bash
m2md refs/*.png -n "watercolor technique, color palette, brushwork"
m2md hero.png -n "dark mode, spacing tokens"
m2md ./illos/ -p "art critique" -n "line weight and hatching"
```

### Templates

```bash
m2md screenshot.png                        # default (frontmatter + description + text)
m2md screenshot.png --template minimal     # description + source link
m2md screenshot.png --template alt-text    # just a description string
m2md screenshot.png --template detailed    # full metadata table + image embed
m2md screenshot.png --template ./my.md     # custom template file
m2md screenshot.png --no-frontmatter       # strip YAML frontmatter from output
```

Template variables available in custom templates:

| Variable | Description |
|----------|-------------|
| `{{type}}` | Image type (screenshot, photo, diagram, chart, logo, icon, illustration, render-3d, etc.) |
| `{{category}}` | Content category (ui-design, photography, packaging-design, etc.) |
| `{{style}}` | Visual style (minimalist, brutalist, mid-century, bauhaus, wabi-sabi, etc.) |
| `{{mood}}` | Mood/tone (calm, energetic, serene, dramatic, etc.) |
| `{{medium}}` | Medium (screen-capture, product-photography, letterpress, risograph, etc.) |
| `{{composition}}` | Composition (centered, grid, rule-of-thirds, golden-ratio, etc.) |
| `{{palette}}` | Material-driven color names (kraft-brown, slate-blue, bone-white, etc.) |
| `{{subject}}` | One-line summary (max 80 chars) |
| `{{description}}` | 4-sentence structured description |
| `{{extractedText}}` | All visible text, grouped by context |
| `{{colors}}` | Dominant colors (same as palette) |
| `{{tags}}` | 6-8 searchable keywords (materials, techniques, proper nouns) |
| `{{visualElements}}` | Literal visible objects (5-15 items) |
| `{{references}}` | Design movements, named styles, artist/designer references |
| `{{useCase}}` | Designer reference use cases |
| `{{colorHex}}` / `{{colorHexYaml}}` | 3-5 hex color values sampled from the image |
| `{{era}}` | Time period the design evokes (mid-century, 1970s, contemporary, etc.) |
| `{{artifact}}` | Designed object type (poster, packaging-box, website, album-cover, etc.) |
| `{{typography}}` | Typeface names, classifications, techniques |
| `{{script}}` | Writing systems / languages visible (latin, kanji, hangul, etc.) |
| `{{culturalInfluence}}` | Aesthetic lineages (japanese-wabi-sabi, scandinavian-functionalism, etc.) |
| `{{searchPhrases}}` / `{{searchPhrasesYaml}}` | 8-10 natural language search phrases |
| `{{dimensions}}` / `{{dimensionsYaml}}` | 2-5 reference-worthiness axes |
| `{{filename}}` | Original filename |
| `{{basename}}` | Filename without extension |
| `{{format}}` | File format (PNG, JPEG, WebP, GIF) |
| `{{dimensionsPx}}` | Width x Height |
| `{{width}}` / `{{height}}` | Image dimensions |
| `{{sizeHuman}}` / `{{sizeBytes}}` | File size |
| `{{sha256}}` | Content hash |
| `{{processedDate}}` / `{{datetime}}` | Processing timestamp |
| `{{model}}` | AI model used |
| `{{note}}` | Focus directive |
| `{{sourcePath}}` | Relative path to source file |

### Caching

Results are cached by content hash. Re-running on a directory only processes new or changed files.

```bash
m2md ./assets/                # second run skips unchanged files
m2md ./assets/ --no-cache     # force re-processing
m2md cache status             # show cache stats
m2md cache clear              # clear all cached results
```

Cache location (in order of precedence):
1. `M2MD_CACHE_DIR` environment variable
2. `$XDG_CACHE_HOME/m2md` (if `XDG_CACHE_HOME` is set)
3. `~/.cache/m2md` (default)

### Cost estimation

Preview what a batch will cost before calling the API:

```bash
m2md ./assets/ --estimate     # show token/cost estimate
m2md ./assets/ --dry-run      # list files with cache status + estimates
```

Both work without an API key so you can preview before committing.

### Custom filenames

Control the output `.md` filename with `--name`:

```bash
m2md screenshot.png --name "{date}-{filename}"        # 2026-02-18-screenshot.md
m2md ./assets/ --name "{type}-{filename}"             # screenshot-hero.md, photo-team.md
m2md shot.png --name "{date}-{subject}"               # 2026-02-18-dashboard-with-charts.md
```

| Placeholder | Description |
|-------------|-------------|
| `{filename}` | Original filename without extension |
| `{date}` | Processing date (YYYY-MM-DD) |
| `{type}` | AI-detected image type (screenshot, photo, diagram, etc.) |
| `{subject}` | AI-generated subject line, slugified |

### Other flags

```bash
m2md screenshot.png -m claude-sonnet-4-5-20250929   # specific model
m2md ./assets/ --concurrency 10                      # parallel API calls (default: 5)
m2md screenshot.png --no-frontmatter                   # strip YAML frontmatter
m2md screenshot.png -v                               # verbose output (tokens, cost, timing)
```

## Configuration

Drop a config file in any directory to set defaults for that project. This way you don't have to pass the same flags every time — just run `m2md ./assets/` and it picks up your settings.

Create an `m2md.config.json` (or `.m2mdrc`, `.m2mdrc.json`, `.m2mdrc.yaml`) in your project root:

```json
{
  "tier": "quality",
  "note": "focus on typography, color palette, layout grid",
  "output": "./docs",
  "recursive": true
}
```

All options are optional — only set what you want to override:

| Key | What it does | Default |
|-----|-------------|---------|
| `provider` | AI provider (`anthropic`, `openai`) | `anthropic` |
| `model` | AI model to use | provider default |
| `tier` | Preset tier (`fast`, `quality`) | none |
| `prompt` | Custom instructions for the model | none |
| `note` | Focus directive (additive nudge) | none |
| `template` | Output template | `default` |
| `output` | Output directory for `.md` files | next to image |
| `name` | Output filename pattern (`{filename}`, `{date}`, `{type}`, `{subject}`) | none |
| `noFrontmatter` | Strip YAML frontmatter from output | `false` |
| `recursive` | Scan directories recursively | `false` |
| `cache` | Cache results by content hash | `true` |
| `concurrency` | Max parallel API calls | `5` |

Precedence: CLI flags > `--tier` > config file > defaults.

You can also put config under an `"m2md"` key in `package.json`.

## Setup

```bash
# 1. Install
npm install -g media2md

# 2. Set your API key (one or both)
export ANTHROPIC_API_KEY="sk-ant-..."   # for Anthropic / --tier quality (default)
export OPENAI_API_KEY="sk-..."          # for OpenAI / --tier fast

# 3. Verify
m2md setup
```

## MCP server

m2md includes an MCP server (`m2md-mcp`) that exposes a `describe_image` tool over stdio. This lets AI agents — like Claude Desktop or any MCP client — analyze images directly.

The server **auto-detects API keys** from your shell profile (`~/.zshrc`, `~/.bashrc`, `~/.zprofile`, `~/.bash_profile`, `~/.profile`), so you typically don't need to pass them explicitly. This is especially useful for GUI apps like Claude Desktop that don't inherit shell environment variables.

### Claude Desktop / Claude Code

Add to your MCP config (`claude_desktop_config.json` or `.claude/settings.json`):

```json
{
  "mcpServers": {
    "m2md": {
      "command": "m2md-mcp"
    }
  }
}
```

If API key auto-detection doesn't work (e.g. keys are in a secrets manager), pass them explicitly:

```json
{
  "mcpServers": {
    "m2md": {
      "command": "m2md-mcp",
      "env": {
        "ANTHROPIC_API_KEY": "sk-ant-..."
      }
    }
  }
}
```

### Tool: `describe_image`

| Parameter | Required | Description |
|-----------|----------|-------------|
| `filePath` | Yes | Absolute path to the image file |
| `provider` | No | `anthropic` or `openai` |
| `model` | No | AI model to use |
| `prompt` | No | Custom instructions for the model |
| `note` | No | Focus directive |
| `template` | No | default, minimal, alt-text, detailed |

Returns the rendered markdown as text content. Shares the same cache as the CLI.

## Supported formats

PNG, JPEG, WebP, GIF

**Size limits per image:**

| Provider | Max size |
|----------|----------|
| Anthropic | 5 MB |
| OpenAI | 20 MB |

If both API keys are set, m2md automatically routes oversized files to the other provider. Otherwise, use `--provider openai` for larger files or resize the image first.

## Programmatic API

```typescript
import { processFile, AnthropicProvider } from "media2md";

const result = await processFile("screenshot.png", {
  provider: new AnthropicProvider(),
});

result.markdown;           // rendered markdown string
result.description;        // 4-sentence structured description
result.extractedText;      // extracted text
result.type;               // "screenshot", "photo", "diagram", etc.
result.category;           // "ui-design", "photography", etc.
result.style;              // "minimalist, brutalist"
result.mood;               // "calm, warm"
result.tags;               // comma-separated keywords
result.palette;            // material-driven color names
result.era;                // "mid-century, contemporary"
result.artifact;           // "poster", "website", etc.
result.typography;         // "futura, sans-serif"
result.script;             // "latin, english"
result.culturalInfluence;  // "scandinavian-functionalism"
result.references;         // "Bauhaus, Dieter Rams"
result.searchPhrases;      // newline-separated search phrases
result.metadata;           // { width, height, format, sizeHuman, sha256, ... }
```

## License

MIT
