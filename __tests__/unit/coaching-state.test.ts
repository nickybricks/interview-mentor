import { describe, it, expect } from "vitest";
import { createInitialCoachingState } from "@/lib/coaching-state";

describe("createInitialCoachingState", () => {
  it("returns correct defaults when given only targetRoles", () => {
    const state = createInitialCoachingState({ targetRoles: ["Software Engineer"] });

    expect(state.version).toBe(1);
    expect(state.profile.targetRoles).toEqual(["Software Engineer"]);
    expect(state.profile.seniorityBand).toBeNull();
    expect(state.profile.timeline).toBeNull();
    expect(state.profile.timelineDate).toBeNull();
    expect(state.profile.coachingMode).toBeNull();
    expect(state.profile.feedbackDirectness).toBeNull();
    expect(state.profile.interviewHistory).toBeNull();
    expect(state.profile.interviewHistoryType).toBeNull();
    expect(state.profile.biggestConcern).toBeNull();
    expect(state.profile.anxietyProfile).toBeNull();
    expect(state.profile.careerTransition).toEqual({
      detected: false,
      type: null,
      transitionNarrativeStatus: null,
    });
  });

  it("initializes all array fields as empty by default", () => {
    const state = createInitialCoachingState({ targetRoles: ["PM"] });

    expect(state.resumeAnalysis.positioningStrengths).toEqual([]);
    expect(state.resumeAnalysis.interviewerConcerns).toEqual([]);
    expect(state.resumeAnalysis.careerNarrativeGaps).toEqual([]);
    expect(state.resumeAnalysis.storySeeds).toEqual([]);
    expect(state.storybank).toEqual([]);
    expect(state.questionBank).toEqual([]);
    expect(state.patterns).toEqual([]);
    expect(state.sessions).toEqual([]);
    expect(state.coachingNotes).toBe("");
  });

  it("populates all fields when given full data", () => {
    const state = createInitialCoachingState({
      targetRoles: ["Staff Engineer", "Principal Engineer"],
      seniorityBand: "senior",
      timeline: "focused",
      timelineDate: "2026-04-15",
      coachingMode: "focused",
      feedbackDirectness: "direct",
      interviewHistory: "5 years of interviewing experience",
      interviewHistoryType: "active",
      biggestConcern: "system design depth",
      anxietyProfile: "nervous about whiteboarding",
      careerTransition: {
        detected: true,
        type: "IC to management",
        transitionNarrativeStatus: "developing",
      },
      positioningStrengths: ["Led 10-person team", "Shipped 3 major products"],
      interviewerConcerns: ["Gap in distributed systems experience"],
      careerNarrativeGaps: ["2022 employment gap"],
      readinessAssessment: {
        level: "competitive",
        biggestRisk: "system design",
        biggestAsset: "leadership track record",
      },
      coachingStrategy: {
        priorities: ["system design", "behavioral"],
        focusAreas: ["STAR stories", "architecture patterns"],
        avoidAreas: ["entry-level questions"],
        sessionPlan: ["session 1: kickoff review", "session 2: mock interview"],
      },
      coachingNotes: "Candidate is highly motivated",
    });

    expect(state.profile.targetRoles).toEqual(["Staff Engineer", "Principal Engineer"]);
    expect(state.profile.seniorityBand).toBe("senior");
    expect(state.profile.timeline).toBe("focused");
    expect(state.profile.timelineDate).toBe("2026-04-15");
    expect(state.profile.coachingMode).toBe("focused");
    expect(state.profile.feedbackDirectness).toBe("direct");
    expect(state.profile.interviewHistory).toBe("5 years of interviewing experience");
    expect(state.profile.interviewHistoryType).toBe("active");
    expect(state.profile.biggestConcern).toBe("system design depth");
    expect(state.profile.anxietyProfile).toBe("nervous about whiteboarding");
    expect(state.profile.careerTransition).toEqual({
      detected: true,
      type: "IC to management",
      transitionNarrativeStatus: "developing",
    });
    expect(state.resumeAnalysis.positioningStrengths).toEqual([
      "Led 10-person team",
      "Shipped 3 major products",
    ]);
    expect(state.resumeAnalysis.interviewerConcerns).toEqual([
      "Gap in distributed systems experience",
    ]);
    expect(state.readinessAssessment.level).toBe("competitive");
    expect(state.readinessAssessment.biggestRisk).toBe("system design");
    expect(state.readinessAssessment.biggestAsset).toBe("leadership track record");
    expect(state.coachingStrategy.priorities).toEqual(["system design", "behavioral"]);
    expect(state.coachingNotes).toBe("Candidate is highly motivated");
  });

  it("null-coalesces optional fields to null", () => {
    const state = createInitialCoachingState({
      targetRoles: ["Designer"],
      seniorityBand: null,
      timeline: null,
      feedbackDirectness: null,
    });

    expect(state.profile.seniorityBand).toBeNull();
    expect(state.profile.timeline).toBeNull();
    expect(state.profile.feedbackDirectness).toBeNull();
  });

  it("null-coalesces optional nested objects to safe defaults", () => {
    const state = createInitialCoachingState({ targetRoles: ["Analyst"] });

    expect(state.targetRealityCheck).toEqual({ concerns: [], hasBlockers: false });
    expect(state.readinessAssessment).toEqual({
      level: null,
      biggestRisk: null,
      biggestAsset: null,
    });
    expect(state.coachingStrategy).toEqual({
      priorities: [],
      focusAreas: [],
      avoidAreas: [],
      sessionPlan: [],
    });
  });

  it("sets createdAt and updatedAt as ISO strings", () => {
    const before = Date.now();
    const state = createInitialCoachingState({ targetRoles: ["QA Engineer"] });
    const after = Date.now();

    const created = new Date(state.createdAt).getTime();
    expect(created).toBeGreaterThanOrEqual(before);
    expect(created).toBeLessThanOrEqual(after);
    expect(state.createdAt).toBe(state.updatedAt);
  });
});
