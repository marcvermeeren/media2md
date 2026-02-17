export function renderTemplate(
  template: string,
  vars: Record<string, string | undefined>
): string {
  // Process {{#if var}}...{{/if}} blocks
  let result = template.replace(
    /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
    (_match, key: string, content: string) => {
      return vars[key] ? content : "";
    }
  );

  // Replace {{var}} placeholders
  result = result.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    return vars[key] ?? "";
  });

  // Clean up multiple consecutive blank lines
  result = result.replace(/\n{3,}/g, "\n\n");

  return result.trim() + "\n";
}
