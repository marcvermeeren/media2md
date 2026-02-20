import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { table, stripAnsi } from "../src/utils/logger.js";

describe("table", () => {
  let output: string;
  const originalWrite = process.stderr.write;

  beforeEach(() => {
    output = "";
    process.stderr.write = vi.fn((chunk: string | Uint8Array) => {
      output += typeof chunk === "string" ? chunk : chunk.toString();
      return true;
    }) as typeof process.stderr.write;
  });

  afterEach(() => {
    process.stderr.write = originalWrite;
  });

  it("renders header and rows with alignment", () => {
    table(
      [{ header: "Name" }, { header: "Value", align: "right" }],
      [
        ["alpha", "1"],
        ["beta", "22"],
      ],
    );

    const lines = output.split("\n").filter(Boolean);
    expect(lines).toHaveLength(4); // header + separator + 2 rows
    expect(stripAnsi(lines[0])).toContain("Name");
    expect(stripAnsi(lines[0])).toContain("Value");
    // separator line
    expect(stripAnsi(lines[1])).toMatch(/^  ─+$/);
    // data rows
    expect(stripAnsi(lines[2])).toContain("alpha");
    expect(stripAnsi(lines[3])).toContain("beta");
  });

  it("renders footer with bottom separator", () => {
    table(
      [{ header: "File" }, { header: "Size" }],
      [["a.png", "1 MB"]],
      ["1 file", "1 MB"],
    );

    const lines = output.split("\n").filter(Boolean);
    // header + sep + row + sep + footer = 5
    expect(lines).toHaveLength(5);
    expect(stripAnsi(lines[4])).toContain("1 file");
  });

  it("right-aligns columns when specified", () => {
    table(
      [{ header: "Name" }, { header: "Count", align: "right" }],
      [
        ["short", "1"],
        ["longer-name", "100"],
      ],
    );

    const lines = output.split("\n").filter(Boolean);
    const row1 = stripAnsi(lines[2]);
    const row2 = stripAnsi(lines[3]);
    // "1" should be padded with spaces before it, "100" should not
    // Both should end at the same column
    const idx1 = row1.indexOf("1");
    const idx2 = row2.indexOf("100");
    // The "1" should appear further right than "100" starts
    expect(idx1).toBeGreaterThan(idx2);
  });

  it("auto-sizes columns from content", () => {
    table(
      [{ header: "X" }],
      [["a-very-long-value"]],
    );

    const lines = output.split("\n").filter(Boolean);
    // Separator should be at least as wide as the longest value
    const sepWidth = stripAnsi(lines[1]).trim().length;
    expect(sepWidth).toBeGreaterThanOrEqual("a-very-long-value".length);
  });

  it("handles empty rows gracefully", () => {
    table(
      [{ header: "A" }, { header: "B" }],
      [],
    );

    const lines = output.split("\n").filter(Boolean);
    expect(lines).toHaveLength(2); // header + separator only
  });
});

describe("stripAnsi", () => {
  it("strips color codes", () => {
    expect(stripAnsi("\x1b[31mred\x1b[0m")).toBe("red");
  });

  it("returns plain string unchanged", () => {
    expect(stripAnsi("plain")).toBe("plain");
  });
});
