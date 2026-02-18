---
type: system
status: draft
confidence: medium
tags: [tooling, dev, spec, cli]
created: 2026-02-17
updated: 2026-02-17
related: [[_system-index]], [[qmd-setup]]
---

# m2md — Media to Markdown

CLI tool that makes media files machine-readable by generating structured markdown with AI-generated descriptions, extracted text, and source links. Built for developers and AI-powered workflows.

Package name: `m2md` (available on npm).

## Problem

Media files (screenshots, photos, diagrams, whiteboards) are black boxes to AI tools, search engines, and text-based workflows. You can't grep an image. You can't feed a screenshot to a context window without describing it. Every image needs a human to write alt text, descriptions, or notes.

## What exists (and why this is different)

The space is Python-dominated and OCR-focused. Nobody does "image in → structured markdown description out" as a standalone CLI for developers.

| Tool | Gap |
|------|-----|
| Microsoft MarkItDown (74k stars) | Document converter. Image description is a secondary feature, not the core. |
| Simon Willison's LLM CLI (11k stars) | General LLM wrapper. Can describe images but output is unstructured. |
| Zerox (12k stars) | PDF OCR→markdown. No image description. |
| llama-ocr (2.4k stars) | Single provider (Together AI), OCR only, no semantic description. |
| Markdownify MCP | MCP server, not standalone CLI. |

**m2md's niche:** structured, AI-powered image descriptions as a first-class CLI tool — with sidecar files that make entire directories searchable and AI-readable. TypeScript, npm-native, multi-provider.

## Solution

