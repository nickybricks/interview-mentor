import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { ChatOpenAI } from "@langchain/openai";
import {
  SystemMessage,
  HumanMessage,
} from "@langchain/core/messages";
import { prisma } from "@/lib/db";
import { retrieveContext } from "@/lib/vectorstore";

// ─── Tool 1: score_answer ───────────────────────────────────────────────────

const SCORING_RUBRIC_PROMPT = `You are a structured interview answer evaluator. Score the candidate's answer using the 5-dimension rubric below. Return ONLY valid JSON — no markdown, no code fences, no explanation.

## 5-Dimension Rubric (each scored 1-5)

### Substance (Evidence Quality)
1 = Generic platitude, no evidence
2 = Vague claim with weak support
3 = Specific claim, missing quantification
4 = Quantified with context, missing alternatives considered
5 = Quantified + alternatives weighed + decision rationale + outcome

### Structure (Narrative Clarity)
1 = Stream of consciousness, no clear point
2 = Central idea unclear until the end
3 = Clear structure but missing transitions
4 = Well-structured with smooth flow, minor tangents
5 = Crisp structure: setup → conflict → resolution → impact

### Relevance (Question Fit)
1 = Doesn't address the question asked
2 = Tangentially related, misses core of question
3 = Addresses question but includes irrelevant details
4 = Directly addresses question with minor drift
5 = Laser-focused, every sentence serves the answer

### Credibility (Believability)
1 = Claims with no support or obvious exaggeration
2 = Support is vague or generic
3 = Specific details but missing numbers or outcomes
4 = Quantified with context, could use stronger proof points
5 = Numbers + artifacts + validation from others + realistic constraints

### Differentiation (Uniqueness)
1 = Generic answer any prepared candidate could give
2 = Some specificity but relies on common frameworks
3 = Real details present but no earned insight or defensible POV
4 = Includes earned secrets or a spiky POV; sounds like a specific person
5 = Unmistakably this candidate — earned secrets + defensible stance + unique framing

## Seniority Calibration
- Early career (0-3 yrs): Substance 4 = specific examples with at least one metric. Differentiation can come from learning velocity.
- Mid-career (4-8 yrs): Substance 4 = quantified impact with alternatives considered. Differentiation requires genuine earned secrets.
- Senior/Lead (8-15 yrs): Substance 4 = systems-level thinking, second-order effects. Differentiation requires insights that reshape thinking.
- Executive (15+ yrs): Substance 4 = business-level impact with P&L awareness. Differentiation requires coherent leadership philosophy.

## Output format (strict JSON)
{
  "substance": <1-5>,
  "structure": <1-5>,
  "relevance": <1-5>,
  "credibility": <1-5>,
  "differentiation": <1-5>,
  "strengths": ["<strength 1>", "<strength 2>"],
  "weaknesses": ["<weakness 1>", "<weakness 2>"],
  "suggestion": "<one actionable improvement>"
}`;

