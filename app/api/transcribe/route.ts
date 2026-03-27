import { NextRequest, NextResponse } from "next/server";
import { openaiClient as openai } from "@/lib/langchain";
import { getLocaleFromRequest, t } from "@/lib/i18n-server";

// POST /api/transcribe - Transcribe audio file using OpenAI Whisper
export async function POST(request: NextRequest) {
  const locale = getLocaleFromRequest(request);

  try {
    const formData = await request.formData();
    const audioFile = formData.get("audio") as File | null;

    if (!audioFile) {
      return NextResponse.json(
        { error: t(locale, "api.transcribeNoFile") },
        { status: 400 }
      );
    }

    // Whisper limit: 25MB
    if (audioFile.size > 25 * 1024 * 1024) {
      return NextResponse.json(
        { error: t(locale, "api.transcribeTooLarge") },
        { status: 400 }
      );
    }

    if (audioFile.size === 0) {
      return NextResponse.json(
        { error: t(locale, "api.transcribeEmpty") },
        { status: 400 }
      );
    }

    const transcription = await openai.audio.transcriptions.create({
      model: "whisper-1",
      file: audioFile,
      language: locale,
    });

    // Whisper hallucinates subtitle artifacts on silent audio — return empty string for these
    const WHISPER_HALLUCINATIONS = [
      "Untertitel der Amara.org-Community",
      "Amara.org",
      "Subtitles by the Amara.org community",
      "Thank you for watching",
      "Thanks for watching",
      "www.mooji.org",
    ];
    const text = transcription.text.trim();
    const isHallucination = WHISPER_HALLUCINATIONS.some((artifact) =>
      text.includes(artifact)
    );

    return NextResponse.json({ text: isHallucination ? "" : text });
  } catch (error) {
    console.error("Transcription failed:", error);
    return NextResponse.json(
      { error: t(locale, "api.transcribeFailed") },
      { status: 500 }
    );
  }
}
