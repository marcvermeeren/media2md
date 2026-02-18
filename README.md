# m2md

Convert images to structured markdown with AI vision. Descriptions, extracted text, and metadata — ready for search, AI context windows, and documentation.

```bash
npm install -g m2md
```

## Quick start

```bash
# Describe a screenshot → writes screenshot.md next to it
m2md screenshot.png

# Batch an entire directory
m2md ./assets/

# Print to stdout (pipe to clipboard, another tool, etc.)
m2md screenshot.png --stdout | pbcopy
```

## Why

Images are black boxes to AI tools, search, and text workflows. You can't grep a screenshot. m2md fixes that — one command turns any image into structured, searchable markdown with AI-generated descriptions and extracted text.

## Features

- AI-powered image descriptions via Claude vision
- Text extraction (OCR) from screenshots, documents, diagrams
- YAML frontmatter with metadata (dimensions, format, hash)
- Sidecar `.md` files next to images — makes directories greppable
- 5 built-in personas (brand, design, developer, accessibility, marketing)
- Focus directives (`--note`) that layer on top of any prompt mode
- Customizable templates (default, minimal, alt-text, detailed, or your own)
- Content-hash caching — skip unchanged files automatically
- Cost estimation before processing (`--estimate`)
- Batch processing with concurrency control
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

### Personas

Built-in personas shape how the AI describes images:

```bash
m2md screenshot.png --persona brand          # brand analyst lens
m2md screenshot.png --persona design         # UI/UX designer lens
m2md screenshot.png --persona developer      # software developer lens
m2md screenshot.png --persona accessibility  # a11y expert lens
m2md screenshot.png --persona marketing      # marketing analyst lens
```

| Persona | Focus |
|---------|-------|
| `brand` | Positioning, messaging, voice, competitive signals, visual identity |
| `design` | Layout, grid, typography, color palette, spacing, hierarchy |
| `developer` | UI components, architecture, data flows, API surfaces |
| `accessibility` | Alt text, contrast ratios, keyboard navigation, ARIA concerns |
| `marketing` | CTAs, conversion flow, social proof, audience targeting |

### Custom prompt

Override the persona entirely with a freeform prompt:

```bash
m2md screenshot.png --prompt "describe this from a security auditor's perspective"
```

### Focus directives (`--note`)

A freeform directive that's **additive** — it layers on top of whatever system prompt exists (base, persona, or custom `--prompt`). Unlike `--prompt`, it doesn't replace anything.

```bash
m2md refs/*.png -n "watercolor technique, color palette, brushwork"
m2md hero.png --persona design -n "dark mode, spacing tokens"
m2md ./illos/ --prompt "art critique" -n "line weight and hatching"
```

### Templates

```bash
m2md screenshot.png                        # default (frontmatter + description + text)
m2md screenshot.png --template minimal     # description + source link
m2md screenshot.png --template alt-text    # just a description string
m2md screenshot.png --template detailed    # full metadata table
m2md screenshot.png --template ./my.md     # custom Handlebars template
```

Template variables available in custom templates:

| Variable | Description |
|----------|-------------|
| `{{type}}` | Image type (screenshot, photo, diagram, etc.) |
| `{{subject}}` | One-line summary |
| `{{description}}` | AI-generated structured description |
| `{{extractedText}}` | All visible text, grouped by context |
| `{{colors}}` | Dominant colors |
| `{{tags}}` | Key objects, concepts, descriptors |
| `{{filename}}` | Original filename |
| `{{basename}}` | Filename without extension |
| `{{format}}` | File format (PNG, JPEG, WebP, GIF) |
| `{{dimensions}}` | Width x Height |
| `{{width}}` | Image width |
| `{{height}}` | Image height |
| `{{sizeHuman}}` | Human-readable file size |
| `{{sizeBytes}}` | File size in bytes |
| `{{sha256}}` | Content hash |
| `{{processedDate}}` | ISO date |
| `{{datetime}}` | ISO datetime |
| `{{model}}` | AI model used |
| `{{persona}}` | Persona used |
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

### Cost estimation

Preview what a batch will cost before calling the API:

```bash
m2md ./assets/ --estimate     # show token/cost estimate
m2md ./assets/ --dry-run      # list files and cache status
```

### Other flags

```bash
m2md screenshot.png -m claude-sonnet-4-5-20250929   # specific model
m2md ./assets/ --concurrency 10                      # parallel API calls (default: 5)
m2md screenshot.png -v                               # verbose output
```

## Configuration

Optional config file (`m2md.config.json`, `.m2mdrc`, `.m2mdrc.json`, `.m2mdrc.yaml`, or in `package.json` under `"m2md"` key):

```json
{
  "model": "claude-sonnet-4-5-20250929",
  "persona": "design",
  "note": "illustration references — capture style, palette, technique",
  "template": "default",
  "output": "./docs",
  "recursive": true,
  "cache": true,
  "concurrency": 5
}
```

CLI flags take precedence over config file values.

## Setup

```bash
# 1. Install
npm install -g m2md

# 2. Set your API key
export ANTHROPIC_API_KEY="sk-ant-..."

# 3. Verify
m2md setup
```

## Supported formats

PNG, JPEG, WebP, GIF

## Programmatic API

```typescript
import { processFile, AnthropicProvider } from "m2md";

const result = await processFile("screenshot.png", {
  provider: new AnthropicProvider(),
  persona: "design",
  note: "spacing tokens",
});

result.description;    // AI-generated description
result.extractedText;  // extracted text
result.metadata;       // { width, height, format, sizeHuman, sha256, ... }
result.markdown;       // rendered markdown string
```

## License

MIT
