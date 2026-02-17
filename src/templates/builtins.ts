export const DEFAULT_TEMPLATE = `---
source: {{filename}}
format: {{format}}
dimensions: {{dimensions}}
size: {{sizeHuman}}
sha256: {{sha256}}
processed: {{processedDate}}
model: {{model}}
{{#if persona}}persona: {{persona}}
{{/if}}---

# {{basename}}

## Description

{{description}}

{{#if extractedText}}
## Extracted Text

{{extractedText}}
{{/if}}

## Source

![{{basename}}]({{sourcePath}})
`;

export const MINIMAL_TEMPLATE = `{{description}}

Source: [{{filename}}]({{sourcePath}})
`;

export const ALT_TEXT_TEMPLATE = `{{description}}
`;

export const DETAILED_TEMPLATE = `---
source: {{filename}}
format: {{format}}
dimensions: {{dimensions}}
width: {{width}}
height: {{height}}
size: {{sizeHuman}}
sizeBytes: {{sizeBytes}}
sha256: {{sha256}}
processed: {{processedDate}}
model: {{model}}
{{#if persona}}persona: {{persona}}
{{/if}}---

# {{basename}}

## Description

{{description}}

{{#if extractedText}}
## Extracted Text

{{extractedText}}
{{/if}}

## Metadata

| Property | Value |
|----------|-------|
| File | {{filename}} |
| Format | {{format}} |
| Dimensions | {{dimensions}} |
| Size | {{sizeHuman}} |
| SHA-256 | {{sha256}} |
| Processed | {{processedDate}} |
| Model | {{model}} |

## Source

![{{basename}}]({{sourcePath}})
`;

export const BUILTIN_TEMPLATES: Record<string, string> = {
  default: DEFAULT_TEMPLATE,
  minimal: MINIMAL_TEMPLATE,
  "alt-text": ALT_TEXT_TEMPLATE,
  detailed: DETAILED_TEMPLATE,
};
