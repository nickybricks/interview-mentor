import {
  GAP_ANALYSIS_PROMPT,
  MOCK_INTERVIEW_PROMPT,
  PROMPTS,
  DEFAULT_PROMPT,
} from "./prompts";
import fs from "fs/promises";
import path from "path";

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

export const FEATURE_LABELS: Record<AIFeatureKey, string> = {
  gap_analysis: "Gap-Analyse",
  preparation: "Vorbereitung",
  mock_interview: "Mock-Interview",
};

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

const SETTINGS_PATH = path.join(process.cwd(), "ai-settings.json");

export async function readSettings(): Promise<AISettings> {
  const defaults = createDefaultSettings();
  try {
    const raw = await fs.readFile(SETTINGS_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    // Deep merge each feature
    return {
      gap_analysis: { ...defaults.gap_analysis, ...parsed.gap_analysis },
      preparation: { ...defaults.preparation, ...parsed.preparation },
      mock_interview: { ...defaults.mock_interview, ...parsed.mock_interview },
    };
  } catch {
    return defaults;
  }
}

export async function writeSettings(settings: AISettings): Promise<void> {
  await fs.writeFile(SETTINGS_PATH, JSON.stringify(settings, null, 2), "utf-8");
}
