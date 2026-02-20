export const DEFAULT_TEMPLATE = `---
type: {{type}}
{{#if category}}category: [{{category}}]
{{/if}}{{#if style}}style: [{{style}}]
{{/if}}{{#if mood}}mood: [{{mood}}]
{{/if}}{{#if medium}}medium: {{medium}}
{{/if}}{{#if composition}}composition: [{{composition}}]
{{/if}}{{#if palette}}palette: [{{palette}}]
{{/if}}subject: "{{subject}}"
tags: [{{tags}}]
source: {{filename}}
dimensions: {{dimensions}}
processed: {{processedDate}}
model: {{model}}
{{#if note}}note: "{{note}}"
{{/if}}---

{{description}}

{{#if extractedText}}
## Text

{{extractedText}}
{{/if}}
`;

export const MINIMAL_TEMPLATE = `{{description}}

Source: [{{filename}}]({{sourcePath}})
`;

export const ALT_TEXT_TEMPLATE = `{{description}}
`;

export const DETAILED_TEMPLATE = `---
type: {{type}}
{{#if category}}category: [{{category}}]
{{/if}}{{#if style}}style: [{{style}}]
{{/if}}{{#if mood}}mood: [{{mood}}]
{{/if}}{{#if medium}}medium: {{medium}}
{{/if}}{{#if composition}}composition: [{{composition}}]
{{/if}}{{#if palette}}palette: [{{palette}}]
{{/if}}subject: "{{subject}}"
colors: [{{colors}}]
tags: [{{tags}}]
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
{{#if note}}note: "{{note}}"
{{/if}}---

# {{basename}}

{{subject}}

{{description}}

{{#if extractedText}}
## Text

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
