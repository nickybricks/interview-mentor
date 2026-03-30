import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ─── Mock Prisma ──────────────────────────────────────────────────────────────

const mockFindUnique = vi.fn();
const mockFindMany = vi.fn();
const mockUpdate = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    message: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      findMany: (...args: unknown[]) => mockFindMany(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  },
}));

// Import after mocks are set up
const { PATCH } = await import("@/app/api/messages/[id]/version/route");

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(body: object, id = "msg-1") {
  return {
    request: new NextRequest(`http://localhost/api/messages/${id}/version`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    context: { params: Promise.resolve({ id }) },
  };
}

const fakeVersions = [
  { id: "msg-1", versionGroup: "group-1", content: "v1", active: false, createdAt: new Date("2026-01-01") },
  { id: "msg-2", versionGroup: "group-1", content: "v2", active: true, createdAt: new Date("2026-01-02") },
  { id: "msg-3", versionGroup: "group-1", content: "v3", active: false, createdAt: new Date("2026-01-03") },
];

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("PATCH /api/messages/[id]/version", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects invalid direction with 400", async () => {
    const { request, context } = makeRequest({ direction: "sideways" });
    const res = await PATCH(request, context);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/direction/);
  });

  it("returns 400 when message has no versionGroup", async () => {
    mockFindUnique.mockResolvedValue({ id: "msg-1", versionGroup: null });
    const { request, context } = makeRequest({ direction: "prev" });
    const res = await PATCH(request, context);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/no versions/i);
  });

  it("returns 400 when no more versions exist in that direction (prev from first)", async () => {
    mockFindUnique.mockResolvedValue({ id: "msg-1", versionGroup: "group-1" });
    mockFindMany.mockResolvedValue(fakeVersions);
    const { request, context } = makeRequest({ direction: "prev" }, "msg-1");
    const res = await PATCH(request, context);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/no more versions/i);
  });

  it("switches to previous version successfully", async () => {
    mockFindUnique.mockResolvedValue({ id: "msg-2", versionGroup: "group-1" });
    mockFindMany.mockResolvedValue(fakeVersions);
    mockUpdate.mockResolvedValue({});

    const { request, context } = makeRequest({ direction: "prev" }, "msg-2");
    const res = await PATCH(request, context);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message.id).toBe("msg-1");
    expect(body.message.versionIndex).toBe(0);
    expect(body.message.versionTotal).toBe(3);

    // Deactivated msg-2, activated msg-1
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "msg-2" }, data: { active: false } }));
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "msg-1" }, data: { active: true } }));
  });

  it("switches to next version successfully", async () => {
    mockFindUnique.mockResolvedValue({ id: "msg-2", versionGroup: "group-1" });
    mockFindMany.mockResolvedValue(fakeVersions);
    mockUpdate.mockResolvedValue({});

    const { request, context } = makeRequest({ direction: "next" }, "msg-2");
    const res = await PATCH(request, context);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message.id).toBe("msg-3");
    expect(body.message.versionIndex).toBe(2);
    expect(body.message.versionTotal).toBe(3);
  });

  it("returns 400 when no more versions exist in that direction (next from last)", async () => {
    mockFindUnique.mockResolvedValue({ id: "msg-3", versionGroup: "group-1" });
    mockFindMany.mockResolvedValue(fakeVersions);

    const { request, context } = makeRequest({ direction: "next" }, "msg-3");
    const res = await PATCH(request, context);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/no more versions/i);
  });
});
