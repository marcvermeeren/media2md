export const DEFAULT_TEMPLATE = `---
source: {{filename}}
format: {{format}}
dimensions: {{dimensions}}
size: {{sizeHuman}}
sha256: {{sha256}}
processed: {{processedDate}}
model: {{model}}
---

# {{basename}}

## Description

{{description}}

{{#if extractedText}}
## Extracted Text

{{extractedText}}
{{/if}}
`;