export const scoreAnswer = tool(
  async ({ answer, category, jobDescription }) => {
    const llm = new ChatOpenAI({
      model: "gpt-4.1-mini",
      apiKey: process.env.OPENAI_API_KEY,
      temperature: 0.2,
    });

    const response = await llm.invoke([
      new SystemMessage(SCORING_RUBRIC_PROMPT),
      new HumanMessage(
        `Category: ${category}\nJob Description: ${jobDescription}\n\nCandidate's Answer:\n${answer}`
      ),
    ]);

    const text = typeof response.content === "string" ? response.content : "";
    // Strip code fences if present
    const cleaned = text.replace(/```(?:json)?\s*/g, "").replace(/```\s*/g, "").trim();

    try {
      const parsed = JSON.parse(cleaned);
      const dims = {
        substance: parsed.substance ?? 3,
        structure: parsed.structure ?? 3,
        relevance: parsed.relevance ?? 3,
        credibility: parsed.credibility ?? 3,
        differentiation: parsed.differentiation ?? 3,
      };
      const avg =
        (dims.substance + dims.structure + dims.relevance + dims.credibility + dims.differentiation) / 5;
      const overallScore = Math.round(avg * 2 * 10) / 10; // map 1-5 → 2-10

      return JSON.stringify({
        overallScore,
        dimensions: dims,
        strengths: parsed.strengths ?? [],
        weaknesses: parsed.weaknesses ?? [],
        suggestion: parsed.suggestion ?? "",
        rootCause: null,
      });
    } catch {
      return JSON.stringify({
        overallScore: 5,
        dimensions: { substance: 3, structure: 3, relevance: 3, credibility: 3, differentiation: 3 },
        strengths: [],
        weaknesses: [],
        suggestion: "Unable to parse detailed scoring.",
        rootCause: null,
      });
    }
  },
  {
    name: "score_answer",
    description:
      "Evaluate a candidate's interview answer against the job description using a 5-dimension rubric (Substance, Structure, Relevance, Credibility, Differentiation). Use this ONLY when the user has provided a substantive answer to an interview question. Do NOT use for greetings, follow-up questions, or general conversation.",
    schema: z.object({
      answer: z.string().describe("The candidate's full interview answer to evaluate"),
      category: z.string().describe("The interview question category (e.g. Technical, Leadership, Behavioral)"),
      jobDescription: z.string().describe("The target job description for context"),
    }),
  }
);

// ─── Tool 2: get_weak_areas ─────────────────────────────────────────────────

export const getWeakAreas = tool(
  async ({ projectId }) => {
    // Query flagged messages grouped by category
    const flaggedMessages = await prisma.message.findMany({
      where: {
        flagged: true,
        chat: { projectId },
        category: { not: null },
      },
      select: {
        score: true,
        category: true,
        content: true,
      },
    });

    // Group by category
    const groups: Record<
      string,
      { scores: number[]; questions: string[] }
    > = {};

    for (const msg of flaggedMessages) {
      const cat = msg.category!;
      if (!groups[cat]) {
        groups[cat] = { scores: [], questions: [] };
      }
      groups[cat].scores.push(msg.score ?? 0);
      if (groups[cat].questions.length < 3) {
        // Truncate long messages for the summary
        groups[cat].questions.push(
          msg.content.length > 120
            ? msg.content.slice(0, 120) + "..."
            : msg.content
        );
      }
    }

    const weakAreas = Object.entries(groups)
      .map(([category, data]) => ({
        category,
        avgScore:
          Math.round(
            (data.scores.reduce((a, b) => a + b, 0) / data.scores.length) * 10
          ) / 10,
        count: data.scores.length,
        sampleQuestions: data.questions,
      }))
      .sort((a, b) => a.avgScore - b.avgScore);

    return JSON.stringify({ weakAreas });
  },
  {
    name: "get_weak_areas",
    description:
      "Retrieve the candidate's weak areas based on previous interview answers. Use this when the candidate asks about their progress, weak spots, or what to focus on. Do NOT use when the candidate is answering a question.",
    schema: z.object({
      projectId: z.string().describe("The project ID to query weak areas for"),
    }),
  }
);

// ─── Tool 3: search_knowledge_base ──────────────────────────────────────────

export const searchKnowledgeBase = tool(
  async ({ query, projectId }) => {
    const results = await retrieveContext(projectId, query, 5);

    return JSON.stringify({
      results: results.map((r) => ({
        text: r.content,
        source: r.source,
        score: Math.round(r.similarity * 1000) / 1000,
      })),
    });
  },
  {
    name: "search_knowledge_base",
    description:
      "Search the interview coaching knowledge base for methodology tips, frameworks (STAR, WHO), scoring rubrics, practice drill instructions, story-building techniques, and best practices. Use this when the candidate asks HOW to answer a type of question, needs coaching methodology, or wants to understand interview frameworks. Do NOT use for scoring or progress tracking.",
    schema: z.object({
      query: z.string().describe("The search query to find relevant coaching material"),
      projectId: z.string().describe("The project ID for context-aware retrieval"),
    }),
  }
);

// ─── Export all tools ───────────────────────────────────────────────────────

export const interviewTools = [scoreAnswer, getWeakAreas, searchKnowledgeBase];
