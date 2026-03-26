# Coaching State Schema Reference

> Canonical reference for the `CoachingState` interface stored as `project.coachingState` (JSON).

## Overview

The coaching state is a structured JSON object that persists everything learned about a candidate across the kickoff conversation and subsequent coaching sessions. It is stored on the `Project` model as a `Json?` field.

## When Fields Get Populated

| Phase | Fields Populated |
|-------|-----------------|
| **Kickoff** | `profile`, `resumeAnalysis`, `targetRealityCheck`, `readinessAssessment`, `coachingStrategy`, `coachingNotes` |
| **Preparation** | `storybank`, `questionBank`, `patterns`, `scoringDrift`, `sessions` |
| **Mock Interview** | `outcomes`, `sessions`, `optionalAnalysis` |
| **Ongoing** | `companyPatterns`, `recruiterFeedback`, `metaChecks` |

## Schema

### Root: `CoachingState`

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `version` | `number` | `1` | Schema version for future migrations |
| `createdAt` | `string` (ISO) | auto | When the coaching state was first created |
| `updatedAt` | `string` (ISO) | auto | Last modification timestamp |
| `profile` | `Profile` | — | Candidate profile from kickoff |
| `resumeAnalysis` | `ResumeAnalysis` | — | CV analysis results |
| `targetRealityCheck` | `TargetRealityCheck` | `{concerns:[], hasBlockers:false}` | Reality check on target role fit |
| `readinessAssessment` | `ReadinessAssessment` | `{level:null, ...}` | Interview readiness level |
| `coachingStrategy` | `CoachingStrategy` | `{priorities:[], ...}` | Personalized coaching plan |
| `storybank` | `StorybankEntry[]` | `[]` | Developed interview stories |
| `questionBank` | `QuestionBankEntry[]` | `[]` | Questions asked with scores |
| `patterns` | `PatternEntry[]` | `[]` | Recurring weakness patterns |
| `scoringDrift` | `ScoringDriftEntry[]` | `[]` | Score trends over time |
| `companyPatterns` | `CompanyPattern[]` | `[]` | Company-specific interview intel |
| `outcomes` | `OutcomeEntry[]` | `[]` | Interview outcomes |
| `recruiterFeedback` | `RecruiterFeedbackEntry[]` | `[]` | Feedback from recruiters |
| `sessions` | `SessionEntry[]` | `[]` | Session history |
| `optionalAnalysis` | `OptionalAnalysis` | `{...empty}` | Advanced analysis data |
| `metaChecks` | `MetaCheckEntry[]` | `[]` | System health checks |
| `coachingNotes` | `string` | `""` | Free-form notes |

### Profile

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `targetRoles` | `string[]` | — | Target role(s) the candidate is preparing for |
| `seniorityBand` | `"early" \| "mid" \| "senior" \| "executive" \| null` | `null` | Inferred seniority level |
| `timeline` | `"triage" \| "focused" \| "full" \| null` | `null` | Interview timeline category |
| `timelineDate` | `string \| null` | `null` | Specific interview date (ISO) |
| `coachingMode` | `"triage" \| "focused" \| "full" \| null` | `null` | Coaching mode based on timeline |
| `feedbackDirectness` | `"gentle" \| "balanced" \| "direct" \| null` | `null` | Preferred feedback style |
| `interviewHistory` | `string \| null` | `null` | Summary of interview experience |
| `interviewHistoryType` | `"first_time" \| "active" \| "rusty" \| null` | `null` | Experience category |
| `biggestConcern` | `string \| null` | `null` | Primary interview concern |
| `anxietyProfile` | `string \| null` | `null` | Anxiety-related notes |
| `careerTransition` | `CareerTransition` | `{detected:false, ...}` | Career transition detection |

### ResumeAnalysis

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `positioningStrengths` | `string[]` | `[]` | Top 2-3 CV signals |
| `interviewerConcerns` | `string[]` | `[]` | Likely concerns from CV |
| `careerNarrativeGaps` | `string[]` | `[]` | Transitions needing stories |
| `storySeeds` | `StorySeed[]` | `[]` | Resume bullets with story potential |

