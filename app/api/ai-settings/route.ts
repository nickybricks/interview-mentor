import { NextRequest, NextResponse } from "next/server";
import { readSettings, writeSettings } from "@/lib/ai-settings";

export const dynamic = "force-dynamic";

// GET /api/ai-settings — Read current settings
export async function GET() {
  const settings = await readSettings();
  return NextResponse.json(settings);
}

// PUT /api/ai-settings — Save settings
export async function PUT(request: NextRequest) {
  const body = await request.json();
  const current = await readSettings();
  const merged = {
    gap_analysis: { ...current.gap_analysis, ...body.gap_analysis },
    preparation: { ...current.preparation, ...body.preparation },
    mock_interview: { ...current.mock_interview, ...body.mock_interview },
    kickoff: { ...current.kickoff, ...body.kickoff },
  };
  await writeSettings(merged);
  return NextResponse.json(merged);
}
