import { describe, it, expect } from "vitest";
import { mergeOptions } from "../src/config.js";

describe("mergeOptions", () => {
  it("returns CLI options when no config values", () => {
    const cli = { model: "claude-opus-4-6", persona: "brand" };
    const config = {};
    const result = mergeOptions(cli, config);
    expect(result.model).toBe("claude-opus-4-6");
    expect(result.persona).toBe("brand");
  });

  it("fills in undefined CLI options from config", () => {
    const cli = { model: undefined, persona: undefined };
    const config = { model: "claude-haiku-4-5-20251001", persona: "design" };
    const result = mergeOptions(cli, config);
    expect(result.model).toBe("claude-haiku-4-5-20251001");
    expect(result.persona).toBe("design");
  });

  it("CLI options take precedence over config", () => {
    const cli = { model: "claude-opus-4-6", persona: "brand" };
    const config = { model: "claude-haiku-4-5-20251001", persona: "design" };
    const result = mergeOptions(cli, config);
    expect(result.model).toBe("claude-opus-4-6");
    expect(result.persona).toBe("brand");
  });

  it("handles mixed defined/undefined options", () => {
    const cli = { model: "from-cli", persona: undefined, template: undefined };
    const config = { model: "from-config", persona: "from-config", template: "minimal" };
    const result = mergeOptions(cli, config);
    expect(result.model).toBe("from-cli");
    expect(result.persona).toBe("from-config");
    expect(result.template).toBe("minimal");
  });

  it("does not override null CLI values", () => {
    const cli = { model: null };
    const config = { model: "from-config" };
    const result = mergeOptions(cli, config);
    expect(result.model).toBe("from-config");
  });
});