### StorySeed

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique identifier |
| `resumeBullet` | `string` | The resume entry |
| `suggestedThemes` | `string[]` | Themes this story could address |
| `jdRequirementsCovered` | `string[]` | JD requirements it could cover |
| `status` | `"seed" \| "developing" \| "polished"` | Development status |

### StorybankEntry

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique identifier |
| `title` | `string` | Story title |
| `sourceRole` | `string` | Role the story comes from |
| `themes` | `string[]` | Interview themes covered |
| `detail` | `StoryDetail \| null` | STAR breakdown |
| `scores` | `ScoreEntry[]` | Scoring history |
| `lastPracticed` | `string \| null` | Last practice date |
| `status` | `"seed" \| "developing" \| "polished"` | Development status |

### ReadinessAssessment

| Field | Type | Description |
|-------|------|-------------|
| `level` | `"not_ready" \| "needs_work" \| "competitive" \| "strong" \| null` | Current readiness |
| `biggestRisk` | `string \| null` | Single biggest risk |
| `biggestAsset` | `string \| null` | Single biggest asset |

### CoachingStrategy

| Field | Type | Description |
|-------|------|-------------|
| `priorities` | `string[]` | Ordered coaching priorities |
| `focusAreas` | `string[]` | Areas to practice |
| `avoidAreas` | `string[]` | Areas to deprioritize |
| `sessionPlan` | `string[]` | Planned session structure |

## Example: Freshly Initialized Coaching State

```json
{
  "version": 1,
  "createdAt": "2026-03-25T10:00:00.000Z",
  "updatedAt": "2026-03-25T10:00:00.000Z",
  "profile": {
    "targetRoles": ["Senior Product Manager"],
    "seniorityBand": "senior",
    "timeline": "focused",
    "timelineDate": "2026-04-05T00:00:00.000Z",
    "coachingMode": "focused",
    "feedbackDirectness": "balanced",
    "interviewHistory": "3 interviews in the past month, passed first rounds but struggling with final rounds",
    "interviewHistoryType": "active",
    "biggestConcern": "Final round presentations and case studies",
    "anxietyProfile": null,
    "careerTransition": {
      "detected": false,
      "type": null,
      "transitionNarrativeStatus": null
    }
  },
  "resumeAnalysis": {
    "positioningStrengths": [
      "Led 0→1 product launches at two Y Combinator startups",
      "Quantified revenue impact ($2M ARR growth)"
    ],
    "interviewerConcerns": [
      "No experience at large enterprises",
      "Short tenure at last role (8 months)"
    ],
    "careerNarrativeGaps": [
      "Transition from engineering to product management"
    ],
    "storySeeds": [
      {
        "id": "seed-1",
        "resumeBullet": "Led cross-functional team of 12 to launch payment platform, resulting in $2M ARR in first year",
        "suggestedThemes": ["leadership", "cross-functional", "revenue impact"],
        "jdRequirementsCovered": ["product launches", "team leadership"],
        "status": "seed"
      }
    ]
  },
  "targetRealityCheck": {
    "concerns": [],
    "hasBlockers": false
  },
  "readinessAssessment": {
    "level": "needs_work",
    "biggestRisk": "Final round case study performance",
    "biggestAsset": "Strong 0→1 product launch track record"
  },
  "coachingStrategy": {
    "priorities": [
      "Practice case study presentations",
      "Develop narrative for short tenure at last role",
      "Build stories around cross-functional leadership"
    ],
    "focusAreas": ["case studies", "behavioral questions", "leadership stories"],
    "avoidAreas": [],
    "sessionPlan": ["Case study drill", "Behavioral question practice", "Mock final round"]
  },
  "storybank": [],
  "questionBank": [],
  "patterns": [],
  "scoringDrift": [],
  "companyPatterns": [],
  "outcomes": [],
  "recruiterFeedback": [],
  "sessions": [],
  "optionalAnalysis": {
    "scoringDrift": [],
    "calibrationAdjustments": [],
    "crossDimensionRootCauses": [],
    "unmeasuredFactors": []
  },
  "metaChecks": [],
  "coachingNotes": ""
}
```
