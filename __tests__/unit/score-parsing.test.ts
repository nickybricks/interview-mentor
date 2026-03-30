import { describe, it, expect } from "vitest";

// ─── Pure helpers mirroring the logic in lib/tools.ts scoreAnswer ────────────
// These replicate the parsing pipeline so we can unit-test it without
// touching LangChain or Prisma.

interface RawDims {
  substance?: unknown;
  structure?: unknown;
  relevance?: unknown;
  credibility?: unknown;
  differentiation?: unknown;
  strengths?: unknown;
  weaknesses?: unknown;
  suggestion?: unknown;
}

function stripCodeFences(text: string): string {
  return text
    .replace(/```(?:json)?\s*/g, "")
    .replace(/```\s*/g, "")
    .trim();
}

function parseDimensions(raw: RawDims) {
  return {
    substance: (raw.substance as number) ?? 3,
    structure: (raw.structure as number) ?? 3,
    relevance: (raw.relevance as number) ?? 3,
    credibility: (raw.credibility as number) ?? 3,
    differentiation: (raw.differentiation as number) ?? 3,
  };
}

function computeOverallScore(dims: ReturnType<typeof parseDimensions>): number {
  const avg =
    (dims.substance +
      dims.structure +
      dims.relevance +
      dims.credibility +
      dims.differentiation) /
    5;
  // map 1-5 → 2-10
  return Math.round(avg * 2 * 10) / 10;
}

function parseLLMResponse(text: string): ReturnType<typeof computeOverallScore> | null {
  const cleaned = stripCodeFences(text);
  try {
    const parsed = JSON.parse(cleaned);
    const dims = parseDimensions(parsed);
    return computeOverallScore(dims);
  } catch {
    return null;
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("stripCodeFences", () => {
  it("removes ```json fences", () => {
    const input = "```json\n{\"substance\":4}\n```";
    expect(stripCodeFences(input)).toBe('{"substance":4}');
  });

  it("removes bare ``` fences", () => {
    const input = "```\n{\"substance\":4}\n```";
    expect(stripCodeFences(input)).toBe('{"substance":4}');
  });

  it("passes through plain JSON unchanged", () => {
    const input = '{"substance":4}';
    expect(stripCodeFences(input)).toBe('{"substance":4}');
  });
});

describe("parseDimensions — defaults missing fields to 3", () => {
  it("uses provided values when all 5 dimensions present", () => {
    const dims = parseDimensions({
      substance: 5,
      structure: 4,
      relevance: 3,
      credibility: 2,
      differentiation: 1,
    });
    expect(dims).toEqual({
      substance: 5,
      structure: 4,
      relevance: 3,
      credibility: 2,
      differentiation: 1,
    });
  });

  it("defaults missing dimensions to 3", () => {
    const dims = parseDimensions({});
    expect(dims).toEqual({
      substance: 3,
      structure: 3,
      relevance: 3,
      credibility: 3,
      differentiation: 3,
    });
  });

  it("defaults only the missing dimensions", () => {
    const dims = parseDimensions({ substance: 5, structure: 4 });
    expect(dims.substance).toBe(5);
    expect(dims.structure).toBe(4);
    expect(dims.relevance).toBe(3);
    expect(dims.credibility).toBe(3);
    expect(dims.differentiation).toBe(3);
  });
});

describe("computeOverallScore — maps 1-5 scale to 2-10", () => {
  it("maps all-1s to 2.0", () => {
    const dims = parseDimensions({ substance: 1, structure: 1, relevance: 1, credibility: 1, differentiation: 1 });
    expect(computeOverallScore(dims)).toBe(2.0);
  });

  it("maps all-5s to 10.0", () => {
    const dims = parseDimensions({ substance: 5, structure: 5, relevance: 5, credibility: 5, differentiation: 5 });
    expect(computeOverallScore(dims)).toBe(10.0);
  });

  it("maps all-3s (defaults) to 6.0", () => {
    const dims = parseDimensions({});
    expect(computeOverallScore(dims)).toBe(6.0);
  });

  it("rounds to one decimal place", () => {
    // avg = (4+3+4+3+4)/5 = 18/5 = 3.6 → 3.6*2 = 7.2
    const dims = parseDimensions({ substance: 4, structure: 3, relevance: 4, credibility: 3, differentiation: 4 });
    expect(computeOverallScore(dims)).toBe(7.2);
  });

  it("handles mixed scores correctly", () => {
    // avg = (5+4+3+2+1)/5 = 3.0 → 6.0
    const dims = parseDimensions({ substance: 5, structure: 4, relevance: 3, credibility: 2, differentiation: 1 });
    expect(computeOverallScore(dims)).toBe(6.0);
  });
});

describe("parseLLMResponse — end-to-end parsing", () => {
  it("parses a clean JSON response", () => {
    const response = JSON.stringify({
      substance: 4,
      structure: 4,
      relevance: 5,
      credibility: 3,
      differentiation: 4,
    });
    // avg = 20/5 = 4.0 → 8.0
    expect(parseLLMResponse(response)).toBe(8.0);
  });

  it("parses a response wrapped in code fences", () => {
    const response = "```json\n" + JSON.stringify({ substance: 5, structure: 5, relevance: 5, credibility: 5, differentiation: 5 }) + "\n```";
    expect(parseLLMResponse(response)).toBe(10.0);
  });

  it("returns null for completely malformed output", () => {
    expect(parseLLMResponse("sorry i cannot score this")).toBeNull();
    expect(parseLLMResponse("")).toBeNull();
    expect(parseLLMResponse("{bad json}")).toBeNull();
  });

  it("applies defaults for missing dimensions in partial response", () => {
    // substance: 5, rest default to 3 → avg = (5+3+3+3+3)/5 = 3.4 → 6.8
    const response = JSON.stringify({ substance: 5 });
    expect(parseLLMResponse(response)).toBe(6.8);
  });
});
