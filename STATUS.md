# m2md — Implementation Status

## Implemented

### Core
- [x] Single image → structured markdown (description + extracted text + metadata)
- [x] YAML frontmatter with dimensions, format, size, SHA-256, date, model
- [x] Anthropic Claude vision provider (SDK retry, base64 encoding)
- [x] LLM response parser with graceful fallback
- [x] Single file read with buffer reuse (no double reads)
- [x] All UI output to stderr, only markdown to stdout

### CLI
- [x] `m2md <file>` — sidecar mode by default (writes .md next to image)
- [x] `m2md <dir>` — batch processing with sequential spinners
- [x] `m2md setup` — API key check and verification
- [x] `--stdout` — output to stdout instead of writing files
- [x] `-o <dir>` — custom output directory
- [x] `-r` — recursive directory scanning
- [x] `-m / --model` — model selection
- [x] `-p / --persona` — built-in personas
- [x] `--prompt` — custom prompt (overrides persona)
- [x] `-t / --template` — template selection or custom file
- [x] `-v / --verbose` — detailed output
- [x] `--estimate` — cost preview without API calls (works without API key)
- [x] `--dry-run` — list files with cached/new status + cost estimate
- [x] `--no-cache` — skip cache, force re-processing
- [x] `--concurrency <n>` — max concurrent API calls
- [x] Smart spaces-in-filename handling (unquoted args joined automatically)
- [x] Friendly onboarding when API key is missing

### Templates
- [x] `default` — full frontmatter + description + extracted text + source link
- [x] `minimal` — description + source link
- [x] `alt-text` — bare description only
- [x] `detailed` — everything + metadata table
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
- [x] Cache key = content hash + model + persona + prompt + template
- [x] `cache status` — entry count, size, location
- [x] `cache clear` — wipe all cached results
- [x] Respects `XDG_CACHE_HOME` and `M2MD_CACHE_DIR`

### Config
- [x] Config file via cosmiconfig (`m2md.config.json`, `.m2mdrc`, etc.)
- [x] CLI flags take precedence over config values

### Cost Estimation
- [x] Token estimation based on image dimensions
- [x] Pricing for Sonnet, Opus, Haiku
- [x] `--estimate` and `--dry-run` work without API key

### Testing
- [x] 119 tests across 13 test files
- [x] Metadata, template engine, parser, personas, cache, batch, cost, config, writer, resolve-args, cache integration, processor

---

## Not Yet Implemented

### Providers
- [ ] OpenAI provider (`--provider openai`)
- [ ] Ollama / local models (`--provider ollama --model llava`)
- [ ] `--provider` flag in CLI

### Output Quality
- [ ] Refine system prompts for optimal machine-readable output (structured for LLM/AI consumption)
- [ ] Optimize frontmatter schema for downstream AI pipelines
- [ ] Persona prompt tuning (sharper, more consistent output per role)
- [ ] Extracted text formatting improvements (tables, code blocks, lists)

### Features
- [ ] Watch mode (`m2md watch ./assets/`)
- [ ] `--no-frontmatter` flag
- [ ] Custom filename patterns (`--name "{date}-{filename}"`)
- [ ] Batch API (async 50% cheaper processing)
- [ ] Smart two-pass mode (cheap model first, quality for uncertain)
- [ ] Comparison mode (`m2md compare a.png b.png`)

### Media Types
- [ ] PDF support
- [ ] Video (keyframes + transcript)
- [ ] Audio (transcript + summary)
- [ ] SVG (rasterize first)
- [ ] HEIC / TIFF support

### Distribution
- [ ] README
- [ ] npm publish
- [ ] Homebrew formula
- [ ] Binary via bun compile

### Integration
- [ ] MCP server (expose as tool for AI agents)
