import { describe, it, expect } from "vitest";
import { mergeOptions } from "../src/config.js";

describe("mergeOptions", () => {
  it("returns CLI options when no config values", () => {
    const cli = { model: "claude-opus-4-6", prompt: "List products" };
    const config = {};
    const result = mergeOptions(cli, config);
    expect(result.model).toBe("claude-opus-4-6");
    expect(result.prompt).toBe("List products");
  });

  it("fills in undefined CLI options from config", () => {
    const cli = { model: undefined, prompt: undefined };
    const config = { model: "claude-haiku-4-5-20251001", prompt: "Focus on layout" };
    const result = mergeOptions(cli, config);
    expect(result.model).toBe("claude-haiku-4-5-20251001");
    expect(result.prompt).toBe("Focus on layout");
  });

  it("CLI options take precedence over config", () => {
    const cli = { model: "claude-opus-4-6", prompt: "List products" };
    const config = { model: "claude-haiku-4-5-20251001", prompt: "Focus on layout" };
    const result = mergeOptions(cli, config);
    expect(result.model).toBe("claude-opus-4-6");
    expect(result.prompt).toBe("List products");
  });

  it("handles mixed defined/undefined options", () => {
    const cli = { model: "from-cli", prompt: undefined, template: undefined };
    const config = { model: "from-config", prompt: "from-config", template: "minimal" };
    const result = mergeOptions(cli, config);
    expect(result.model).toBe("from-cli");
    expect(result.prompt).toBe("from-config");
    expect(result.template).toBe("minimal");
  });

  it("does not override null CLI values", () => {
    const cli = { model: null };
    const config = { model: "from-config" };
    const result = mergeOptions(cli, config);
    expect(result.model).toBe("from-config");
  });
});
