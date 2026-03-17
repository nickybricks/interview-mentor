import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/projects/[id]/export - Export project as Markdown
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const avgScore = scoreCount > 0 ? (totalScore / scoreCount).toFixed(1) : "–";
    const createdDate = new Date(project.createdAt).toLocaleDateString("de-DE", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    // Build markdown
    let md = `# ${project.name}\n\n`;
    md += `**Erstellt:** ${createdDate}\n`;
    if (project.company) md += `**Unternehmen:** ${project.company}\n`;
    if (project.position) md += `**Position:** ${project.position}\n`;
    md += `**Gesamt-Score:** ${avgScore}/10\n`;
    md += `\n---\n\n`;

    // Gap Analysis
    if (project.gapAnalysis) {
      md += `## Gap-Analyse\n\n${project.gapAnalysis}\n\n---\n\n`;
    }

    // Category Scores
    if (Object.keys(categoryScores).length > 0) {
      md += `## Kategorie-Scores\n\n`;
      md += `| Kategorie | Score | Anzahl |\n|---|---|---|\n`;
      for (const [cat, data] of Object.entries(categoryScores)) {
        const avg = (data.total / data.count).toFixed(1);
        md += `| ${cat} | ${avg}/10 | ${data.count} Fragen |\n`;
      }
      md += `\n---\n\n`;
    }

    // Chat Transcripts
    const chatTypeLabels: Record<string, string> = {
      preparation: "Vorbereitung",
      gap_analysis: "Gap-Analyse",
      mock_interview: "Mock Interview",
    };

    for (const chat of project.chats) {
      const label = chatTypeLabels[chat.type] || chat.type;
      const chatDate = new Date(chat.createdAt).toLocaleDateString("de-DE");
      md += `## ${label} (${chatDate})\n\n`;

      for (const msg of chat.messages) {
        if (msg.role === "system") continue;
        const prefix = msg.role === "user" ? "**Du:**" : "**Coach:**";
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
