#!/bin/bash
# Demo all CLI output states for design review
# Usage: ./scripts/demo-outputs.sh

CLI="node $(dirname "$0")/../dist/cli.js"
FIXTURE="$(dirname "$0")/../tests/fixtures/test-image.png"
REAL_IMAGE="/Users/marc/Desktop/Screenshot 2026-02-16 at 20.02.08.png"

divider() {
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  📌  $1"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
}

# 1. Help
divider "HELP (--help)"
$CLI --help 2>&1

# 2. Version
divider "VERSION (--version)"
$CLI --version 2>&1

# 3. No API key
divider "NO API KEY"
ANTHROPIC_API_KEY="" $CLI "$FIXTURE" 2>&1 || true

# 4. No supported images
divider "NO SUPPORTED IMAGES"
$CLI /tmp 2>&1 || true

# 5. Setup without key
divider "SETUP (no key)"
ANTHROPIC_API_KEY="" $CLI setup 2>&1 || true

# 6. Setup with key
divider "SETUP (with key)"
$CLI setup 2>&1 || true

# 7. Cache status
divider "CACHE STATUS"
$CLI cache status 2>&1

# 8. Estimate
divider "ESTIMATE (--estimate)"
if [ -f "$REAL_IMAGE" ]; then
  $CLI "$REAL_IMAGE" --estimate 2>&1 || true
else
  $CLI "$FIXTURE" --estimate 2>&1 || true
fi

# 9. Dry run
divider "DRY RUN (--dry-run)"
if [ -f "$REAL_IMAGE" ]; then
  $CLI "$REAL_IMAGE" --dry-run 2>&1 || true
else
  $CLI "$FIXTURE" --dry-run 2>&1 || true
fi

# 10. Single file (cached)
divider "SINGLE FILE — SIDECAR (cached)"
if [ -f "$REAL_IMAGE" ]; then
  $CLI "$REAL_IMAGE" 2>&1 || true
fi

# 11. Error (unsupported format)
divider "ERROR (unsupported format)"
$CLI /tmp/fake.bmp 2>&1 || true

# 12. Postinstall
divider "POSTINSTALL (global install message)"
npm_config_global=true node "$(dirname "$0")/postinstall.js" 2>&1

# 13. Cache clear (dry — just show current state)
divider "CACHE CLEAR"
echo "  (skipped to preserve cache — would show:)"
echo '  ✓ Cleared N cached results.'

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Done — all output states above."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