A CLI that takes any image and outputs a structured markdown file with:
- AI-generated description (what's in the image, what it means)
- Extracted text / OCR (anything readable in the image)
- YAML frontmatter with metadata (dimensions, format, size, file hash)
- Link back to the source file

Later: video (keyframes + transcript), audio (transcript), PDFs (extracted text + description).

## Core Principles

1. **Unix philosophy** — stdout by default, pipes well, does one thing
2. **Zero config to start** — `m2md image.png` just works
3. **Sidecar by default for directories** — batch processing creates `.md` files next to images, making everything greppable
4. **Configurable when needed** — templates, models, output paths, personas
5. **Cache-aware** — skip unchanged files by content hash
6. **No lock-in** — output is plain markdown, works anywhere

## CLI Interface

### Basic usage

```bash
# Single file → stdout
m2md screenshot.png

# Single file → sidecar file (screenshot.md next to screenshot.png)
m2md screenshot.png -o .

# Batch a directory (sidecar mode — creates .md next to each image)
m2md ./assets/

# Batch with glob
m2md ./assets/*.png

# Recursive
m2md ./assets/ -r
```

### Output control

```bash
# Stdout (default for single file)
m2md screenshot.png

# Sidecar — write .md next to source file (default for directories)
m2md ./assets/

# Custom output directory (all .md files go here)
m2md screenshot.png -o ./docs/

# Force stdout even for batch
m2md ./assets/ --stdout

# Custom filename pattern
m2md screenshot.png --name "{date}-{filename}"
```

### Personas

Built-in personas shape how the AI describes images. Good default + domain-specific options:

```bash
# Default persona (general, descriptive)
m2md screenshot.png

# Built-in personas
m2md screenshot.png --persona brand        # brand analyst: positioning, messaging, voice
m2md screenshot.png --persona design        # designer: layout, typography, color, spacing
m2md screenshot.png --persona developer     # developer: UI components, architecture, data flows
m2md screenshot.png --persona accessibility # a11y expert: alt text, contrast, screen reader concerns
m2md screenshot.png --persona marketing     # marketer: CTAs, conversion elements, audience targeting

# Custom prompt (overrides persona)
m2md screenshot.png --prompt "describe this from a security auditor's perspective"

# Focus directive — additive note that layers on top of any mode
m2md screenshot.png -n "watercolor technique, color palette, brushwork"
m2md screenshot.png --persona design --note "dark mode, spacing tokens"
m2md screenshot.png --prompt "security audit" -n "focus on XSS vectors"
```

### Notes (`--note` / `-n`)

A freeform directive that's **additive** — it layers on top of whatever system prompt exists (base, persona, or custom `--prompt`), injected last so the LLM prioritizes it. Unlike `--prompt` which replaces the persona, `--note` stacks with everything.

```bash
# Note with default prompt
m2md refs/*.png -n "watercolor technique, color palette, brushwork"

# Note stacks with persona
m2md hero.png --persona design --note "dark mode, spacing tokens"

# Note stacks with custom prompt
m2md ./illos/ --prompt "art critique" -n "similar to Moebius — note line weight and hatching"
```

Also settable in config for a whole directory:
```json
{ "note": "illustration references — capture style, palette, technique" }
```

#### Persona definitions

| Persona | Focus | Example output difference |
|---------|-------|--------------------------|
| `default` | What is shown, what it communicates, notable details | Neutral, comprehensive description |
| `brand` | Positioning, messaging, voice, competitive signals | "Hero copy leads with 'Automate everything' — direct command voice, similar to Zapier's approach" |
| `design` | Layout, grid, typography, color palette, spacing, hierarchy | "16px grid, hero uses 48px bold sans-serif, #1a1a2e background, 3-column feature grid below fold" |
| `developer` | UI components, states, API surfaces, data structures, architecture | "Dashboard component with chart (likely recharts/d3), tabbed navigation, REST endpoint visible in sidebar" |
| `accessibility` | Alt text quality, contrast ratios, keyboard navigation, ARIA concerns | "Low contrast on secondary text (#999 on #fff), no visible focus indicators, chart lacks text alternative" |
| `marketing` | CTAs, conversion flow, social proof, audience targeting, funnel position | "Above-fold CTA 'Start free trial' with green button. Social proof: '10k+ teams' badge. Targets technical buyers." |

Personas are implemented as system prompt modifiers — the core description prompt stays the same, the persona adds a lens.

### Model and provider

```bash
# Default: uses Claude (requires ANTHROPIC_API_KEY)
m2md screenshot.png

# Explicit provider
m2md screenshot.png --provider anthropic
m2md screenshot.png --provider openai

# Specific model
m2md screenshot.png --model claude-sonnet-4-5-20250929

# Local model (future)
m2md screenshot.png --provider ollama --model llava
```

### Templates

```bash
# Default template (frontmatter + description + OCR + metadata + source)
m2md screenshot.png

# Built-in templates
m2md screenshot.png --template minimal    # just description + source link
m2md screenshot.png --template detailed   # full metadata, OCR, description
m2md screenshot.png --template alt-text   # just an alt-text string, no markdown

# Custom template file
m2md screenshot.png --template ./my-template.md
```

### Caching and cost

```bash
# Skip unchanged files (by content hash, enabled by default)
m2md ./assets/

# Force re-process everything
m2md ./assets/ --no-cache

# Show what would be processed + estimated cost (no API calls)
m2md ./assets/ --estimate

# Clear cache
m2md cache clear

# Show cache stats
m2md cache status
```

### Other flags

```bash
# Skip OCR (faster, cheaper)
m2md screenshot.png --no-ocr

# Dry run (show what would be processed, no API calls)
m2md ./assets/ --dry-run

# Verbose
m2md screenshot.png -v
```

## Output Format

### Default template (with frontmatter)

```markdown
---
source: ./screenshot.png
dimensions: 1920x1080
format: png
size: 342 KB
hash: a1b2c3d4
processed: 2026-02-17
persona: default
---

# screenshot.png

## Description

Marketing dashboard showing monthly active users trending upward from 12k
to 47k over Q3 2025. The header navigation shows "Dashboard > Analytics > Growth".
A prominent hero banner reads "Automate everything" in bold white text on a
dark blue gradient background. Below the chart, a summary card highlights
"+292% growth" with a green upward arrow.

## Extracted Text

- "Automate everything"
- "47,231 monthly active users"
- "+292% growth"
- "Dashboard > Analytics > Growth"
- "Export Report" (button, top right)

## Source

![screenshot](./screenshot.png)
```

### Same image, brand persona

```markdown
---
source: ./screenshot.png
dimensions: 1920x1080
format: png
size: 342 KB
hash: a1b2c3d4
processed: 2026-02-17
persona: brand
---

# screenshot.png

## Description

Product dashboard landing page for an automation platform. The hero copy
"Automate everything" uses a direct command voice — assertive, no qualifiers,
similar in tone to Zapier's "Make everything work together." The "+292% growth"
metric is positioned as social proof, targeting growth-stage buyers. The dark
blue gradient background signals enterprise seriousness. Navigation structure
suggests a mature product with analytics depth. Overall positioning: "we help
you grow fast through automation" — a performance narrative rather than a
simplicity or technical narrative.

## Extracted Text

- "Automate everything"
- "47,231 monthly active users"
- "+292% growth"
- "Dashboard > Analytics > Growth"
- "Export Report" (button, top right)

## Source

![screenshot](./screenshot.png)
```

### Minimal template

```markdown
Marketing dashboard showing MAU growth from 12k to 47k. Hero text: "Automate everything."

Source: [screenshot.png](./screenshot.png)
```

### Alt-text template

```
Marketing dashboard showing monthly active user growth with hero text reading Automate everything
```

### Custom template (example: vault reference note)

Users can create their own templates with placeholders:

```markdown
---
type: reference
media_type: image
created: {{date}}
tags: []
---

# {{filename}}

## Content

{{description}}

{{#if extracted_text}}
### Extracted Text

{{extracted_text}}
{{/if}}

## Assets

![[{{source_path}}]]

## Why this matters

*[To be filled in]*
```

### Template variables

| Variable | Description |
|----------|-------------|
| `{{filename}}` | Original filename without extension |
| `{{filename_ext}}` | Original filename with extension |
| `{{description}}` | AI-generated description |
| `{{extracted_text}}` | OCR / extracted text (may be empty) |
| `{{source_path}}` | Relative path to source file |
| `{{source_abs_path}}` | Absolute path to source file |
| `{{dimensions}}` | Width x Height |
| `{{width}}` | Image width |
| `{{height}}` | Image height |
| `{{format}}` | File format (PNG, JPG, etc.) |
| `{{size}}` | Human-readable file size |
| `{{size_bytes}}` | File size in bytes |
| `{{hash}}` | Content hash of source file |
| `{{date}}` | ISO date (YYYY-MM-DD) |
| `{{datetime}}` | ISO datetime |
| `{{persona}}` | Persona used for description |
| `{{note}}` | Focus directive note (if provided) |
| `{{metadata_table}}` | Pre-formatted metadata table |
| `{{frontmatter}}` | Pre-formatted YAML frontmatter block |

## Config File

Optional `m2md.config.json` or `.m2mdrc` in project root or home dir:

```json
{
  "provider": "anthropic",
  "model": "claude-sonnet-4-5-20250929",
  "template": "default",
  "persona": "default",
  "note": "",
  "ocr": true,
  "cache": true,
  "naming": "{filename}"
}
```

Precedence: CLI flags > project config > home config > defaults.

## Caching

m2md caches results by file content hash (SHA-256). When processing a directory:

1. Hash each image file
2. Check cache for existing result with same hash
3. Skip files that haven't changed
4. Only call the API for new or modified files

Cache location: `~/.cache/m2md/` (or `$XDG_CACHE_HOME/m2md/`).

```bash
m2md cache status     # show stats (files cached, size, age)
m2md cache clear      # clear all cached results
```

This means re-running `m2md ./assets/` after adding 2 new images to a folder of 100 only processes the 2 new ones. Inspired by qmd's approach to incremental embedding.

## Cost Estimation

Before running a batch, show what it would cost:

```bash
$ m2md ./assets/ --estimate

  Files to process: 47 images (12 cached, 35 new)
  Estimated tokens: ~42,000 input + ~8,000 output
  Estimated cost:   ~$0.15 (Claude Sonnet)

  Run without --estimate to process.
```

Cost per image (approximate, Claude Sonnet):
- Small screenshot (~500 tokens): ~$0.002
- Large screenshot (~1,500 tokens): ~$0.005
- Batch of 100 mixed images: ~$0.30

## Architecture

```
m2md/
├── src/
│   ├── cli.ts              # CLI entry point (argument parsing)
│   ├── processor.ts        # Core: file → markdown pipeline
│   ├── providers/
│   │   ├── index.ts        # Provider interface
│   │   ├── anthropic.ts    # Claude vision API
│   │   ├── openai.ts       # OpenAI vision API
│   │   └── ollama.ts       # Local models (future)
│   ├── personas/
│   │   ├── index.ts        # Persona loader
│   │   └── builtins.ts     # default, brand, design, developer, a11y, marketing
│   ├── templates/
│   │   ├── engine.ts       # Template rendering (Handlebars)
│   │   ├── builtins.ts     # Built-in templates
│   │   └── loader.ts       # Custom template loading
│   ├── extractors/
│   │   ├── metadata.ts     # Image metadata (sharp/exif)
│   │   └── ocr.ts          # Text extraction (via vision model)
│   ├── cache/
│   │   ├── store.ts        # Hash-based cache (SQLite or flat files)
│   │   └── hash.ts         # Content hashing
│   ├── output/
│   │   ├── writer.ts       # File/stdout output
│   │   └── naming.ts       # Filename patterns
│   ├── cost.ts             # Token estimation + cost calculation
│   └── config.ts           # Config file loading + merging (cosmiconfig)
├── templates/               # Built-in template files
├── package.json
├── tsconfig.json
└── README.md
```

## Tech Stack

| Component | Choice | Why |
|-----------|--------|-----|
| Language | TypeScript | AI SDKs are first-class, npm distribution, fast to build |
| Runtime | Node.js (bun-compatible) | Wide install base, bun compile for binary later |
| CLI framework | Commander | Mature, well-typed, lightweight |
| Image metadata | sharp | Fast, native, handles EXIF |
| AI (vision) | @anthropic-ai/sdk | Best vision model, first-party SDK |
| AI (alt) | openai SDK | Second provider option |
| Templates | Handlebars | Simple, familiar syntax, conditionals |
| Config | cosmiconfig | Standard config file loading |
| Cache | SQLite (better-sqlite3) | Fast, single-file, query-able |
| Testing | vitest | Fast, TypeScript-native |

## API Design (for programmatic use)

The core function should be usable as a library, not just CLI:

```typescript
import { processImage } from 'm2md'

const result = await processImage('screenshot.png', {
  provider: 'anthropic',
  persona: 'brand',
  ocr: true
})

result.description    // AI description
result.extractedText  // OCR text array
result.metadata       // { dimensions, format, size, hash, ... }
result.toMarkdown()   // rendered markdown string
```

## Prompt Design

Single API call returning structured output (description + OCR combined). The persona modifies the system prompt, not the user prompt.

### System prompt (base)

```
You describe images in structured detail for machine consumption.
Your descriptions should be specific enough that someone who cannot
see the image understands exactly what is shown.
```

### System prompt (persona modifier, example: brand)

```
You are a brand analyst. When describing images, focus on:
- Positioning and messaging signals
- Voice and tone of any copy
- Competitive implications
- Target audience signals
- Visual brand identity (colors, typography, imagery style)

Describe what the brand is communicating, not just what is visually present.
```

### User prompt

```
Describe this image. Return your response in this exact format:

DESCRIPTION:
[Detailed description in prose]

EXTRACTED_TEXT:
- [Each text element on its own line]
- [Or "No text detected." if none visible]
```

Single call, structured response, parsed into sections. Cheaper and faster than two calls.

## Supported Formats (v1)

| Format | Support |
|--------|---------|
| PNG | Yes |
| JPG/JPEG | Yes |
| WebP | Yes |
| GIF | First frame |
| SVG | Rasterize first (via sharp) |
| HEIC | Via sharp |
| TIFF | Via sharp |

## Future (v2+)

### Provider tiers and cost optimization

v1 ships with Anthropic + OpenAI as explicit `--provider` choices. v2 introduces smart provider tiers:

```bash
# v2 tier shortcuts
m2md screenshot.png --tier quality    # Claude Sonnet / GPT-4o (best descriptions)
m2md screenshot.png --tier fast       # GPT-4o-mini / Gemini Flash-Lite (near-zero cost)
m2md screenshot.png --tier local      # Moondream 2B on-device (free, ~10s/image on Apple Silicon)

# v2 batch API (50% cheaper, async, results within 24h)
m2md ./big-folder/ --batch            # submit to provider batch API
m2md batch status                     # check progress
m2md batch fetch                      # download results when ready

# v2 smart mode (two-pass: cheap first, quality for uncertain images)
m2md ./assets/ --smart                # local/fast pass → flag low-confidence → quality pass
```

#### Cost comparison per 1,000 images

| Tier | Model | Cost (standard) | Cost (batch, 50% off) |
|------|-------|----------------|----------------------|
| local | Moondream 2B (on-device) | $0.00 | N/A |
| fast | GPT-4o-mini (low detail) | $0.13 | $0.07 |
| fast | Gemini 2.5 Flash-Lite | $0.21 | $0.10 |
| quality | Claude Haiku 4.5 | $2.40 | $1.20 |
| quality | Claude Sonnet 4.5 | $7.19 | $3.60 |

#### Smart mode (two-pass)

1. Run every image through local or fast tier
2. Score confidence on each description
3. Only send low-confidence images (~20-30%) to quality tier
4. Estimated savings: 60-80% vs sending everything to quality

This needs real testing first — the quality gap between cheap and expensive models matters a lot for nuanced images (marketing materials, UI mockups, brand assets). Simple photos are fine on cheap models. Complex compositions with cultural context, subtle messaging, or layered UI need quality models.

#### Local model candidates

| Model | Size | Apple Silicon Speed | Strengths |
|-------|------|-------------------|-----------|
| Moondream 2B | 2B params | ~35 tok/s (M1 Max) | General captioning, small footprint |
| Qwen3-VL-8B | 8B params | Needs 16GB+ | Strong OCR, document understanding |
| Apple FastVLM | Varies | 85x faster than LLaVA | Optimized for Apple Silicon |
| Pixtral 12B | 12B params | Needs 16GB+ | Strong instruction following |

### Other v2+ features

| Feature | Description |
|---------|-------------|
| Video | Extract keyframes, transcribe audio, generate per-frame descriptions |
| Audio | Transcribe + summarize |
| PDF | Extract text + describe visual elements (charts, diagrams) |
| Watch mode | `m2md watch ./assets/` — auto-process new files |
| Diff mode | Re-run and show what changed in description |
| MCP server | Expose as MCP tool for AI agents |
| Comparison mode | `m2md compare a.png b.png` — describe differences |

## Distribution

```bash
# npm (primary)
npm install -g m2md
npx m2md image.png

# Homebrew (later)
brew install m2md

# Binary (later, via bun compile)
curl -fsSL https://m2md.dev/install.sh | sh
```

## Implementation Guide

This section is for the LLM agent building the project.

### Build order

Build and test in this sequence. Each phase should be fully working before moving to the next.

1. **Scaffold** — `package.json`, `tsconfig.json`, `.gitignore`, project structure, install deps
2. **Core processor** — single image in → structured result out (Anthropic provider only, default persona, default template)
3. **CLI basics** — `m2md image.png` works, stdout output, single file
4. **Metadata extraction** — sharp for dimensions, format, size, EXIF dates
5. **OCR** — add extracted text to the single API call, parse response
6. **Templates** — default template with frontmatter, minimal, alt-text, custom template loading
7. **Personas** — system prompt modifiers, all 5 built-in personas + custom `--prompt`
8. **Batch/sidecar** — directory input, glob support, `-r` recursive, sidecar output
9. **Caching** — content hash, skip unchanged files, `cache status`, `cache clear`
10. **Cost estimation** — `--estimate` flag, token counting
11. **Config file** — cosmiconfig loading, precedence chain
12. **OpenAI provider** — second provider option
13. **Polish** — error messages, progress output, `--dry-run`, `-v` verbose, `NO_COLOR` support

### Package scaffold

```json
{
  "name": "m2md",
  "version": "0.1.0",
  "description": "Make media files machine-readable. AI-powered image descriptions, OCR, and metadata as structured markdown.",
  "bin": {
    "m2md": "./dist/cli.js"
  },
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "files": ["dist", "templates"],
  "scripts": {
    "build": "tsup src/cli.ts src/index.ts --format esm --dts",
    "dev": "tsup src/cli.ts src/index.ts --format esm --dts --watch",
    "test": "vitest",
    "lint": "eslint src/",
    "prepublishOnly": "npm run build"
  },
  "keywords": ["markdown", "image", "ai", "ocr", "media", "cli", "vision", "description", "accessibility", "alt-text"],
  "license": "MIT",
  "engines": {
    "node": ">=18"
  }
}
```

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src/**/*"]
}
```

### Dependencies

```bash
# Core
npm install commander @anthropic-ai/sdk openai sharp handlebars cosmiconfig better-sqlite3

