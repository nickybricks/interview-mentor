import { describe, it, expect } from "vitest";
import {
  sanitizeInput,
  validateMessageLength,
  validateFileBuffer,
} from "@/lib/security";

describe("sanitizeInput", () => {
  it("strips <script> tags", () => {
    const result = sanitizeInput('<script>alert("xss")</script>hello');
    expect(result).toBe("hello");
  });

  it("strips HTML tags", () => {
    const result = sanitizeInput("<b>bold</b> and <i>italic</i>");
    expect(result).toBe("bold and italic");
  });

  it("passes clean text through unchanged", () => {
    const result = sanitizeInput("Hello, I am a candidate for the role.");
    expect(result).toBe("Hello, I am a candidate for the role.");
  });

  it("handles empty string", () => {
    const result = sanitizeInput("");
    expect(result).toBe("");
  });

  it("strips javascript: protocol", () => {
    const result = sanitizeInput("click javascript:void(0)");
    expect(result).toBe("click void(0)");
  });

  it("strips inline event handlers", () => {
    const result = sanitizeInput('<img src="x" onerror="alert(1)">');
    expect(result).toBe("");
  });
});

describe("validateMessageLength", () => {
  it("rejects empty string", () => {
    const result = validateMessageLength("");
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Message cannot be empty");
  });

  it("rejects whitespace-only string", () => {
    const result = validateMessageLength("   ");
    expect(result.valid).toBe(false);
  });

  it("accepts 1 character", () => {
    const result = validateMessageLength("a");
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("accepts exactly 10000 characters", () => {
    const result = validateMessageLength("a".repeat(10000));
    expect(result.valid).toBe(true);
  });

  it("rejects 10001 characters", () => {
    const result = validateMessageLength("a".repeat(10001));
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/10000/);
  });
});

describe("validateFileBuffer", () => {
  it("accepts a valid PDF buffer (filename ends with .pdf)", () => {
    const buffer = Buffer.from("%PDF-1.4 fake pdf content");
    const result = validateFileBuffer(buffer, "resume.pdf");
    expect(result.valid).toBe(true);
  });

  it("rejects a non-PDF filename", () => {
    const buffer = Buffer.from("some content");
    const result = validateFileBuffer(buffer, "resume.docx");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/PDF/i);
  });

  it("rejects files over 5MB", () => {
    const buffer = Buffer.alloc(5 * 1024 * 1024 + 1);
    const result = validateFileBuffer(buffer, "huge.pdf");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/5MB/i);
  });

  it("accepts a file at exactly 5MB", () => {
    const buffer = Buffer.alloc(5 * 1024 * 1024);
    const result = validateFileBuffer(buffer, "ok.pdf");
    expect(result.valid).toBe(true);
  });
});
