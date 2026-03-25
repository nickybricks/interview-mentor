import { OpenAIEmbeddings } from "@langchain/openai";
import { prisma } from "@/lib/db";

const KNOWLEDGE_BASE_PROJECT_ID = "__knowledge_base__";

const embeddings = new OpenAIEmbeddings({
  model: "text-embedding-3-small",
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Embed a query and retrieve the top-k most similar knowledge base chunks.
 * Only searches the shared knowledge base (1500-char chunks with 200 overlap).
 */
export async function retrieveContext(
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
     WHERE "projectId" = $2
     ORDER BY embedding <=> $1::vector
     LIMIT $3`,
    embeddingStr,
    KNOWLEDGE_BASE_PROJECT_ID,
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
