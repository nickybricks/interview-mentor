import { chat, type ChatMessage } from "@/lib/langchain";
import { retrieveContext } from "@/lib/vectorstore";
import { readSettings, type AIFeatureKey } from "@/lib/ai-settings";

export interface RAGSource {
  content: string;
  source: string;
  similarity: number;
}

export interface RAGResult {
  context: string;
  sources: RAGSource[];
  alternativeQueries: string[];
}

/**
 * Generate 3 alternative rephrasings of a user query for multi-query retrieval.
 * Uses the same model as the chat feature but with temperature 0 and max_tokens 200.
 */
async function generateAlternativeQueries(
  query: string,
  featureKey: AIFeatureKey
): Promise<string[]> {
  const settings = await readSettings();
  const model = settings[featureKey]?.model ?? settings.preparation.model;

  const messages: ChatMessage[] = [
    {
      role: "system",
      content:
        "You are a query rewriter. Given a user question about interview preparation, generate exactly 3 alternative phrasings of the question. Each rephrasing should approach the topic from a slightly different angle to improve search recall. Output ONLY the 3 queries, one per line, with no numbering, bullets, or extra text.",
    },
    {
      role: "user",
      content: query,
    },
  ];

  const response = await chat(messages, {
    model,
    temperature: 0,
    maxTokens: 200,
  });

  const text = typeof response.content === "string" ? response.content : "";
  const queries = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(0, 3);

  return queries;
}

/**
 * Retrieve knowledge base context using multi-query retrieval (query translation).
 *
 * Only searches the knowledge base — CV/JD text is injected directly into the
 * system prompt (full text), so it is never embedded or retrieved via RAG.
 *
 * 1. Generates 3 alternative rephrasings of the user query
 * 2. Searches the KB vector store with all 4 queries (original + 3 alternatives)
 * 3. Deduplicates and ranks results by highest similarity
 * 4. Returns top-k chunks with sources and the generated queries
 */
export async function retrieveWithQueryTranslation(
  query: string,
  featureKey: AIFeatureKey,
  k: number = 5
): Promise<RAGResult> {
  // Start original query search immediately while generating alternatives (async-parallel)
  const originalSearchPromise = retrieveContext(query, k);
  const alternativeQueries = await generateAlternativeQueries(query, featureKey);

  // Search KB with alternative queries in parallel, merge with original
  const [originalResults, ...altResults] = await Promise.all([
    originalSearchPromise,
    ...alternativeQueries.map((q) => retrieveContext(q, k)),
  ]);
  const allResults = [originalResults, ...altResults];

  // Step 3: Merge and deduplicate by content
  const seen = new Map<string, RAGSource>();
  for (const results of allResults) {
    for (const result of results) {
      const existing = seen.get(result.content);
      if (!existing || result.similarity > existing.similarity) {
        seen.set(result.content, result);
      }
    }
  }

  // Step 4: Rank by similarity and take top-k
  const deduped = Array.from(seen.values())
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, k);

  // Step 5: Build context string for injection into system prompt
  const context = deduped
    .map(
      (chunk, i) =>
        `[Source ${i + 1}: ${chunk.source}]\n${chunk.content}`
    )
    .join("\n\n");

  return {
    context,
    sources: deduped,
    alternativeQueries,
  };
}
