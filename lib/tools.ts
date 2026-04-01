import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { ChatOpenAI } from "@langchain/openai";
import {
  SystemMessage,
  HumanMessage,
} from "@langchain/core/messages";
import { prisma } from "@/lib/db";
import { retrieveContext } from "@/lib/vectorstore";
import { createInitialCoachingState } from "@/lib/coaching-state";

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
  async ({ query }) => {
    const results = await retrieveContext(query, 5);

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
    }),
  }
);

// ─── Tool 4: save_coaching_profile ───────────────────────────────────────────

export const saveCoachingProfile = tool(
  async ({
    projectId,
    chatId,
    targetRoles,
    seniorityBand,
    timeline,
    timelineDate,
    coachingMode,
    feedbackDirectness,
    interviewHistory,
    interviewHistoryType,
    biggestConcern,
    anxietyProfile,
    careerTransition,
    transitionNarrativeStatus,
    positioningStrengths,
    interviewerConcerns,
    careerNarrativeGaps,
    storySeeds,
    targetRealityCheck,
    readinessAssessment,
    coachingStrategy,
    coachingNotes,
  }) => {
    try {
      const coachingState = createInitialCoachingState({
        targetRoles,
        seniorityBand: seniorityBand as "early" | "mid" | "senior" | "executive" | null ?? null,
        timeline: timeline as "triage" | "focused" | "full" | null ?? null,
        timelineDate: timelineDate ?? null,
        coachingMode: coachingMode as "triage" | "focused" | "full" | null ?? null,
        feedbackDirectness: feedbackDirectness as "gentle" | "balanced" | "direct" | null ?? null,
        interviewHistory: interviewHistory ?? null,
        interviewHistoryType: interviewHistoryType as "first_time" | "active" | "rusty" | null ?? null,
        biggestConcern: biggestConcern ?? null,
        anxietyProfile: anxietyProfile ?? null,
        careerTransition: careerTransition
          ? {
              detected: careerTransition.detected,
              type: careerTransition.type ?? null,
              transitionNarrativeStatus:
                (transitionNarrativeStatus as "not_started" | "developing" | "ready" | null) ?? null,
            }
          : undefined,
        positioningStrengths: positioningStrengths ?? [],
        interviewerConcerns: interviewerConcerns ?? [],
        careerNarrativeGaps: careerNarrativeGaps ?? [],
        storySeeds: (storySeeds ?? []).map((s, i) => ({
          id: `seed-${i + 1}`,
          resumeBullet: s.resumeBullet,
          suggestedThemes: s.suggestedThemes ?? [],
          jdRequirementsCovered: s.jdRequirementsCovered ?? [],
          status: "seed" as const,
        })),
        targetRealityCheck: targetRealityCheck
          ? {
              concerns: targetRealityCheck.concerns ?? [],
              hasBlockers: targetRealityCheck.hasBlockers ?? false,
            }
          : undefined,
        readinessAssessment: readinessAssessment
          ? {
              level: (readinessAssessment.level as "not_ready" | "needs_work" | "competitive" | "strong" | null) ?? null,
              biggestRisk: readinessAssessment.biggestRisk ?? null,
              biggestAsset: readinessAssessment.biggestAsset ?? null,
            }
          : undefined,
        coachingStrategy: coachingStrategy
          ? {
              priorities: coachingStrategy.priorities ?? [],
              focusAreas: coachingStrategy.focusAreas ?? [],
              avoidAreas: coachingStrategy.avoidAreas ?? [],
              sessionPlan: coachingStrategy.sessionPlan ?? [],
            }
          : undefined,
        coachingNotes: coachingNotes ?? "",
      });

      // Persist to database
      await prisma.project.update({
        where: { id: projectId },
        data: {
          coachingState: JSON.parse(JSON.stringify(coachingState)),
          // Optionally update position from first target role
          ...(targetRoles.length > 0 && { position: targetRoles[0] }),
        },
      });

      // GUARD: Only mark chat as completed for kickoff chats
      const chat = await prisma.chat.findUnique({ where: { id: chatId } });
      if (chat?.type === "kickoff") {
        await prisma.chat.update({
          where: { id: chatId },
          data: { status: "completed" },
        });
      }

      return JSON.stringify({
        success: true,
        message: "Coaching profile saved successfully.",
        profile: {
          targetRoles: coachingState.profile.targetRoles,
          coachingMode: coachingState.profile.coachingMode,
          readinessLevel: coachingState.readinessAssessment.level,
          storySeedCount: coachingState.resumeAnalysis.storySeeds.length,
          priorityCount: coachingState.coachingStrategy.priorities.length,
        },
      });
    } catch (err) {
      console.error("saveCoachingProfile failed:", err);
      return JSON.stringify({
        success: false,
        error: "Failed to save coaching profile. Please try again.",
      });
    }
  },
  {
    name: "save_coaching_profile",
    description:
      "Save the candidate's coaching profile after the kickoff conversation. Call this once you have collected enough information (target roles, timeline, CV analysis, concerns). This persists the coaching state to the database for use in future preparation and mock interview sessions.",
    schema: z.object({
      projectId: z.string().describe("The project ID to save the coaching profile to"),
      chatId: z.string().describe("The chat ID this tool is being called from"),
      targetRoles: z.array(z.string()).describe("Target role(s) the candidate is preparing for"),
      seniorityBand: z.string().nullable().optional().describe("Seniority level: 'early', 'mid', 'senior', or 'executive'"),
      timeline: z.string().nullable().optional().describe("Interview timeline: 'triage' (≤48h), 'focused' (1-2 weeks), or 'full' (3+ weeks)"),
      timelineDate: z.string().nullable().optional().describe("Specific interview date if known (ISO string)"),
      coachingMode: z.string().nullable().optional().describe("Coaching mode based on timeline: 'triage', 'focused', or 'full'"),
      feedbackDirectness: z.string().nullable().optional().describe("Preferred feedback style: 'gentle', 'balanced', or 'direct'"),
      interviewHistory: z.string().nullable().optional().describe("Summary of the candidate's interview experience"),
      interviewHistoryType: z.string().nullable().optional().describe("Interview experience type: 'first_time', 'active', or 'rusty'"),
      biggestConcern: z.string().nullable().optional().describe("The candidate's biggest concern about interviewing"),
      anxietyProfile: z.string().nullable().optional().describe("Notes on the candidate's anxiety level or specific anxieties"),
      careerTransition: z
        .object({
          detected: z.boolean().describe("Whether a career transition was detected"),
          type: z.string().nullable().optional().describe("Type of transition: function change, domain shift, IC↔management, industry pivot, career restart"),
        })
        .nullable()
        .optional()
        .describe("Career transition detection results"),
      transitionNarrativeStatus: z.string().nullable().optional().describe("Status of transition narrative: 'not_started', 'developing', or 'ready'"),
      positioningStrengths: z.array(z.string()).optional().describe("2-3 most impressive signals from the CV"),
      interviewerConcerns: z.array(z.string()).optional().describe("Likely interviewer concerns from CV analysis"),
      careerNarrativeGaps: z.array(z.string()).optional().describe("Career transitions that need a ready story"),
      storySeeds: z
        .array(
          z.object({
            resumeBullet: z.string().describe("The resume bullet that could become a story"),
            suggestedThemes: z.array(z.string()).optional().describe("Themes this story could address"),
            jdRequirementsCovered: z.array(z.string()).optional().describe("JD requirements this story could cover"),
          })
        )
        .optional()
        .describe("Resume bullets that likely have rich stories behind them"),
      targetRealityCheck: z
        .object({
          concerns: z.array(z.string()).optional().describe("Reality check concerns (seniority gaps, missing skills, etc.)"),
          hasBlockers: z.boolean().optional().describe("Whether there are blocking concerns"),
        })
        .nullable()
        .optional()
        .describe("Target role reality check results"),
      readinessAssessment: z
        .object({
          level: z.string().nullable().optional().describe("Readiness level: 'not_ready', 'needs_work', 'competitive', or 'strong'"),
          biggestRisk: z.string().nullable().optional().describe("The single biggest risk for the candidate"),
          biggestAsset: z.string().nullable().optional().describe("The single biggest asset the candidate has"),
        })
        .nullable()
        .optional()
        .describe("Interview readiness assessment"),
      coachingStrategy: z
        .object({
          priorities: z.array(z.string()).optional().describe("Ordered coaching priorities"),
          focusAreas: z.array(z.string()).optional().describe("Areas to focus on in practice"),
          avoidAreas: z.array(z.string()).optional().describe("Areas to avoid or deprioritize"),
          sessionPlan: z.array(z.string()).optional().describe("Planned session structure"),
        })
        .nullable()
        .optional()
        .describe("Coaching strategy and plan"),
      coachingNotes: z.string().optional().describe("Free-form coaching notes from the kickoff conversation"),
    }),
  }
);

