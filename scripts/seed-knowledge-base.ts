/**
 * Seed script: Embeds all knowledge base files into the VectorDocument table.
 *
 * Usage:
 *   npx tsx scripts/seed-knowledge-base.ts
 *
 * Idempotent — checks if knowledge base documents already exist before inserting.
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });
import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { OpenAIEmbeddings } from "@langchain/openai";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import fs from "fs";
import path from "path";

const KNOWLEDGE_BASE_PROJECT_ID = "__knowledge_base__";
const KNOWLEDGE_BASE_DIR = path.resolve(__dirname, "../lib/knowledge-base");

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });

  // Ensure the sentinel project exists for the knowledge base
  await prisma.project.upsert({
    where: { id: KNOWLEDGE_BASE_PROJECT_ID },
    update: {},
    create: {
      id: KNOWLEDGE_BASE_PROJECT_ID,
      name: "Knowledge Base (System)",
    },
  });

  // Check if knowledge base is already seeded
  const existing = await prisma.vectorDocument.count({
    where: { projectId: KNOWLEDGE_BASE_PROJECT_ID },
  });

  const forceReseed = process.argv.includes("--force");

  if (existing > 0 && !forceReseed) {
    console.log(
      `Knowledge base already seeded (${existing} chunks). Use --force to re-seed.`
    );
    await prisma.$disconnect();
    return;
  }

  if (existing > 0 && forceReseed) {
    console.log(`Deleting ${existing} existing knowledge base chunks...`);
    await prisma.vectorDocument.deleteMany({
      where: { projectId: KNOWLEDGE_BASE_PROJECT_ID },
    });
    console.log("Deleted.");
  }

  // Read all markdown files from the knowledge base directory
  const files = fs
    .readdirSync(KNOWLEDGE_BASE_DIR)
    .filter((f) => f.endsWith(".md"));

  if (files.length === 0) {
    console.error("No .md files found in", KNOWLEDGE_BASE_DIR);
    process.exit(1);
  }

  console.log(`Found ${files.length} knowledge base files to embed.`);

  const embeddings = new OpenAIEmbeddings({
    model: "text-embedding-3-small",
    apiKey: process.env.OPENAI_API_KEY,
  });

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1500,
    chunkOverlap: 200,
  });

  let totalChunks = 0;

  for (const file of files) {
    const filePath = path.join(KNOWLEDGE_BASE_DIR, file);
    const text = fs.readFileSync(filePath, "utf-8");
    const chunks = await splitter.splitText(text);
    const vectors = await embeddings.embedDocuments(chunks);

    console.log(`  ${file}: ${chunks.length} chunks`);

    for (let i = 0; i < chunks.length; i++) {
      const embeddingStr = `[${vectors[i].join(",")}]`;

      await prisma.$executeRawUnsafe(
        `INSERT INTO "VectorDocument" (id, "projectId", source, content, metadata, "createdAt", embedding)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW(), $5::vector)`,
        KNOWLEDGE_BASE_PROJECT_ID,
        file,
        chunks[i],
        JSON.stringify({ chunkIndex: i, totalChunks: chunks.length }),
        embeddingStr
      );
    }

    totalChunks += chunks.length;
  }

  console.log(`\nDone! Embedded ${totalChunks} chunks from ${files.length} files.`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
