import { NextResponse } from "next/server";
import {
  getDefaultSystemPrompt,
  type AIFeatureKey,
} from "@/lib/ai-settings";

export const dynamic = "force-dynamic";

// GET /api/ai-settings/defaults — Return default system prompts
export async function GET() {
  const features: AIFeatureKey[] = [
    "kickoff",
    "gap_analysis",
    "preparation",
    "mock_interview",
  ];
  const defaults = Object.fromEntries(
    features.map((f) => [f, getDefaultSystemPrompt(f)])
  );
  return NextResponse.json(defaults);
}