// ─── Tool 5: save_linkedin_analysis ─────────────────────────────────────────

export const saveLinkedInAnalysis = tool(
  async ({
    projectId,
    overallScore,
    discoverability,
    credibility,
    differentiation,
    topFixesPending,
    depthLevel,
    consistencyScore,
  }) => {
    try {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { coachingState: true },
      });

      const existingState =
        project?.coachingState && typeof project.coachingState === "object"
          ? (project.coachingState as Record<string, unknown>)
          : {};

      const updatedState = {
        ...existingState,
        linkedInAnalysis: {
          overallScore,
          discoverability,
          credibility,
          differentiation,
          topFixesPending: topFixesPending ?? [],
          depthLevel,
          consistencyScore: consistencyScore ?? null,
          date: new Date().toISOString(),
        },
      };

      await prisma.project.update({
        where: { id: projectId },
        data: { coachingState: updatedState },
      });

      return JSON.stringify({
        success: true,
        message: "LinkedIn analysis saved successfully.",
      });
    } catch (err) {
      console.error("saveLinkedInAnalysis failed:", err);
      return JSON.stringify({
        success: false,
        error: "Failed to save LinkedIn analysis.",
      });
    }
  },
  {
    name: "save_linkedin_analysis",
    description:
      "Save the LinkedIn profile audit results to the coaching state after completing an audit. Call this once the full audit output has been delivered to the user.",
    schema: z.object({
      projectId: z.string().describe("The project ID to save the analysis to"),
      overallScore: z
        .enum(["Strong", "Needs Work", "Weak"])
        .describe("Overall LinkedIn profile assessment"),
      discoverability: z
        .enum(["Strong", "Moderate", "Weak"])
        .describe("Recruiter discoverability score"),
      credibility: z
        .enum(["Strong", "Moderate", "Weak"])
        .describe("Profile credibility on visit score"),
      differentiation: z
        .enum(["Strong", "Moderate", "Weak"])
        .describe("Differentiation score"),
      topFixesPending: z
        .array(z.string())
        .optional()
        .describe("Top fixes the user still needs to action"),
      depthLevel: z
        .enum(["quick", "standard", "deep"])
        .describe("The depth level of the audit that was run"),
      consistencyScore: z
        .enum(["Aligned", "Minor Gaps", "Significant Gaps"])
        .nullable()
        .optional()
        .describe("Consistency check score (deep audits only)"),
    }),
  }
);

