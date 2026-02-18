# m2md — Implementation Status

## Implemented

### Core
- [x] Single image → structured markdown (description + extracted text + metadata)
- [x] YAML frontmatter with dimensions, format, size, SHA-256, date, model
- [x] Single file read with buffer reuse (no double reads)
- [x] All UI output to stderr, only markdown to stdout

### Providers
- [x] Anthropic Claude vision provider (SDK retry, base64 encoding)
- [x] OpenAI GPT-4o / GPT-4o-mini vision provider (SDK retry, data URI encoding)
- [x] Provider tiers (`--tier fast` → gpt-4o-mini, `--tier quality` → claude-sonnet)
- [x] Precedence: explicit `--provider`/`--model` > `--tier` > config > defaults

### CLI
- [x] `m2md <file>` — sidecar mode by default (writes .md next to image)
- [x] `m2md <dir>` — batch processing with sequential spinners
- [x] `m2md <url>` — download image URLs or screenshot web pages
- [x] `m2md watch <dir>` — watch mode with initial scan + debounced queue
- [x] `m2md setup` — API key check and verification
- [x] `--provider` — select AI provider (anthropic, openai)
- [x] `--tier` — preset tier (fast, quality)
- [x] `--stdout` — output to stdout instead of writing files
- [x] `-o <dir>` — custom output directory
- [x] `-r` — recursive directory scanning
- [x] `-m / --model` — model selection
- [x] `-p / --persona` — built-in personas
- [x] `--prompt` — custom prompt (overrides persona)
- [x] `-n / --note` — additive focus directive
- [x] `-t / --template` — template selection or custom file
- [x] `-v / --verbose` — detailed output (tokens, cost, timing)
- [x] `--estimate` — cost preview without API calls (works without API key)
- [x] `--dry-run` — list files with cached/new status + cost estimate
- [x] `--no-cache` — skip cache, force re-processing
- [x] `--no-frontmatter` — strip YAML frontmatter from output
- [x] `--name <pattern>` — custom output filename patterns (`{filename}`, `{date}`, `{type}`, `{subject}`)
- [x] `--concurrency <n>` — max concurrent API calls
- [x] Smart spaces-in-filename handling (unquoted args joined automatically)
- [x] Friendly onboarding when API key is missing
- [x] Mixed local files + URL inputs in a single command

### URL Support
- [x] Image URL fetch with content-type validation
- [x] Playwright screenshot for non-image URLs (optional dependency)
- [x] `extractMetadataFromBuffer` for in-memory images
- [x] `processBuffer` — same pipeline as `processFile` without file I/O

### Watch Mode
- [x] Initial scan — processes images without existing .md sidecar
- [x] chokidar-based file watcher (add/change events)
- [x] 300ms debounce with deduplication queue
- [x] Per-file error handling (keeps watching on failure)
- [x] Graceful SIGINT shutdown with summary

### Templates
- [x] `default` — full frontmatter + description + extracted text + source link
- [x] `minimal` — description + source link
- [x] `alt-text` — bare description only
- [x] `detailed` — everything + metadata table + image embed
- [x] Custom template files (`--template ./my-template.md`)
- [x] Template engine with `{{var}}` and `{{#if var}}...{{/if}}`

### Personas
- [x] `brand` — positioning, messaging, voice
- [x] `design` — layout, typography, color, spacing
- [x] `developer` — UI components, architecture, data flows
- [x] `accessibility` — alt text, contrast, ARIA concerns
- [x] `marketing` — CTAs, conversion, audience targeting

### Caching
- [x] Hash-based cache in `~/.cache/m2md/`
- [x] Cache key = content hash + model + persona + prompt + template + note + provider
- [x] `cache status` — entry count, size, location
- [x] `cache clear` — wipe all cached results
- [x] Respects `XDG_CACHE_HOME` and `M2MD_CACHE_DIR`
- [x] Shared cache between CLI and MCP server

### Config
- [x] Config file via cosmiconfig (`m2md.config.json`, `.m2mdrc`, etc.)
- [x] CLI flags take precedence over config values
- [x] Tier config support

### Cost Estimation
- [x] Token estimation based on image dimensions
- [x] Pricing for Claude (Sonnet, Opus, Haiku) and OpenAI (GPT-4o, GPT-4o-mini)
- [x] `--estimate` and `--dry-run` work without API key
- [x] `formatModel` handles both Claude and OpenAI model names

### MCP Server
- [x] `m2md-mcp` binary (stdio transport)
- [x] `describe_image` tool with full parameter support
- [x] Error handling with MCP `isError` convention
- [x] Shares cache with CLI

### Testing
- [x] 178 tests across 17 test files
- [x] Metadata, template engine, parser, personas, cache, batch, cost, config, writer, resolve-args, cache integration, processor, OpenAI provider, URL utilities

---

## Not Yet Implemented

### Roadmap (in order)

1. ~~**MCP: auto-resolve API key**~~ ✅
2. ~~**`--no-frontmatter` flag**~~ ✅
3. ~~**Custom filename patterns**~~ ✅
4. **Comparison mode** — `m2md compare a.png b.png`
5. **Clipboard support** — `m2md --clipboard` grab screenshot from clipboard
6. **PDF support** — extract pages, describe content
7. **SVG / HEIC / TIFF support** — rasterize/convert then process
8. **Audio support** — transcript + summary
9. **Video support** — keyframes + transcript
10. **Distribution** — npm publish, Homebrew formula, bun compile binary

### Backlog (unscheduled)

- Ollama / local models (`--provider ollama --model llava`)
- Refine system prompts for optimal machine-readable output
- Persona prompt tuning (sharper, more consistent output per role)
- Batch API (async 50% cheaper processing)
- Smart two-pass mode (cheap model first, quality for uncertain)
- Pipe input (`cat image.png | m2md --stdin`)
- Diff mode — re-process only where `.md` is older than the image
- Gallery page (`m2md gallery ./assets/` — index markdown with all images + summaries)
- Git hook — auto-process images on commit
- Obsidian template — `[[wikilinks]]`, `#tags`, Dataview-compatible frontmatter
- Obsidian vault watch mode recipe
