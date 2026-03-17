import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// PATCH /api/messages/[id]/version — switch to a different version in the same group
// Body: { direction: "prev" | "next" }
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { direction } = await request.json();

    if (direction !== "prev" && direction !== "next") {
      return NextResponse.json(
        { error: "direction must be 'prev' or 'next'" },
        { status: 400 }
      );
    }

    // Find the current message
    const current = await prisma.message.findUnique({
      where: { id },
      select: { id: true, versionGroup: true },
    });

    if (!current?.versionGroup) {
      return NextResponse.json(
        { error: "Message has no versions" },
        { status: 400 }
      );
    }

    // Get all versions in order
    const allVersions = await prisma.message.findMany({
      where: { versionGroup: current.versionGroup },
      orderBy: { createdAt: "asc" },
    });

    const currentIdx = allVersions.findIndex((v) => v.id === id);
    const targetIdx =
      direction === "prev" ? currentIdx - 1 : currentIdx + 1;

    if (targetIdx < 0 || targetIdx >= allVersions.length) {
      return NextResponse.json(
        { error: "No more versions in that direction" },
        { status: 400 }
      );
    }

    // Deactivate current, activate target
    await prisma.message.update({
      where: { id },
      data: { active: false },
    });
    await prisma.message.update({
      where: { id: allVersions[targetIdx].id },
      data: { active: true },
    });

    const target = allVersions[targetIdx];

    return NextResponse.json({
      message: {
        ...target,
        versionIndex: targetIdx,
        versionTotal: allVersions.length,
      },
    });
  } catch (error) {
    console.error("Failed to switch version:", error);
    return NextResponse.json(
      { error: "Failed to switch version" },
      { status: 500 }
    );
  }
}
