import {
  GAP_ANALYSIS_PROMPT,
  MOCK_INTERVIEW_PROMPT,
  PROMPTS,
  DEFAULT_PROMPT,
} from "./prompts";
import { prisma } from "./db";

export type AIFeatureKey = "gap_analysis" | "preparation" | "mock_interview";

export interface AIFeatureSettings {
  systemPrompt: string | null; // null = use default from prompts.ts
  model: string;
  temperature: number;
  maxTokens: number | null; // null = no limit
  topP: number;
  topK: number | null; // not supported by OpenAI
  frequencyPenalty: number;
  minP: number | null; // not supported by OpenAI
}

export interface AISettings {
  gap_analysis: AIFeatureSettings;
  preparation: AIFeatureSettings;
  mock_interview: AIFeatureSettings;
}

export function getDefaultSystemPrompt(feature: AIFeatureKey): string {
  switch (feature) {
    case "gap_analysis":
      return GAP_ANALYSIS_PROMPT;
    case "mock_interview":
      return MOCK_INTERVIEW_PROMPT;
    case "preparation":
      return PROMPTS[DEFAULT_PROMPT];
  }
}

export function createDefaultSettings(): AISettings {
  const base: AIFeatureSettings = {
    systemPrompt: null,
    model: "gpt-4.1-mini",
    temperature: 0.7,
    maxTokens: null,
    topP: 1,
    topK: null,
    frequencyPenalty: 0,
    minP: null,
  };
  return {
    gap_analysis: { ...base, temperature: 0.3 },
    preparation: { ...base },
    mock_interview: { ...base },
  };
}

export async function readSettings(): Promise<AISettings> {
  const defaults = createDefaultSettings();
  try {
    const row = await prisma.aiSettings.findUnique({
      where: { id: "singleton" },
    });
    if (!row) return defaults;
    const parsed = row.settings as Record<string, unknown>;
    return {
      gap_analysis: { ...defaults.gap_analysis, ...(parsed.gap_analysis as Partial<AIFeatureSettings>) },
      preparation: { ...defaults.preparation, ...(parsed.preparation as Partial<AIFeatureSettings>) },
      mock_interview: { ...defaults.mock_interview, ...(parsed.mock_interview as Partial<AIFeatureSettings>) },
    };
  } catch {
    return defaults;
  }
}

export async function writeSettings(settings: AISettings): Promise<void> {
  await prisma.aiSettings.upsert({
    where: { id: "singleton" },
    update: { settings: JSON.parse(JSON.stringify(settings)) },
    create: { id: "singleton", settings: JSON.parse(JSON.stringify(settings)) },
  });
}
