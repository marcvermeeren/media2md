import { describe, it, expect } from "vitest";
import { parseResponse } from "../src/parser.js";

describe("parseResponse — new six-section format", () => {
  it("parses well-formatted six-section response", () => {
    const raw = `TYPE:
screenshot

SUBJECT:
Login form with email and password fields

COLORS:
white, blue, light gray

TAGS:
login, form, email, password, button, authentication

DESCRIPTION:
## Layout
- Centered card with two input fields and a submit button

## Content
- Email field with placeholder
- Password field with toggle visibility
- "Sign In" primary button

EXTRACTED_TEXT:
**Form Labels:** Email | Password
**Button:** Sign In
**Link:** Forgot password?`;

    const result = parseResponse(raw);
    expect(result.type).toBe("screenshot");
    expect(result.subject).toBe("Login form with email and password fields");
    expect(result.colors).toBe("white, blue, light gray");
    expect(result.tags).toBe("login, form, email, password, button, authentication");
    expect(result.description).toContain("## Layout");
    expect(result.description).toContain("## Content");
    expect(result.description).toContain("Centered card");
    expect(result.extractedText).toContain("**Form Labels:**");
    expect(result.extractedText).toContain("**Button:** Sign In");
  });

  it("normalizes type to lowercase and validates against closed set", () => {
    const raw = `TYPE:
Screenshot

SUBJECT:
A test image

COLORS:
red, blue

TAGS:
test, image

DESCRIPTION:
Test description.

EXTRACTED_TEXT:
None`;

    const result = parseResponse(raw);
    expect(result.type).toBe("screenshot");
  });

  it("defaults invalid type to 'other'", () => {
    const raw = `TYPE:
meme

SUBJECT:
A funny image

COLORS:
yellow, black

TAGS:
funny, meme

DESCRIPTION:
Something funny.

EXTRACTED_TEXT:
None`;

    const result = parseResponse(raw);
    expect(result.type).toBe("other");
  });

  it("truncates subject to 80 characters", () => {
    const longSubject = "A".repeat(100);
    const raw = `TYPE:
photo

SUBJECT:
${longSubject}

COLORS:
red

TAGS:
test

DESCRIPTION:
A photo.

EXTRACTED_TEXT:
None`;

    const result = parseResponse(raw);
    expect(result.subject.length).toBe(80);
  });

  it("preserves extracted text formatting as string", () => {
    const raw = `TYPE:
screenshot

SUBJECT:
Dashboard with navigation

COLORS:
dark blue, white, light gray

TAGS:
dashboard, navigation, stats, revenue, users

DESCRIPTION:
A dashboard view.

EXTRACTED_TEXT:
**Navigation:** Home | Settings | Profile
**Heading:** Welcome back, User
**Stats:**
- Active users: 1,234
- Revenue: $56,789`;

    const result = parseResponse(raw);
    expect(typeof result.extractedText).toBe("string");
    expect(result.extractedText).toContain("**Navigation:**");
    expect(result.extractedText).toContain("- Active users: 1,234");
  });

  it("returns empty extractedText for 'None'", () => {
    const raw = `TYPE:
photo

SUBJECT:
Sunset over the ocean

COLORS:
orange, purple, gold

TAGS:
sunset, ocean, horizon

DESCRIPTION:
A beautiful sunset with warm tones.

EXTRACTED_TEXT:
None`;

    const result = parseResponse(raw);
    expect(result.extractedText).toBe("");
  });

  it("handles all valid types", () => {
    const types = [
      "screenshot", "photo", "diagram", "chart", "logo",
      "icon", "illustration", "document", "whiteboard", "other",
    ];

    for (const t of types) {
      const raw = `TYPE:\n${t}\n\nSUBJECT:\nTest\n\nCOLORS:\nred\n\nTAGS:\ntag\n\nDESCRIPTION:\nDesc.\n\nEXTRACTED_TEXT:\nNone`;
      expect(parseResponse(raw).type).toBe(t);
    }
  });

  it("returns empty colors and tags when sections are missing (legacy four-section)", () => {
    const raw = `TYPE:
photo

SUBJECT:
A test image

DESCRIPTION:
Test description.

EXTRACTED_TEXT:
None`;

    const result = parseResponse(raw);
    expect(result.type).toBe("photo");
    expect(result.colors).toBe("");
    expect(result.tags).toBe("");
  });
});

describe("parseResponse — legacy two-section format", () => {
  it("parses legacy format with type=other, empty subject, empty colors/tags", () => {
    const raw = `DESCRIPTION:
This is a screenshot of a login form with email and password fields.

EXTRACTED_TEXT:
Email
Password
Sign In
Forgot password?`;

    const result = parseResponse(raw);
    expect(result.type).toBe("other");
    expect(result.subject).toBe("");
    expect(result.colors).toBe("");
    expect(result.tags).toBe("");
    expect(result.description).toBe(
      "This is a screenshot of a login form with email and password fields."
    );
    expect(result.extractedText).toContain("Email");
    expect(result.extractedText).toContain("Sign In");
  });

  it("parses legacy response with no extracted text", () => {
    const raw = `DESCRIPTION:
A beautiful sunset over the ocean with warm orange and purple tones.

EXTRACTED_TEXT:
None`;

    const result = parseResponse(raw);
    expect(result.description).toBe(
      "A beautiful sunset over the ocean with warm orange and purple tones."
    );
    expect(result.extractedText).toBe("");
  });

  it("handles multi-paragraph description in legacy format", () => {
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
    expect(result.extractedText).toBe("Some text");
  });

  it("falls back gracefully for malformed response", () => {
    const raw = "This is just a plain response without the expected format.";

    const result = parseResponse(raw);
    expect(result.type).toBe("other");
    expect(result.subject).toBe("");
    expect(result.colors).toBe("");
    expect(result.tags).toBe("");
    expect(result.description).toBe(raw);
    expect(result.extractedText).toBe("");
  });

  it("falls back for empty response", () => {
    const result = parseResponse("");
    expect(result.type).toBe("other");
    expect(result.subject).toBe("");
    expect(result.colors).toBe("");
    expect(result.tags).toBe("");
    expect(result.description).toBe("");
    expect(result.extractedText).toBe("");
  });

  it("handles response with only DESCRIPTION label", () => {
    const raw = `DESCRIPTION:
Just a description, no extracted text section.`;

    const result = parseResponse(raw);
    expect(result.description).toBe(
      "Just a description, no extracted text section."
    );
    expect(result.extractedText).toBe("");
  });
});
