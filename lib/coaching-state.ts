// ─── Coaching State Factory ───────────────────────────────────────────────
// Creates an initial CoachingState from kickoff data.

import type { CoachingState, StorySeed } from "@/lib/types/coaching-state";

export interface KickoffData {
  targetRoles: string[];
  seniorityBand?: "early" | "mid" | "senior" | "executive" | null;
  timeline?: "triage" | "focused" | "full" | null;
  timelineDate?: string | null;
  coachingMode?: "triage" | "focused" | "full" | null;
  feedbackDirectness?: "gentle" | "balanced" | "direct" | null;
  interviewHistory?: string | null;
  interviewHistoryType?: "first_time" | "active" | "rusty" | null;
  biggestConcern?: string | null;
  anxietyProfile?: string | null;
  careerTransition?: {
    detected: boolean;
    type: string | null;
    transitionNarrativeStatus: "not_started" | "developing" | "ready" | null;
  };
  positioningStrengths?: string[];
  interviewerConcerns?: string[];
  careerNarrativeGaps?: string[];
  storySeeds?: StorySeed[];
  targetRealityCheck?: {
    concerns: string[];
    hasBlockers: boolean;
  };
  readinessAssessment?: {
    level: "not_ready" | "needs_work" | "competitive" | "strong" | null;
    biggestRisk: string | null;
    biggestAsset: string | null;
  };
  coachingStrategy?: {
    priorities: string[];
    focusAreas: string[];
    avoidAreas: string[];
    sessionPlan: string[];
  };
  coachingNotes?: string;
}

/**
 * Creates a fully initialized (but mostly empty) CoachingState from kickoff data.
 * Populates profile + resumeAnalysis from the input; everything else starts empty/default.
 */
export function createInitialCoachingState(data: KickoffData): CoachingState {
  const now = new Date().toISOString();

  return {
    version: 1,
    createdAt: now,
    updatedAt: now,

    profile: {
      targetRoles: data.targetRoles,
      seniorityBand: data.seniorityBand ?? null,
      timeline: data.timeline ?? null,
      timelineDate: data.timelineDate ?? null,
      coachingMode: data.coachingMode ?? null,
      feedbackDirectness: data.feedbackDirectness ?? null,
      interviewHistory: data.interviewHistory ?? null,
      interviewHistoryType: data.interviewHistoryType ?? null,
      biggestConcern: data.biggestConcern ?? null,
      anxietyProfile: data.anxietyProfile ?? null,
      careerTransition: data.careerTransition ?? {
        detected: false,
        type: null,
        transitionNarrativeStatus: null,
      },
    },

    resumeAnalysis: {
      positioningStrengths: data.positioningStrengths ?? [],
      interviewerConcerns: data.interviewerConcerns ?? [],
      careerNarrativeGaps: data.careerNarrativeGaps ?? [],
      storySeeds: data.storySeeds ?? [],
    },

    targetRealityCheck: data.targetRealityCheck ?? {
      concerns: [],
      hasBlockers: false,
    },

    readinessAssessment: data.readinessAssessment ?? {
      level: null,
      biggestRisk: null,
      biggestAsset: null,
    },

    coachingStrategy: data.coachingStrategy ?? {
      priorities: [],
      focusAreas: [],
      avoidAreas: [],
      sessionPlan: [],
    },

    storybank: [],
    questionBank: [],
    patterns: [],
    scoringDrift: [],
    companyPatterns: [],
    outcomes: [],
    recruiterFeedback: [],
    sessions: [],

    optionalAnalysis: {
      scoringDrift: [],
      calibrationAdjustments: [],
      crossDimensionRootCauses: [],
      unmeasuredFactors: [],
    },

    metaChecks: [],
    coachingNotes: data.coachingNotes ?? "",
  };
}
