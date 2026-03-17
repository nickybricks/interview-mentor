import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/projects/[id] - Get a single project with chats
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        chats: {
          orderBy: { createdAt: "desc" },
          include: {
            messages: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { content: true, createdAt: true },
            },
          },
        },
        documents: {
          orderBy: { createdAt: "asc" },
          select: { id: true, name: true, label: true, createdAt: true },
        },
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    // Compute category scores
    const scoredMessages = await prisma.message.findMany({
      where: {
        role: "user",
        score: { not: null },
        chat: { projectId: id },
      },
      select: { score: true, category: true },
    });

    const categoryMap: Record<string, { total: number; count: number }> = {};
    for (const msg of scoredMessages) {
      if (msg.category && msg.score != null) {
        if (!categoryMap[msg.category]) {
          categoryMap[msg.category] = { total: 0, count: 0 };
        }
        categoryMap[msg.category].total += msg.score;
        categoryMap[msg.category].count++;
      }
    }

    const categoryScores = Object.entries(categoryMap).map(([name, data]) => ({
      name,
      avg: Math.round((data.total / data.count) * 10) / 10,
      count: data.count,
    }));

    return NextResponse.json({ ...project, categoryScores });
  } catch (error) {
    console.error("Failed to fetch project:", error);
    return NextResponse.json(
      { error: "Failed to fetch project" },
      { status: 500 }
    );
  }
}

// PATCH /api/projects/[id] - Update a project
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, company, position, cvText, jobDescription, gapAnalysis, overallScore } = body;

    const project = await prisma.project.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(company !== undefined && { company: company?.trim() || null }),
        ...(position !== undefined && { position: position?.trim() || null }),
        ...(cvText !== undefined && { cvText }),
        ...(jobDescription !== undefined && { jobDescription }),
        ...(gapAnalysis !== undefined && { gapAnalysis }),
        ...(overallScore !== undefined && { overallScore }),
      },
    });

    return NextResponse.json(project);
  } catch (error) {
    console.error("Failed to update project:", error);
    return NextResponse.json(
      { error: "Failed to update project" },
      { status: 500 }
    );
  }
}

// DELETE /api/projects/[id] - Delete a project
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.project.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete project:", error);
    return NextResponse.json(
      { error: "Failed to delete project" },
      { status: 500 }
    );
  }
}
