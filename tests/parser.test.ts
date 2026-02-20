import { describe, it, expect } from "vitest";
import { parseResponse } from "../src/parser.js";

describe("parseResponse — new retrieval-optimized format", () => {
  it("parses well-formatted response with all new fields", () => {
    const raw = `TYPE:
screenshot

CATEGORY:
ui-design

STYLE:
minimalist, flat, corporate

MOOD:
calm, modern

MEDIUM:
screen-capture

COMPOSITION:
centered, grid

PALETTE:
dark-blue, white, light-gray

SUBJECT:
Login form with email and password fields

TAGS:
login-form, email-input, password-field, sign-in-button, authentication

DESCRIPTION:
- Centered card with two input fields and a submit button
- Email field with placeholder text
- Password field with toggle visibility icon
- "Sign In" primary button in blue
- Light gray background with subtle shadow on card

EXTRACTED_TEXT:
**Form Labels:** Email | Password
**Button:** Sign In
**Link:** Forgot password?`;

    const result = parseResponse(raw);
    expect(result.type).toBe("screenshot");
    expect(result.category).toBe("ui-design");
    expect(result.style).toBe("minimalist, flat, corporate");
    expect(result.mood).toBe("calm, modern");
    expect(result.medium).toBe("screen-capture");
    expect(result.composition).toBe("centered, grid");
    expect(result.palette).toBe("dark-blue, white, light-gray");
    expect(result.subject).toBe("Login form with email and password fields");
    expect(result.tags).toBe("login-form, email-input, password-field, sign-in-button, authentication");
    expect(result.description).toContain("Centered card");
    expect(result.description).toContain("primary button in blue");
    expect(result.extractedText).toContain("**Form Labels:**");
    expect(result.extractedText).toContain("**Button:** Sign In");
  });

  it("populates colors from palette field", () => {
    const raw = `TYPE:
photo

CATEGORY:
photography

STYLE:
minimalist, japanese

MOOD:
calm, refined

MEDIUM:
product-photography

COMPOSITION:
centered, negative-space

PALETTE:
kraft-brown, matte-black, off-white

SUBJECT:
Japanese tea packaging

TAGS:
tea, kraft-paper, wax-seal

DESCRIPTION:
- Centered kraft paper box on neutral background

EXTRACTED_TEXT:
None`;

    const result = parseResponse(raw);
    expect(result.palette).toBe("kraft-brown, matte-black, off-white");
    // colors is populated from palette
    expect(result.colors).toBe("kraft-brown, matte-black, off-white");
  });

  it("normalizes type to lowercase and validates against closed set", () => {
    const raw = `TYPE:
Screenshot

SUBJECT:
A test image

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

DESCRIPTION:
Something funny.

EXTRACTED_TEXT:
None`;

    const result = parseResponse(raw);
    expect(result.type).toBe("other");
  });

  it("accepts new types: render-3d, collage, pattern, mockup", () => {
    for (const t of ["render-3d", "collage", "pattern", "mockup"]) {
      const raw = `TYPE:\n${t}\n\nSUBJECT:\nTest\n\nDESCRIPTION:\nDesc.\n\nEXTRACTED_TEXT:\nNone`;
      expect(parseResponse(raw).type).toBe(t);
    }
  });

  it("truncates subject to 80 characters", () => {
    const longSubject = "A".repeat(100);
    const raw = `TYPE:
photo

SUBJECT:
${longSubject}

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

DESCRIPTION:
- A dashboard view

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

DESCRIPTION:
- A beautiful sunset with warm tones

EXTRACTED_TEXT:
None`;

    const result = parseResponse(raw);
    expect(result.extractedText).toBe("");
  });

  it("handles all original valid types", () => {
    const types = [
      "screenshot", "photo", "diagram", "chart", "logo",
      "icon", "illustration", "document", "whiteboard", "other",
    ];

    for (const t of types) {
      const raw = `TYPE:\n${t}\n\nSUBJECT:\nTest\n\nDESCRIPTION:\nDesc.\n\nEXTRACTED_TEXT:\nNone`;
      expect(parseResponse(raw).type).toBe(t);
    }
  });

  it("returns empty new fields when not present (backward compat with old six-section)", () => {
    const raw = `TYPE:
photo

SUBJECT:
A test image

COLORS:
red, blue, green

TAGS:
test, image, colorful

DESCRIPTION:
Test description.

EXTRACTED_TEXT:
None`;

    const result = parseResponse(raw);
    expect(result.type).toBe("photo");
    expect(result.category).toBe("");
    expect(result.style).toBe("");
    expect(result.mood).toBe("");
    expect(result.medium).toBe("");
    expect(result.composition).toBe("");
    expect(result.palette).toBe("");
    // colors falls back to COLORS when PALETTE is missing
    expect(result.colors).toBe("red, blue, green");
    expect(result.tags).toBe("test, image, colorful");
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
  it("parses legacy format with type=other, empty subject, empty new fields", () => {
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
    expect(result.category).toBe("");
    expect(result.style).toBe("");
    expect(result.mood).toBe("");
    expect(result.medium).toBe("");
    expect(result.composition).toBe("");
    expect(result.palette).toBe("");
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
