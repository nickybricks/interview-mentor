import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getLocaleFromRequest, t } from "@/lib/i18n-server";

// GET /api/projects/[id]/export - Export project as Markdown
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const locale = getLocaleFromRequest(_request);

  try {
    const { id } = await params;

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        chats: {
          include: {
            messages: {
              orderBy: { createdAt: "asc" },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!project) {
      return new Response(JSON.stringify({ error: "Project not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Compute category scores from all messages
    const categoryScores: Record<string, { total: number; count: number }> = {};
    let totalScore = 0;
    let scoreCount = 0;

    for (const chat of project.chats) {
      for (const msg of chat.messages) {
        if (msg.role === "user" && msg.score != null) {
          totalScore += msg.score;
          scoreCount++;
        }
        if (msg.role === "assistant" && msg.category) {
          // Find the matching user message score
          const idx = chat.messages.indexOf(msg);
          const prevUser = chat.messages
            .slice(0, idx)
            .reverse()
            .find((m) => m.role === "user" && m.score != null);
          if (prevUser?.score != null) {
            if (!categoryScores[msg.category]) {
              categoryScores[msg.category] = { total: 0, count: 0 };
            }
            categoryScores[msg.category].total += prevUser.score;
            categoryScores[msg.category].count++;
          }
        }
      }
    }

    const dateLocale = locale === "en" ? "en-US" : "de-DE";
    const avgScore = scoreCount > 0 ? (totalScore / scoreCount).toFixed(1) : "–";
    const createdDate = new Date(project.createdAt).toLocaleDateString(dateLocale, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    // Build markdown
    let md = `# ${project.name}\n\n`;
    md += `**${t(locale, "export.created")}:** ${createdDate}\n`;
    if (project.company) md += `**${t(locale, "export.company")}:** ${project.company}\n`;
    if (project.position) md += `**${t(locale, "export.position")}:** ${project.position}\n`;
    md += `**${t(locale, "export.overallScore")}:** ${avgScore}/10\n`;
    md += `\n---\n\n`;

    // Coaching Profile
    if (project.coachingState && typeof project.coachingState === "object") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const state = project.coachingState as any;
      md += `## ${t(locale, "export.coachingProfile")}\n\n`;

      // Profile
      const profile = state.profile;
      if (profile) {
        if (profile.targetRoles?.length > 0)
          md += `**Target Roles:** ${profile.targetRoles.join(", ")}\n`;
        if (profile.seniorityBand)
          md += `**Seniority:** ${profile.seniorityBand}\n`;
        if (profile.coachingMode)
          md += `**Coaching Mode:** ${profile.coachingMode}\n`;
        if (profile.biggestConcern)
          md += `**Biggest Concern:** ${profile.biggestConcern}\n`;
        if (profile.interviewHistory)
          md += `**Interview History:** ${profile.interviewHistory}\n`;
        if (profile.careerTransition?.detected)
          md += `**Career Transition:** ${profile.careerTransition.type ?? "detected"}\n`;
        md += "\n";
      }

      // Resume Analysis
      const resume = state.resumeAnalysis;
      if (resume) {
        if (resume.positioningStrengths?.length > 0) {
          md += "### Positioning Strengths\n";
          for (const s of resume.positioningStrengths) md += `- ${s}\n`;
          md += "\n";
        }
        if (resume.interviewerConcerns?.length > 0) {
          md += "### Interviewer Concerns\n";
          for (const c of resume.interviewerConcerns) md += `- ${c}\n`;
          md += "\n";
        }
        if (resume.careerNarrativeGaps?.length > 0) {
          md += "### Career Narrative Gaps\n";
          for (const g of resume.careerNarrativeGaps) md += `- ${g}\n`;
          md += "\n";
        }
        if (resume.storySeeds?.length > 0) {
          md += "### Story Seeds\n";
          for (const seed of resume.storySeeds) {
            md += `- ${seed.resumeBullet}`;
            if (seed.suggestedThemes?.length > 0)
              md += ` *(${seed.suggestedThemes.join(", ")})*`;
            md += "\n";
          }
          md += "\n";
        }
      }

      // Readiness Assessment
      const readiness = state.readinessAssessment;
      if (readiness?.level) {
        md += "### Readiness Assessment\n";
        md += `- **Level:** ${readiness.level}\n`;
        if (readiness.biggestRisk) md += `- **Biggest Risk:** ${readiness.biggestRisk}\n`;
        if (readiness.biggestAsset) md += `- **Biggest Asset:** ${readiness.biggestAsset}\n`;
        md += "\n";
      }

      // Coaching Strategy
      const strategy = state.coachingStrategy;
      if (strategy?.priorities?.length > 0) {
        md += "### Coaching Strategy\n";
        md += "**Priorities:**\n";
        for (const p of strategy.priorities) md += `1. ${p}\n`;
        if (strategy.focusAreas?.length > 0)
          md += `\n**Focus Areas:** ${strategy.focusAreas.join(", ")}\n`;
        md += "\n";
      }

      // Coaching Notes
      if (state.coachingNotes) {
        md += "### Coaching Notes\n";
        md += `${state.coachingNotes}\n\n`;
      }

      md += `---\n\n`;
    }

    // Gap Analysis
    if (project.gapAnalysis) {
      md += `## ${t(locale, "export.gapAnalysis")}\n\n${project.gapAnalysis}\n\n---\n\n`;
    }

    // Category Scores
    if (Object.keys(categoryScores).length > 0) {
      md += `## ${t(locale, "export.categoryScores")}\n\n`;
      md += `| ${t(locale, "export.category")} | ${t(locale, "export.score")} | ${t(locale, "export.count")} |\n|---|---|---|\n`;
      for (const [cat, data] of Object.entries(categoryScores)) {
        const avg = (data.total / data.count).toFixed(1);
        md += `| ${cat} | ${avg}/10 | ${data.count} ${t(locale, "export.questions")} |\n`;
      }
      md += `\n---\n\n`;
    }

    // Chat Transcripts
    const chatTypeLabels: Record<string, string> = {
      kickoff: t(locale, "export.kickoff"),
      preparation: t(locale, "export.preparation"),
      gap_analysis: t(locale, "export.gapAnalysisChat"),
      mock_interview: t(locale, "export.mockInterview"),
    };

    for (const chat of project.chats) {
      const label = chatTypeLabels[chat.type] || chat.type;
      const chatDate = new Date(chat.createdAt).toLocaleDateString(dateLocale);
      md += `## ${label} (${chatDate})\n\n`;

      for (const msg of chat.messages) {
        if (msg.role === "system") continue;
        const prefix = msg.role === "user" ? `**${t(locale, "export.you")}:**` : `**${t(locale, "export.coach")}:**`;
        md += `${prefix} ${msg.content}\n\n`;
        if (msg.role === "user" && msg.score != null) {
          md += `> Score: ${msg.score}/10\n\n`;
        }
      }
      md += `---\n\n`;
    }

    const filename = `${project.name.replace(/[^a-zA-Z0-9äöüÄÖÜß\-_ ]/g, "")}.md`;

    return new Response(md, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Export failed:", error);
    return new Response(JSON.stringify({ error: "Export failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
