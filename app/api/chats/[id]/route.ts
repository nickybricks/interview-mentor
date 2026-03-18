import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/chats/[id] - Get a single chat with all messages
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const chat = await prisma.chat.findUnique({
      where: { id },
      include: {
        project: true,
        messages: {
          where: { active: true },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!chat) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    }

    // For messages with versionGroup, compute version index/total
    const versionGroups = [
      ...new Set(
        chat.messages
          .map((m) => m.versionGroup)
          .filter((g): g is string => g != null)
      ),
    ];

    let versionCounts: Record<string, { total: number; ids: string[] }> = {};
    if (versionGroups.length > 0) {
      const allVersions = await prisma.message.findMany({
        where: { versionGroup: { in: versionGroups } },
        orderBy: { createdAt: "asc" },
        select: { id: true, versionGroup: true },
      });
      for (const v of allVersions) {
        if (!v.versionGroup) continue;
        if (!versionCounts[v.versionGroup]) {
          versionCounts[v.versionGroup] = { total: 0, ids: [] };
        }
        versionCounts[v.versionGroup].total++;
        versionCounts[v.versionGroup].ids.push(v.id);
      }
    }

    const messagesWithVersions = chat.messages.map((m) => {
      if (m.versionGroup && versionCounts[m.versionGroup]) {
        const vc = versionCounts[m.versionGroup];
        return {
          ...m,
          versionIndex: vc.ids.indexOf(m.id),
          versionTotal: vc.total,
        };
      }
      return m;
    });

    return NextResponse.json({
      ...chat,
      messages: messagesWithVersions,
    });
  } catch (error) {
    console.error("Failed to fetch chat:", error);
    return NextResponse.json(
      { error: "Failed to fetch chat" },
      { status: 500 }
    );
  }
}

// DELETE /api/chats/[id] - Delete a chat
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Look up the chat's project before deleting so we can recalculate the score
    const chat = await prisma.chat.findUnique({
      where: { id },
      select: { projectId: true },
    });

    await prisma.chat.delete({ where: { id } });

    // Recalculate project overallScore after the chat (and its messages) are gone
    if (chat) {
      const allScored = await prisma.message.findMany({
        where: {
          role: "user",
          score: { not: null },
          chat: { projectId: chat.projectId },
        },
        select: { score: true },
      });

      const newScore =
        allScored.length > 0
          ? Math.round(
              (allScored.reduce((sum, m) => sum + (m.score ?? 0), 0) /
                allScored.length) *
                10
            ) / 10
          : 0;

      await prisma.project.update({
        where: { id: chat.projectId },
        data: { overallScore: newScore },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete chat:", error);
    return NextResponse.json(
      { error: "Failed to delete chat" },
      { status: 500 }
    );
  }
}
