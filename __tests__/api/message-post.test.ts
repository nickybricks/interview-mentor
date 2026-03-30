import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ─── Mock heavy dependencies so the module can be imported ───────────────────

vi.mock("@/lib/db", () => ({
  prisma: {
    chat: { findUnique: vi.fn() },
    message: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  },
}));

vi.mock("@/lib/langchain", () => ({
  streamChat: vi.fn(),
  createBoundModel: vi.fn(),
  toLangChainMessages: vi.fn(() => []),
}));

vi.mock("@/lib/prompts", () => ({
  PROMPTS: {},
  DEFAULT_PROMPT: "",
  buildCoachingContext: vi.fn(() => ""),
}));

vi.mock("@/lib/ai-settings", () => ({
  readSettings: vi.fn(async () => ({})),
  getDefaultSystemPrompt: vi.fn(() => ""),
}));

vi.mock("@/lib/rag", () => ({
  retrieveWithQueryTranslation: vi.fn(async () => []),
}));

vi.mock("@/lib/tools", () => ({
  interviewTools: [],
  kickoffTools: [],
}));

vi.mock("@/lib/model-pricing", () => ({
  getModelPricing: vi.fn(() => ({ inputCost: 0, outputCost: 0 })),
}));

// Import after all mocks are registered
const { POST } = await import("@/app/api/messages/route");

// ─── Helper ───────────────────────────────────────────────────────────────────

function makePostRequest(body: object) {
  return new NextRequest("http://localhost/api/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("POST /api/messages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects missing chatId with 400", async () => {
    const req = makePostRequest({ content: "hello" });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/required/i);
  });

  it("rejects empty content with 400", async () => {
    const req = makePostRequest({ chatId: "chat-1", content: "" });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  it("rejects content over 10000 characters with 400", async () => {
    const req = makePostRequest({ chatId: "chat-1", content: "a".repeat(10001) });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/10000/);
  });

  it("accepts content at exactly 10000 characters (passes validation, fails at chat lookup)", async () => {
    // Validation passes; prisma returns null → 404
    const { prisma } = await import("@/lib/db");
    vi.mocked(prisma.chat.findUnique).mockResolvedValue(null);

    const req = makePostRequest({ chatId: "chat-1", content: "a".repeat(10000) });
    const res = await POST(req);
    // Passes validation, hits chat lookup which returns null → 404
    expect(res.status).toBe(404);
  });
});
