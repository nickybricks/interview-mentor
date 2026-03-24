import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { chat } from "@/lib/langchain";
import { readSettings, getDefaultSystemPrompt } from "@/lib/ai-settings";

// POST /api/projects/[id]/gap-analysis — Regenerate gap analysis
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const project = await prisma.project.findUnique({
      where: { id },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (!project.cvText || !project.jobDescription) {
      return NextResponse.json(
        { error: "CV and job description are required" },
        { status: 400 }
      );
    }

    // Fetch additional documents
    const additionalDocs = await prisma.document.findMany({
      where: { projectId: id },
      select: { name: true, text: true },
    });

    // Clear existing gap analysis so UI shows loading state
    await prisma.project.update({
      where: { id },
      data: { gapAnalysis: null },
    });

    // Run gap analysis in background
    runGapAnalysis(id, project.cvText, project.jobDescription, additionalDocs).catch((err) =>
      console.error("Gap analysis regeneration failed:", err)
    );

    return NextResponse.json({ success: true, regenerating: true });
  } catch (error) {
    console.error("Failed to regenerate gap analysis:", error);
    return NextResponse.json(
      { error: "Failed to regenerate gap analysis" },
      { status: 500 }
    );
  }
}

async function runGapAnalysis(
  projectId: string,
  cvText: string,
  jobDescription: string,
  additionalDocs: { name: string; text: string }[] = []
) {
  const aiSettings = await readSettings();
  const gapSettings = aiSettings.gap_analysis;

  const basePrompt =
    gapSettings.systemPrompt ?? getDefaultSystemPrompt("gap_analysis");
  let systemPrompt =
    basePrompt +
    `\n\n## Candidate's CV:\n${cvText}` +
    `\n\n## Target Job Description:\n${jobDescription}`;

  if (additionalDocs.length > 0) {
    systemPrompt += "\n\n## Additional Documents:";
    for (const doc of additionalDocs) {
      systemPrompt += `\n\n### ${doc.name}:\n${doc.text}`;
    }
  }

  const response = await chat(
    [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content:
          "Bitte analysiere meinen Lebenslauf gegen die Stellenanzeige.",
      },
    ],
    {
      model: gapSettings.model,
      temperature: gapSettings.temperature,
      maxTokens: gapSettings.maxTokens,
      topP: gapSettings.topP,
      frequencyPenalty: gapSettings.frequencyPenalty,
    }
  );

  let gapAnalysis = typeof response.content === "string" ? response.content : null;
  if (gapAnalysis) {
    // Post-process: convert bold-only lines to proper markdown headings
    // e.g. "**Some Header**" or "**Some Header:**" → "### Some Header"
    gapAnalysis = gapAnalysis.replace(
      /^(\*\*[^*]+\*\*):?\s*$/gm,
      (_, bold) => `### ${bold.replace(/\*\*/g, "")}`
    );
    await prisma.project.update({
      where: { id: projectId },
      data: { gapAnalysis },
    });
  }
}