# Dev
npm install -D typescript tsup vitest @types/better-sqlite3 @types/node eslint
```

### Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes (if using Anthropic) | Claude API key |
| `OPENAI_API_KEY` | Yes (if using OpenAI) | OpenAI API key |
| `M2MD_CACHE_DIR` | No | Override cache location (default: `~/.cache/m2md/`) |
| `NO_COLOR` | No | Disable colored output (standard convention) |

Missing API key should produce a clear error: `Error: ANTHROPIC_API_KEY not set. Run: export ANTHROPIC_API_KEY=your_key`

### Error handling

| Scenario | Behavior |
|----------|----------|
| Missing API key | Exit 1 with clear message showing which env var to set |
| Invalid image file | Skip with warning, continue batch. Exit 1 if single file. |
| Corrupted image | Skip with warning, continue batch |
| API rate limit (429) | Retry with exponential backoff (3 attempts, 1s/2s/4s) |
| API error (5xx) | Retry once, then skip with warning |
| API error (4xx, not 429) | Skip with error message (likely image too large or unsupported) |
| Empty directory | Exit 0 with message "No images found" |
| No write permission | Exit 1 with clear error |
| Unsupported file format | Skip with warning |
| Template file not found | Exit 1 with error |
| Config file malformed | Exit 1 with parse error and file path |

### Exit codes

| Code | Meaning |
|------|---------|
| 0 | Success (all files processed, or nothing to do) |
| 1 | Error (missing API key, invalid input, write failure) |
| 2 | Partial success (some files failed in batch mode) |

### Batch concurrency

Process images in parallel with a concurrency limit:
- Default: 5 concurrent API calls
- Flag: `--concurrency 10` to adjust
- Progress output during batch: `Processing: 12/47 (3 cached, 2 failed)`

### Progress output (stderr, not stdout)

Single file:
```
m2md: Processing screenshot.png...
m2md: Done (1.2s, ~820 tokens)
```

Batch:
```
m2md: Found 47 images (12 cached, 35 to process)
m2md: [=========>          ] 15/35  pricing-page.png (1.1s)
m2md: Done. 35 processed, 12 cached, 0 failed (28.4s)
```

All progress output goes to stderr so stdout stays clean for piping.

### Test cases

Write tests for these scenarios:

**Unit tests (no API calls, mock the provider):**
1. Metadata extraction — PNG, JPG, WebP with known dimensions
2. Template rendering — default, minimal, alt-text with known variables
3. Custom template loading — Handlebars file with all variables
4. Frontmatter generation — correct YAML with all fields
5. Content hash calculation — same file = same hash, different file = different hash
6. Config loading — CLI flags override project config override home config
7. Filename pattern — `{date}-{filename}` produces correct output
8. Persona system prompt assembly — base + persona modifier concatenated correctly
9. Response parsing — `DESCRIPTION:` and `EXTRACTED_TEXT:` sections extracted correctly
10. Cost estimation — token count approximation for known image sizes

**Integration tests (real API calls, use small test images):**
1. Single file to stdout — PNG with text in it
2. Single file to sidecar — creates .md next to image
3. Batch directory — processes all images, creates sidecars
4. Cache hit — second run skips already-processed files
5. `--no-cache` — forces reprocessing
6. `--no-ocr` — output has no extracted text section
7. `--persona brand` — output contains brand-specific language
8. `--template minimal` — output matches minimal format
9. `--estimate` — shows cost without calling API
10. `--dry-run` — lists files without processing

### .gitignore

```
node_modules/
dist/
*.tgz
.env
.DS_Store
```

### README structure

The published README should follow this order:
1. One-line description + badges (npm version, license)
2. Install: `npm install -g m2md`
3. Quick start: 3 example commands with output
4. Why this exists (2 sentences)
5. Features list
6. Usage (all commands with examples)
7. Personas (table + examples)
8. Templates (built-in + custom)
9. Configuration
10. Caching
11. Programmatic API
12. Cost
13. Supported formats
14. Contributing
15. License

## Decisions Made

- **Package name:** `m2md` (available on npm, short, descriptive)
- **Single API call:** One call for description+OCR (cheaper, faster). Split if quality suffers.
- **Caching:** Yes, by content hash. Default on.
- **Frontmatter:** Default on (opt out with `--no-frontmatter` or minimal template)
- **Sidecar mode:** Default for directories, stdout default for single files
- **Personas over context flags:** Built-in personas (brand, design, dev, a11y, marketing) + custom `--prompt` for anything else. More repeatable than free-text `--context`.

## Cost

Claude Sonnet vision is ~$3/1M input tokens. A typical screenshot is ~1k tokens. Batch of 100 images ≈ $0.30. The `--estimate` flag shows cost before running.