// ─── Tool 6: update_coaching_state ──────────────────────────────────────────

const dimensionsSchema = z.object({
  substance: z.number().min(1).max(5).describe("Substance score 1-5"),
  structure: z.number().min(1).max(5).describe("Structure score 1-5"),
  relevance: z.number().min(1).max(5).describe("Relevance score 1-5"),
  credibility: z.number().min(1).max(5).describe("Credibility score 1-5"),
  differentiation: z.number().min(1).max(5).describe("Differentiation score 1-5"),
});

export const updateCoachingState = tool(
  async ({ action, projectId, question, score, dimensions, category, summary, questionsAsked, averageScore, weakestDimension, patterns }) => {
    try {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { coachingState: true },
      });

      const existing =
        project?.coachingState && typeof project.coachingState === "object"
          ? (project.coachingState as Record<string, unknown>)
          : {};

      const now = new Date().toISOString();

      if (action === "addQuestion") {
        const currentBank = Array.isArray(existing.questionBank)
          ? (existing.questionBank as import("@/lib/types/coaching-state").QuestionBankEntry[])
          : [];

        const newEntry: import("@/lib/types/coaching-state").QuestionBankEntry = {
          id: `q-${Date.now()}`,
          question: question!,
          category: category ?? "general",
          difficulty: "medium",
          timesAsked: 1,
          bestScore: score ?? null,
          lastAsked: now,
          flagged: (score ?? 0) < 7,
          dimensions: dimensions ?? null,
        };

        await prisma.project.update({
          where: { id: projectId },
          data: {
            coachingState: JSON.parse(JSON.stringify({
              ...existing,
              questionBank: [...currentBank, newEntry],
              updatedAt: now,
            })),
          },
        });

        return JSON.stringify({ success: true, action: "addQuestion" });
      }

      if (action === "endSession") {
        const currentSessions = Array.isArray(existing.sessions)
          ? (existing.sessions as import("@/lib/types/coaching-state").SessionEntry[])
          : [];

        const newSession: import("@/lib/types/coaching-state").SessionEntry = {
          id: `session-${Date.now()}`,
          chatId: null,
          type: "preparation",
          date: now,
          duration: null,
          questionsAsked: questionsAsked ?? 0,
          avgScore: averageScore ?? null,
          focusAreas: [],
          keyInsights: [],
          summary: summary ?? null,
          weakestDimension: weakestDimension ?? null,
        };

        let updatedPatterns = Array.isArray(existing.patterns)
          ? (existing.patterns as import("@/lib/types/coaching-state").PatternEntry[])
          : [];

        if (patterns && patterns.length > 0) {
          const patternEntries: import("@/lib/types/coaching-state").PatternEntry[] = patterns.map((p) => ({
            dimension: weakestDimension ?? "general",
            pattern: p,
            frequency: 1,
            firstSeen: now,
            rootCause: null,
            addressed: false,
          }));
          updatedPatterns = [...updatedPatterns, ...patternEntries];
        }

        await prisma.project.update({
          where: { id: projectId },
          data: {
            coachingState: JSON.parse(JSON.stringify({
              ...existing,
              sessions: [...currentSessions, newSession],
              patterns: updatedPatterns,
              updatedAt: now,
            })),
          },
        });

        return JSON.stringify({ success: true, action: "endSession" });
      }

      return JSON.stringify({ success: false, error: "Unknown action" });
    } catch (err) {
      console.error("updateCoachingState failed:", err);
      return JSON.stringify({ success: false, error: "Failed to update coaching state." });
    }
  },
  {
    name: "update_coaching_state",
    description:
      "Persist preparation session progress to the coaching state. Use 'addQuestion' after scoring each answer to record the question and score. Use 'endSession' when the session is wrapping up to save a session summary and any detected patterns. Never use this for kickoff — that is handled by save_coaching_profile.",
    schema: z.object({
      action: z.enum(["addQuestion", "endSession"]).describe("'addQuestion' to log a scored question, 'endSession' to save a session summary"),
      projectId: z.string().describe("The project ID to update"),
      // addQuestion fields
      question: z.string().optional().describe("(addQuestion) The interview question asked"),
      score: z.number().min(1).max(10).optional().describe("(addQuestion) Overall score 1-10"),
      dimensions: dimensionsSchema.optional().describe("(addQuestion) Per-dimension scores 1-5"),
      category: z.string().optional().describe("(addQuestion) Question category: screening, deep_dive, behavioral, technical"),
      // endSession fields
      summary: z.string().optional().describe("(endSession) 2-3 sentence session summary"),
      questionsAsked: z.number().optional().describe("(endSession) How many questions were scored this session"),
      averageScore: z.number().optional().describe("(endSession) Average score across the session"),
      weakestDimension: z.string().optional().describe("(endSession) The dimension that was weakest across the session"),
      patterns: z.array(z.string()).optional().describe("(endSession) Recurring patterns detected, e.g. 'Structure consistently weak'"),
    }),
  }
);

// ─── Export all tools ───────────────────────────────────────────────────────

export const interviewTools = [scoreAnswer, getWeakAreas, searchKnowledgeBase, updateCoachingState];
export const kickoffTools = [saveCoachingProfile, searchKnowledgeBase];
export const linkedInTools = [saveLinkedInAnalysis, searchKnowledgeBase];
