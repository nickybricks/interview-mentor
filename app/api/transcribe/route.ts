import { NextRequest, NextResponse } from "next/server";
import openai from "@/lib/openai";

// POST /api/transcribe - Transcribe audio file using OpenAI Whisper
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get("audio") as File | null;

    if (!audioFile) {
      return NextResponse.json(
        { error: "Audio-Datei fehlt" },
        { status: 400 }
      );
    }

    // Whisper limit: 25MB
    if (audioFile.size > 25 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Audio-Datei zu groß (max. 25MB)" },
        { status: 400 }
      );
    }

    if (audioFile.size === 0) {
      return NextResponse.json(
        { error: "Audio-Datei ist leer" },
        { status: 400 }
      );
    }

    const transcription = await openai.audio.transcriptions.create({
      model: "whisper-1",
      file: audioFile,
      language: "de",
    });

    return NextResponse.json({ text: transcription.text });
  } catch (error) {
    console.error("Transcription failed:", error);
    return NextResponse.json(
      { error: "Transkription fehlgeschlagen" },
      { status: 500 }
    );
  }
}
