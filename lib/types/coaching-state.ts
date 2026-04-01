// ─── Coaching State Types ─────────────────────────────────────────────────
// Canonical type definitions for the coaching state system.
// All downstream files (coaching-state.ts, tools.ts, prompts.ts) import from here.

// ─── Story & Storybank ───────────────────────────────────────────────────

export interface StorySeed {
  id: string;
  resumeBullet: string;
  suggestedThemes: string[];
  jdRequirementsCovered: string[];
  status: "seed" | "developing" | "polished";
}

export interface StoryDetail {
  situation: string;
  task: string;
  action: string;
  result: string;
  metrics: string[];
  earnedInsight: string | null;
}

export interface StorybankEntry {
  id: string;
  title: string;
  sourceRole: string;
  themes: string[];
  detail: StoryDetail | null;
  scores: ScoreEntry[];
  lastPracticed: string | null;
  status: "seed" | "developing" | "polished";
}

// ─── Scoring & Outcomes ──────────────────────────────────────────────────

export interface ScoreEntry {
  dimension: "substance" | "structure" | "relevance" | "credibility" | "differentiation";
  score: number;
  feedback: string;
  timestamp: string;
}

export interface OutcomeEntry {
  company: string;
  role: string;
  stage: string;
  result: "passed" | "failed" | "pending" | "withdrew";
  notes: string;
  date: string;
}

// ─── Question Bank ───────────────────────────────────────────────────────

export interface QuestionBankEntry {
  id: string;
  question: string;
  category: string;
  difficulty: "easy" | "medium" | "hard";
  timesAsked: number;
  bestScore: number | null;
  lastAsked: string | null;
  flagged: boolean;
  dimensions?: {
    substance: number;
    structure: number;
    relevance: number;
    credibility: number;
    differentiation: number;
  } | null;
}

// ─── Patterns & Feedback ─────────────────────────────────────────────────

export interface PatternEntry {
  dimension: string;
  pattern: string;
  frequency: number;
  firstSeen: string;
  rootCause: string | null;
  addressed: boolean;
}

export interface RecruiterFeedbackEntry {
  company: string;
  role: string;
  feedback: string;
  date: string;
  actionTaken: string | null;
}

// ─── Company & Interview Structures ──────────────────────────────────────

export interface RoundFormat {
  round: number;
  type: string;
  description: string;
  duration: number | null;
}

export interface InterviewLoop {
  company: string;
  role: string;
  rounds: RoundFormat[];
  status: "upcoming" | "in_progress" | "completed";
  notes: string;
}

export interface CompanyPattern {
  company: string;
  knownQuestions: string[];
  interviewStyle: string;
  culturalNotes: string;
  loops: InterviewLoop[];
}

// ─── Scoring Drift & Calibration ─────────────────────────────────────────

export interface ScoringDriftEntry {
  dimension: string;
  trend: "improving" | "declining" | "stable";
  recentAvg: number;
  historicalAvg: number;
  sampleSize: number;
  timestamp: string;
}

export interface CalibrationAdjustment {
  dimension: string;
  adjustment: number;
  reason: string;
  timestamp: string;
}

// ─── Cross-Dimension Analysis ────────────────────────────────────────────

export interface CrossDimensionRootCause {
  affectedDimensions: string[];
  rootCause: string;
  suggestedIntervention: string;
  confidence: "low" | "medium" | "high";
  evidenceCount: number;
}

export interface UnmeasuredFactorEntry {
  factor: string;
  impact: string;
  mitigation: string;
}

// ─── Optional & Meta ─────────────────────────────────────────────────────

export interface OptionalAnalysis {
  scoringDrift: ScoringDriftEntry[];
  calibrationAdjustments: CalibrationAdjustment[];
  crossDimensionRootCauses: CrossDimensionRootCause[];
  unmeasuredFactors: UnmeasuredFactorEntry[];
}

export interface MetaCheckEntry {
  check: string;
  result: "pass" | "fail" | "warning";
  details: string;
  timestamp: string;
}

// ─── Session Tracking ────────────────────────────────────────────────────

export interface SessionEntry {
  id: string;
  chatId: string | null;
  type: "kickoff" | "preparation" | "mock_interview" | "gap_analysis";
  date: string;
  duration: number | null;
  questionsAsked: number;
  avgScore: number | null;
  focusAreas: string[];
  keyInsights: string[];
  summary?: string | null;
  weakestDimension?: string | null;
}

// ─── Main Coaching State ─────────────────────────────────────────────────

export interface CoachingState {
  version: number;
  createdAt: string;
  updatedAt: string;

  // ── Profile ──
  profile: {
    targetRoles: string[];
    seniorityBand: "early" | "mid" | "senior" | "executive" | null;
    timeline: "triage" | "focused" | "full" | null;
    timelineDate: string | null;
    coachingMode: "triage" | "focused" | "full" | null;
    feedbackDirectness: "gentle" | "balanced" | "direct" | null;
    interviewHistory: string | null;
    interviewHistoryType: "first_time" | "active" | "rusty" | null;
    biggestConcern: string | null;
    anxietyProfile: string | null;
    careerTransition: {
      detected: boolean;
      type: string | null;
      transitionNarrativeStatus: "not_started" | "developing" | "ready" | null;
    };
  };

  // ── Resume Analysis ──
  resumeAnalysis: {
    positioningStrengths: string[];
    interviewerConcerns: string[];
    careerNarrativeGaps: string[];
    storySeeds: StorySeed[];
  };

  // ── Target Reality Check ──
  targetRealityCheck: {
    concerns: string[];
    hasBlockers: boolean;
  };

  // ── Readiness Assessment ──
  readinessAssessment: {
    level: "not_ready" | "needs_work" | "competitive" | "strong" | null;
    biggestRisk: string | null;
    biggestAsset: string | null;
  };

  // ── Coaching Strategy ──
  coachingStrategy: {
    priorities: string[];
    focusAreas: string[];
    avoidAreas: string[];
    sessionPlan: string[];
  };

  // ── Storybank ──
  storybank: StorybankEntry[];

  // ── Question Bank ──
  questionBank: QuestionBankEntry[];

  // ── Patterns & Drift ──
  patterns: PatternEntry[];
  scoringDrift: ScoringDriftEntry[];

  // ── Company Intel ──
  companyPatterns: CompanyPattern[];

  // ── Outcomes ──
  outcomes: OutcomeEntry[];

  // ── Recruiter Feedback ──
  recruiterFeedback: RecruiterFeedbackEntry[];

  // ── Sessions ──
  sessions: SessionEntry[];

  // ── Optional Analysis ──
  optionalAnalysis: OptionalAnalysis;

  // ── Meta ──
  metaChecks: MetaCheckEntry[];

  // ── Coaching Notes (free-form) ──
  coachingNotes: string;
}
