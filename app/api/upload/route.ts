import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateFileBuffer } from "@/lib/security";
import { PDFParse } from "pdf-parse";
import path from "path";

// Set worker path for pdfjs-dist (Next.js webpack can't resolve it automatically)
PDFParse.setWorker(
  path.resolve(process.cwd(), "node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs")
);

// POST /api/upload - Upload a PDF (CV or job description)
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const projectId = formData.get("projectId") as string | null;
    const type = formData.get("type") as string | null; // "cv" or "jobDescription"

    if (!file || !projectId || !type) {
      return NextResponse.json(
        { error: "file, projectId, and type are required" },
        { status: 400 }
      );
    }

    if (type !== "cv" && type !== "jobDescription" && type !== "additional") {
      return NextResponse.json(
        { error: 'type must be "cv", "jobDescription", or "additional"' },
        { status: 400 }
      );
    }

    // Validate file
    const buffer = Buffer.from(await file.arrayBuffer());
    const validation = validateFileBuffer(buffer, file.name);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Parse PDF to text
    let text: string;
    try {
      const parser = new PDFParse({ data: new Uint8Array(buffer) });
      const result = await parser.getText();
      text = result.text;
      await parser.destroy();
    } catch (pdfError) {
      console.error("PDF parse error:", pdfError);
      return NextResponse.json(
        { error: "Failed to parse PDF. Please ensure it's a valid PDF file." },
        { status: 400 }
      );
    }

    if (!text || text.trim().length === 0) {
      return NextResponse.json(
        {
          error:
            "Could not extract text from PDF. The file might be scanned/image-based.",
        },
        { status: 400 }
      );
    }

    if (type === "additional") {
      // Store as a separate Document record
      const label = (formData.get("label") as string) || undefined;
      const doc = await prisma.document.create({
        data: {
          projectId,
          name: file.name,
          label,
          text,
        },
      });

      return NextResponse.json({
        success: true,
        type,
        documentId: doc.id,
        name: doc.name,
        textLength: text.length,
      });
    }

    // Update project with extracted text (CV or JD)
    const updateData =
      type === "cv" ? { cvText: text } : { jobDescription: text };

    const project = await prisma.project.update({
      where: { id: projectId },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      type,
      textLength: text.length,
      projectId: project.id,
    });
  } catch (error) {
    console.error("Upload failed:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
