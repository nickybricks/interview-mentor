import { OpenAIEmbeddings } from "@langchain/openai";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { prisma } from "@/lib/db";

const embeddings = new OpenAIEmbeddings({
  model: "text-embedding-3-small",
  apiKey: process.env.OPENAI_API_KEY,
});

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 500,
  chunkOverlap: 50,
});

/**
 * Chunk text, embed each chunk, and insert into VectorDocument table.
 */
export async function addDocuments(
  projectId: string,
  text: string,
  source: string
): Promise<number> {
  const chunks = await splitter.splitText(text);
  const vectors = await embeddings.embedDocuments(chunks);

  // Batch insert all chunks with their embeddings
  for (let i = 0; i < chunks.length; i++) {
    const content = chunks[i];
    const embedding = vectors[i];
    const embeddingStr = `[${embedding.join(",")}]`;

    await prisma.$executeRawUnsafe(
      `INSERT INTO "VectorDocument" (id, "projectId", source, content, metadata, "createdAt", embedding)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW(), $5::vector)`,
      projectId,
      source,
      content,
      JSON.stringify({ chunkIndex: i, totalChunks: chunks.length }),
      embeddingStr
    );
  }

  return chunks.length;
}

/**
 * Embed a query and retrieve the top-k most similar chunks for a project.
 * Includes both project-specific documents and the shared knowledge base.
 */
export async function retrieveContext(
  projectId: string,
  query: string,
  k: number = 5
): Promise<{ content: string; source: string; similarity: number }[]> {
  const queryEmbedding = await embeddings.embedQuery(query);
  const embeddingStr = `[${queryEmbedding.join(",")}]`;

  const results = await prisma.$queryRawUnsafe<
    { content: string; source: string; similarity: number }[]
  >(
    `SELECT content, source, 1 - (embedding <=> $1::vector) AS similarity
     FROM "VectorDocument"
     WHERE "projectId" = $2 OR "projectId" = '__knowledge_base__'
     ORDER BY embedding <=> $1::vector
     LIMIT $3`,
    embeddingStr,
    projectId,
    k
  );

  return results;
}

/**
 * Delete all vector documents for a given project.
 */
export async function deleteProjectDocuments(
  projectId: string
): Promise<number> {
  const result = await prisma.vectorDocument.deleteMany({
    where: { projectId },
  });
  return result.count;
}
