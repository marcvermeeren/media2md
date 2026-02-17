import { describe, it, expect } from "vitest";
import { parseResponse } from "../src/parser.js";

describe("parseResponse", () => {
  it("parses well-formatted response with text", () => {
    const raw = `DESCRIPTION:
This is a screenshot of a login form with email and password fields.

EXTRACTED_TEXT:
Email
Password
Sign In
Forgot password?`;

    const result = parseResponse(raw);
    expect(result.description).toBe(
      "This is a screenshot of a login form with email and password fields."
    );
    expect(result.extractedText).toEqual([
      "Email",
      "Password",
      "Sign In",
      "Forgot password?",
    ]);
  });

  it("parses response with no extracted text", () => {
    const raw = `DESCRIPTION:
A beautiful sunset over the ocean with warm orange and purple tones.

EXTRACTED_TEXT:
None`;

    const result = parseResponse(raw);
    expect(result.description).toBe(
      "A beautiful sunset over the ocean with warm orange and purple tones."
    );
    expect(result.extractedText).toEqual([]);
  });

  it("handles multi-paragraph description", () => {
    const raw = `DESCRIPTION:
First paragraph about the image.

Second paragraph with more details.

Third paragraph with final observations.

EXTRACTED_TEXT:
Some text`;

    const result = parseResponse(raw);
    expect(result.description).toContain("First paragraph");
    expect(result.description).toContain("Second paragraph");
    expect(result.description).toContain("Third paragraph");
    expect(result.extractedText).toEqual(["Some text"]);
  });

  it("falls back gracefully for malformed response", () => {
    const raw = "This is just a plain response without the expected format.";

    const result = parseResponse(raw);
    expect(result.description).toBe(raw);
    expect(result.extractedText).toEqual([]);
  });

  it("falls back for empty response", () => {
    const result = parseResponse("");
    expect(result.description).toBe("");
    expect(result.extractedText).toEqual([]);
  });

  it("handles response with only DESCRIPTION label", () => {
    const raw = `DESCRIPTION:
Just a description, no extracted text section.`;

    const result = parseResponse(raw);
    expect(result.description).toBe(
      "Just a description, no extracted text section."
    );
    expect(result.extractedText).toEqual([]);
  });

  it("filters blank lines from extracted text", () => {
    const raw = `DESCRIPTION:
An image.

EXTRACTED_TEXT:
Line 1

Line 2

Line 3`;

    const result = parseResponse(raw);
    expect(result.extractedText).toEqual(["Line 1", "Line 2", "Line 3"]);
  });
});
