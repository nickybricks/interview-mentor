# Sprint 2 – Implementation Plan for Claude Code

> **Status:** Phase 0 COMPLETE | Phase 1 COMPLETE | Phase 2 COMPLETE | Phase 3 COMPLETE | Phase 4 COMPLETE | Last updated: March 21, 2026
>
> **How to use this file:** Read this file at the start of every session. Check which phase is current (marked IN PROGRESS or NOT STARTED). Complete that phase, then update the status here and add a session log entry at the bottom. Also update DOCUMENTATION.md with the session details as usual.

---

## Context

This is the **Interview Mentor** app from Sprint 1. It is a Next.js 16 + TypeScript + Prisma + SQLite app that helps users prepare for job interviews. Sprint 1 is fully complete. See DOCUMENTATION.md for the full architecture, database schema, API routes, and change log.

**Sprint 2 requires three core additions:**

1. **RAG with a vector database** — chunk documents, embed them, store vectors, retrieve at query time with query translation
2. **Tool calling** — at least 3 tools using OpenAI function calling
3. **LangChain** — refactor the OpenAI integration layer to use LangChain

**Deployment target:** Vercel (frontend + API routes) + Supabase (PostgreSQL + pgvector)

**What already exists and carries forward from Sprint 1:**
- Full chat UI with streaming (SSE), markdown rendering, mobile responsive
- OpenAI API integration (direct SDK — needs LangChain refactor)
- PDF upload + text extraction (cv, job description, additional documents)
- Gap analysis, interview prep, mock interview flows
- 5 system prompts (Prompt E is default — Marcus Webb persona)
- AI settings panel (model, temperature, top-p, frequency penalty, max tokens)
- Security (40+ regex patterns, prompt injection guards, XSS protection)
- Voice input (Whisper), i18n (DE/EN), spaced repetition, score tracking
- Token/cost tracking, regenerate with version navigation, markdown export
- Database: Project, Chat, Message, Document tables (Prisma + SQLite)

**External knowledge source (NEW):**
The `interview-coach-skill` repository (github.com/noamseg/interview-coach-skill) provides a rich set of interview coaching reference files. These are used as the primary knowledge base for RAG (Phase 2) and as the scoring rubric source for tool calling (Phase 4). See Phase 2, task 2 for the full file list and mapping.

---

## Phase 0: Supabase Setup + PostgreSQL Migration

**Status:** ✅ COMPLETE (March 20, 2026)
**Estimated time:** 2-3 hours
**Why first:** Everything else builds on the production database. Migrating later is painful — do it now so all subsequent phases (RAG vectors, tool queries) work against PostgreSQL from the start.

### Tasks

1. **Create a Supabase project:**
   - Go to supabase.com, create a new project
   - Note the connection string: `postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres`
   - Note the direct connection string (for migrations): `postgresql://postgres.[ref]:[password]@db.[ref].supabase.co:5432/postgres`

2. **Enable pgvector extension in Supabase:**
   - Go to Supabase Dashboard > SQL Editor
   - Run: `CREATE EXTENSION IF NOT EXISTS vector;`
   - This enables vector storage for RAG in Phase 2

3. **Update Prisma to use PostgreSQL:**
   - Change `prisma/schema.prisma`:
     - `provider = "postgresql"` (was `"sqlite"`)
     - Remove the LibSQL adapter references
   - Update `.env`:
     - `DATABASE_URL="postgresql://..."` (pooled connection string from Supabase, port 6543)
     - `DIRECT_URL="postgresql://..."` (direct connection string, port 5432 — needed for migrations)
   - Update `prisma/schema.prisma` datasource block:
     ```
     datasource db {
       provider  = "postgresql"
       url       = env("DATABASE_URL")
       directUrl = env("DIRECT_URL")
     }
     ```

4. **Remove LibSQL adapter from `lib/db.ts`:**
   - Remove `@prisma/adapter-libsql` import and adapter setup
   - Simplify to standard `new PrismaClient()` (no adapter needed for PostgreSQL)
   - Remove the LibSQL-specific singleton pattern if it was only needed for the adapter
   - Uninstall `@prisma/adapter-libsql` package

5. **Create a vector documents table** (for Phase 2 RAG):
   - Add a new model to `prisma/schema.prisma`:
     ```
     model VectorDocument {
       id        String   @id @default(cuid())
       projectId String
       source    String
       content   String
       metadata  Json?
       createdAt DateTime @default(now())
       project   Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
     }
     ```
   - The actual vector column (embedding) will be added via raw SQL migration since Prisma does not natively support pgvector types. Add a raw SQL step in the migration:
     ```sql
     ALTER TABLE "VectorDocument" ADD COLUMN embedding vector(1536);
     CREATE INDEX ON "VectorDocument" USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
     ```
   - Add the relation to the Project model: `vectorDocuments VectorDocument[]`

6. **Run the migration:**
   - `npx prisma migrate dev --name switch-to-postgresql`
   - Verify all tables are created in Supabase (check via Supabase Dashboard > Table Editor)
   - `npx prisma generate` to regenerate the client

7. **Update `.env.local`** for Vercel deployment later:
   - Keep `OPENAI_API_KEY`
   - Add `DATABASE_URL` and `DIRECT_URL`

8. **Migrate `ai-settings.json` to database:**
   - The current file-based settings will not work on Vercel (serverless = no persistent filesystem)
   - Option A: Add an `AiSettings` table to the database (recommended)
   - Option B: Store settings in Supabase Storage
   - Update `lib/ai-settings.ts` and `app/api/ai-settings/route.ts` accordingly

9. **Test everything still works locally:**
   - All CRUD operations (projects, chats, messages)
   - PDF upload and text extraction
   - Gap analysis generation
   - Chat streaming
   - Score tracking and spaced repetition

### Key constraints
- The Supabase free tier allows 500MB database storage and 2 projects — more than enough
- Use the POOLED connection string (port 6543) for `DATABASE_URL` — this is required for serverless environments like Vercel
- Use the DIRECT connection string (port 5432) for `DIRECT_URL` — this is required for Prisma migrations
- Do NOT delete the old SQLite migration files — keep them for reference but they will not be used

### Files to read before starting
- `prisma/schema.prisma` — current schema
- `lib/db.ts` — current database connection with LibSQL adapter
- `lib/ai-settings.ts` — file-based settings that need migration
- `app/api/ai-settings/route.ts` — settings API routes

### Done when
- [x] Supabase project is created with pgvector enabled
- [x] Prisma schema uses PostgreSQL provider
- [x] lib/db.ts uses PrismaPg adapter (Prisma 7 requires driver adapter)
- [x] VectorDocument table exists with embedding column
- [x] ai-settings.json is migrated to database storage
- [x] All existing features work against PostgreSQL
- [x] Build passes

---

## Phase 1: LangChain Refactor

**Status:** ✅ COMPLETE (March 20, 2026)
**Estimated time:** 2-3 hours
**Why second:** RAG and tool calling both depend on LangChain abstractions.
**Depends on:** Phase 0 (database must be on PostgreSQL)

### Tasks

1. Install LangChain packages: @langchain/core, @langchain/openai, @langchain/community, langchain

2. **Refactor lib/openai.ts** to use LangChain ChatOpenAI:
   - Replace the raw OpenAI client with ChatOpenAI from @langchain/openai
   - Keep the same exported function signatures: streamChat() and chat()
   - Keep the ChatOptions interface (model, temperature, topP, frequencyPenalty, maxTokens)
   - Map ChatOptions fields to ChatOpenAI constructor parameters
   - streamChat() should use .stream() and return chunks compatible with the existing SSE format
   - chat() should use .invoke() and return the full response string

3. **Update all API routes** that import from lib/openai.ts:
   - app/api/messages/route.ts — main chat endpoint (streaming)
   - app/api/upload/route.ts — gap analysis (non-streaming)
   - app/api/projects/[id]/gap-analysis/route.ts — gap regeneration
   - Ensure the SSE streaming format (data: {"text": "..."} / data: {"done": true}) remains identical

4. **Verify everything still works:**
   - Chat streaming (preparation, mock interview)
   - Gap analysis auto-generation on upload
   - Gap analysis regeneration
   - AI settings (model, temperature, etc.) are applied correctly
   - Token/cost tracking still captures usage data

### Key constraints
- Do NOT change the frontend. The SSE format must stay the same.
- Do NOT change the database schema.
- Do NOT remove the raw openai package yet — it is still used by app/api/transcribe/route.ts (Whisper).
- The ai-settings system stays as-is (now in database from Phase 0).

### Files to read before starting
- lib/openai.ts — current implementation
- app/api/messages/route.ts — how streaming is consumed
- lib/ai-settings.ts — settings types and defaults

### Done when
- [x] Build passes with zero errors
- [x] Chat streaming works end-to-end in the browser
- [x] Gap analysis generates correctly
- [x] AI settings (model, temperature) are applied
- [x] Token usage is still tracked on messages

---

## Phase 2: RAG Pipeline — Ingestion with Supabase pgvector

**Status:** ✅ COMPLETE (March 20, 2026)
**Estimated time:** 3-4 hours
**Depends on:** Phase 0 (pgvector table must exist), Phase 1 (LangChain must be in place)

### Tasks

1. **Create lib/vectorstore.ts** using Supabase pgvector:
   - Use LangChain's `SupabaseVectorStore` from `@langchain/community/vectorstores/supabase` OR write direct Prisma queries with raw SQL for vector operations
   - If using SupabaseVectorStore, initialize with the Supabase client (`@supabase/supabase-js`)
   - If using raw Prisma/SQL approach, use `prisma.$queryRaw` for vector similarity search

   Exports:
   - addDocuments(projectId, text, source) — Chunks text with RecursiveCharacterTextSplitter (chunkSize: 500, overlap: 50). Embeds with OpenAIEmbeddings (text-embedding-3-small). Inserts into VectorDocument table with embedding column.
   - retrieveContext(projectId, query, k) — Embeds the query, runs cosine similarity search filtered by projectId, returns top-k most similar chunks.
   - deleteProjectDocuments(projectId) — Deletes all VectorDocument rows for a project (cascade already handles this on project deletion, but explicit cleanup is good practice).

2. **Create lib/knowledge-base/ directory** with domain-specific documents from the `interview-coach-skill` repository:

   **Source:** Clone or download the `references/` directory from `github.com/noamseg/interview-coach-skill`. These are high-quality, structured interview coaching documents that serve as the RAG knowledge base.

   **File mapping — copy these files into `lib/knowledge-base/`:**

   | Source file (interview-coach-skill) | Target file (lib/knowledge-base/) | Content / Purpose |
   |---|---|---|
   | `references/rubrics-detailed.md` | `rubrics-and-scoring.md` | 5-dimension scoring rubric (Substance, Structure, Relevance, Credibility, Differentiation), root cause taxonomy, seniority calibration bands — used by `score_answer` tool and general coaching |
   | `references/storybank-guide.md` | `storybank-and-star-method.md` | STAR method guide, story management, rapid-retrieval drills, earned secrets framework |
   | `references/differentiation.md` | `differentiation-and-earned-secrets.md` | Earned secrets, spiky POVs, clarity under pressure — what makes answers memorable |
   | `references/cross-cutting.md` | `coaching-frameworks.md` | Gap-handling, signal-reading, psychological readiness, cultural awareness — shared coaching modules |
   | `references/story-mapping-engine.md` | `story-mapping.md` | Portfolio-optimized story mapping, 4-level fit scoring (Strong Fit, Workable, Stretch, Gap) |
   | `references/calibration-engine.md` | `scoring-calibration.md` | Scoring drift detection, outcome correlation, success pattern analysis |
   | `references/transcript-processing.md` | `transcript-analysis.md` | Step-by-step transcript analysis guide, format-aware parsing |
   | `references/role-drills.md` | `role-specific-drills.md` | Role-specific drills (PM, Engineering, Design, Data Science, etc.) + interviewer archetypes |
   | `references/examples.md` | `scored-examples.md` | Worked examples of scored answers, triage decisions, answer rewrites — few-shot material |
   | `references/challenge-protocol.md` | `challenge-protocol.md` | Five-lens challenge framework (assumption audit, blind spot scan, pre-mortem, devil's advocate, strengthening path) |

   **Removed (command workflow files that polluted RAG retrieval):** `interview-prep-workflow.md`, `transcript-analysis.md`, `transcript-analysis-workflow.md`, `practice-drills-workflow.md`, `mock-interview-workflow.md`, `storybank-workflow.md`, `jd-decoding.md`, `coaching-kickoff.md` — these described /kickoff, /prep, /analyze, /practice, /mock, /stories, /decode commands specific to the interview-coach-skill tool and referenced coaching_state.md, Interview Loops, and drill progression stages that our app doesn't have.

   **Additional custom files to create (not from the repo):**

   | File | Content |
   |---|---|
   | `lib/knowledge-base/who-interview-method.md` | WHO interview method overview (Screening → Topgrading → Focused → Reference) — already referenced in the Marcus Webb prompt's 50-question bank |
   | `lib/knowledge-base/interview-categories.md` | The 5 interview categories used by the app (Experience, Problem-Solving, Leadership, Technical, Motivation) with descriptions and example questions |

   **Why these files:** Instead of writing generic interview guides from scratch, these files provide expert-level coaching content that the RAG pipeline can retrieve. When a user asks "How should I structure my answer?", the retriever will find the STAR method guide. When the `score_answer` tool needs rubric context, it can pull from the scoring rubric. This makes the knowledge base immediately high-quality without manual authoring.

   **Chunking note:** Some of these files are large (5,000+ words). The RecursiveCharacterTextSplitter (chunkSize: 500, overlap: 50) will handle this — each file becomes 10-50 chunks. The `source` metadata on each chunk preserves which file it came from for citation.

3. **Update app/api/upload/route.ts:**
   - After PDF text extraction, call addDocuments(projectId, extractedText, fileName)
   - This applies to CV, job description, and additional documents

4. **Update project deletion** (app/api/projects/[id]/route.ts DELETE handler):
   - Call deleteProjectDocuments(projectId) when a project is deleted
   - Note: cascade delete on VectorDocument already handles this, but explicit call ensures vector cleanup

5. **Embed knowledge base on startup or via a seed script:**
   - Create a seed script or initialization function that checks if knowledge base documents are already embedded
   - If not, read all files from lib/knowledge-base/ and embed them with a special projectId like "__knowledge_base__"
   - For Vercel deployment: run the seed script once via `npx prisma db seed` or a one-time API endpoint

6. **Add Supabase client if using SupabaseVectorStore:**
   - Install @supabase/supabase-js
   - Create lib/supabase.ts with the Supabase client (using SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from env)
   - Add these env vars to .env.local

### Key constraints
- Embeddings use text-embedding-3-small (1536 dimensions — matches the vector(1536) column from Phase 0)
- Chunk size 500 tokens, overlap 50 — sensible defaults for interview content
- Metadata must include projectId and source (filename) for filtering and citation
- The VectorDocument table stores both the text content (for display) and the embedding (for search)
- When retrieving, always filter by projectId OR "__knowledge_base__" to include both user documents and the static knowledge base
- The interview-coach-skill reference files are MIT-licensed — safe to include

### Files to read before starting
- `lib/langchain.ts` — LangChain wrapper (created in Phase 1)
- `prisma/schema.prisma` — VectorDocument model (created in Phase 0)
- The interview-coach-skill `references/` directory — source content for knowledge base

### Done when
- [x] Uploading a PDF triggers chunking + embedding into Supabase
- [x] Knowledge base files (9 from interview-coach-skill + 2 custom) are embedded (via seed script or first-run init)
- [x] retrieveContext() returns relevant chunks for a test query
- [x] Deleting a project clears its vector documents
- [x] Build passes

---

## Phase 3: RAG Pipeline — Retrieval + Query Translation

**Status:** ✅ COMPLETE (March 20, 2026)
**Estimated time:** 3-4 hours
**Depends on:** Phase 2 (vector store must exist)

### Tasks

1. **Implement Multi-Query Retrieval** (query translation technique):
   - Before vector search, generate 3 rephrasings of the user question using a quick LLM call
   - Search the vector store with all 3 queries + the original
   - Merge and deduplicate results by document content
   - This satisfies the Sprint 2 requirement for "advanced RAG with query translation"

2. **Create lib/rag.ts:**
   - retrieveWithQueryTranslation(projectId, query, k) — generates 3 alternative queries via LLM, searches vector store with all 4 queries, deduplicates and ranks results, returns top-k chunks + the generated queries (for UI display)

3. **Update app/api/messages/route.ts:**
   - Before sending to the LLM, call retrieveWithQueryTranslation()
   - Inject retrieved chunks into the system prompt as a "## Relevant Context" section
   - Include source metadata in the SSE response: data: {"sources": [...]}
   - Send sources AFTER the done event

4. **Update the frontend to display sources:**
   - In components/message-bubble.tsx or components/chat-window.tsx:
     - Parse the sources SSE event
     - Store sources on the message object
     - Display a collapsible "Sources" section below AI messages
     - Show: source filename, relevance score, chunk preview (first 100 chars)

5. **Add i18n keys** for source display labels

### Key constraints
- Query translation uses the SAME model as the chat (from ai-settings) but with temperature 0 and max_tokens 200
- Only retrieve context for preparation and mock_interview chat types (gap analysis does not need RAG — it uses the full document)
- The "## Relevant Context" section goes AFTER the system prompt but BEFORE the chat history
- Retrieve from BOTH the user's project documents AND the "__knowledge_base__" projectId

### Done when
- [x] Sending a message triggers retrieval with query translation
- [x] Retrieved chunks appear in the system prompt sent to OpenAI
- [x] Sources are displayed below AI messages in the UI
- [x] Multi-query generates 3 alternative queries
- [x] Build passes

---

## Phase 4: Tool Calling

**Status:** ✅ COMPLETE (March 21, 2026)
**Estimated time:** 3-4 hours
**Depends on:** Phase 1 (LangChain), Phase 2 (vector store for search_knowledge_base tool)

### Tasks

1. **Create lib/tools.ts** with 3+ tools using LangChain tool interface:

   **Tool 1: score_answer**
   - Input: { answer: string, category: string, jobDescription: string }
   - Action: Uses LLM to evaluate the answer against the job description **using the 5-dimension rubric from the interview-coach-skill** (Substance, Structure, Relevance, Credibility, Differentiation — each scored 1-5)
   - Output: { overallScore: number, dimensions: { substance: number, structure: number, relevance: number, credibility: number, differentiation: number }, strengths: string[], weaknesses: string[], suggestion: string, rootCause: string | null }
   - Purpose: Structured multi-dimensional scoring replacing the current regex-based single-score extraction
   - **Rubric source:** The scoring prompt for this tool should reference the rubric from `lib/knowledge-base/rubrics-and-scoring.md` (originally `references/rubrics-detailed.md` from interview-coach-skill). Include the seniority calibration bands and differentiation anchors in the tool's internal LLM prompt.
   - **Score mapping:** The `overallScore` (1-10 for backward compatibility) is derived from the 5 dimensions: `overallScore = (avg of 5 dimensions) * 2`. This preserves compatibility with the existing score tracking, spaced repetition, and mock interview unlock (score >= 7.0).
   - **Description guideline:** Write a precise, unambiguous description so the LLM knows exactly when to use it. Example: "Evaluate a candidate's interview answer against the job description using a 5-dimension rubric (Substance, Structure, Relevance, Credibility, Differentiation). Use this ONLY when the user has provided a substantive answer to an interview question. Do NOT use for greetings, follow-up questions, or general conversation."

   **Tool 2: get_weak_areas**
   - Input: { projectId: string }
   - Action: Queries the database for messages with flagged: true, groups by category
   - Output: { weakAreas: [{ category: string, avgScore: number, count: number, sampleQuestions: string[] }] }
   - Purpose: Helps the coach focus on the candidate weak spots
   - **Description guideline:** "Retrieve the candidate's weak areas based on previous interview answers. Use this when the candidate asks about their progress, weak spots, or what to focus on. Do NOT use when the candidate is answering a question."

   **Tool 3: search_knowledge_base**
   - Input: { query: string, projectId: string }
   - Action: Calls retrieveContext() from the vector store
   - Output: { results: [{ text: string, source: string, score: number }] }
   - Purpose: Lets the LLM decide when to look up coaching material from the interview-coach-skill knowledge base
   - **Description guideline:** "Search the interview coaching knowledge base for methodology tips, frameworks (STAR, WHO), scoring rubrics, practice drill instructions, story-building techniques, and best practices. Use this when the candidate asks HOW to answer a type of question, needs coaching methodology, or wants to understand interview frameworks. Do NOT use for scoring or progress tracking."

2. **Bind tools to the LLM** in app/api/messages/route.ts:
   - Use ChatOpenAI.bindTools() to attach the tools
   - Implement a tool execution loop: if the LLM returns a tool call, execute it, feed the result back, and continue
   - Stream the final text response (not the tool call JSON)

3. **Update the SSE stream** to include tool call events:
   - data: {"toolCall": {"name": "score_answer", "status": "running"}} — when a tool starts
   - data: {"toolCall": {"name": "score_answer", "status": "done", "result": {...}}} — when done

4. **Update the frontend** to display tool call results:
   - Show a styled card for score_answer results: overall score badge + 5-dimension radar/bar chart (Substance, Structure, Relevance, Credibility, Differentiation) + strengths/weaknesses lists + root cause if detected
   - Show a summary card for get_weak_areas results
   - Show source cards for search_knowledge_base results

5. **Add i18n keys** for tool-related UI text

6. **Add over-eager tool use prevention to the system prompt:**
   - Add explicit instructions to the Marcus Webb system prompt: "Only use tools when you need real data or structured evaluation. For general advice, motivational responses, follow-up questions, or conversational replies, respond directly without calling any tools."
   - This prevents the LLM from calling tools on every message (e.g., calling `score_answer` when the user just says "hello" or asks a clarifying question)

### Key constraints
- Tools are only available in preparation chat type (not gap analysis or mock interview)
- The LLM decides when to call tools — do not force tool calls on every message
- Tool results are included in the conversation context so the LLM can reference them
- Keep the existing score extraction as a fallback if score_answer tool is not called
- **Tool descriptions are critical** — vague descriptions lead to wrong tool selection. If the LLM picks the wrong tool, improve the description first before changing other code.
- The 5-dimension scoring from interview-coach-skill maps to the existing 1-10 scale via `(avg * 2)` — no database schema changes needed

### Done when
- [x] 3 tools are defined and bound to the LLM
- [x] score_answer returns 5-dimension scores + overall score (1-10)
- [x] The LLM calls tools when appropriate during preparation chats
- [x] The LLM does NOT call tools for greetings, follow-ups, or general conversation
- [x] Tool results are displayed in the UI (including dimension breakdown for score_answer)
- [x] Tool execution events appear in the SSE stream
- [x] Build passes

---

## Phase 4b: Tool Calling Evaluation

**Status:** NOT STARTED
**Estimated time:** 2-3 hours
**Depends on:** Phase 4 (tools must be implemented)
**Why:** The Sprint 2 learning material explicitly covers tool calling evaluation as a key skill. This phase ensures your tools work correctly across a range of inputs and catches over-eager tool use, wrong tool selection, and parameter extraction errors. It also counts as a **Medium optional task**.

### Tasks

1. **Create a test dataset** (`lib/tool-eval/test-cases.ts`):
   - Design 14-18 test cases across 4 difficulty tiers:

   | Difficulty | # Cases | Examples |
   |---|---|---|
   | Easy (3-4) | Clear intent, obvious tool match | "Score my answer: I led a team of 5..." → `score_answer` |
   | Medium (4-5) | Indirect phrasing, misleading keywords | "Can you search for how I did on leadership questions?" → `get_weak_areas`, NOT `search_knowledge_base` |
   | Hard (3-4) | Blended intents, multi-tool ambiguity | "How should I answer leadership questions and what's my score so far?" → could be `search_knowledge_base` + `get_weak_areas` |
   | Edge case (4-5) | No tool should be called | "Hello", "Tell me a joke", "I'm nervous about my interview", "Thanks for the help", "Delete my account" |

   **Test case design informed by interview-coach-skill mode detection:** The skill's 20-rule mode detection priority list (in CLAUDE.md) provides excellent inspiration for medium/hard cases where intent is ambiguous. For example:
   - "What's the STAR method?" → `search_knowledge_base` (methodology lookup)
   - "How did I do on STAR-format questions?" → `get_weak_areas` (progress tracking, NOT methodology)
   - "Score this using the 5-dimension rubric: [answer]" → `score_answer` (explicit scoring request)
   - "I'm nervous about my interview tomorrow" → no tool (emotional support, not data retrieval)

   Each test case defines:
   ```typescript
   interface ToolTestCase {
     query: string;
     expectedTool: string | null;  // null = no tool expected
     expectedParams?: Record<string, unknown>;
     difficulty: "easy" | "medium" | "hard" | "edge";
     description: string;
   }
   ```

2. **Create the evaluation script** (`lib/tool-eval/evaluate.ts`):
   - Run each test case through the LLM with tools bound
   - Capture which tool was called (if any) and with what parameters
   - Compute metrics:
     - **Tool Selection Accuracy** — did the agent pick the right tool? (deterministic, binary)
     - **Parameter Extraction Accuracy** — did it pass correct parameters? (deterministic, string comparison)
     - **Per-difficulty breakdown** — accuracy grouped by easy/medium/hard/edge
   - Output a results table showing: query, expected tool, actual tool, pass/fail, parameters match

3. **Add "no tool expected" edge cases:**
   - Include at least 4-5 cases where the agent should NOT call any tool
   - These catch over-eager tool use — just as problematic as under-use
   - Examples: greetings, emotional statements, off-topic requests, thank-you messages

4. **Interpret results and iterate:**
   - If tool selection accuracy is low → improve tool descriptions in `lib/tools.ts`
   - If parameters are wrong but tool selection is correct → improve parameter schemas and descriptions
   - If the agent calls tools when it shouldn't → strengthen the system prompt boundaries (see Phase 4, task 6)
   - Document findings in a results summary

5. **Optional: Add LLM-as-Judge evaluation:**
   - For ambiguous cases where deterministic checks are too strict
   - Use a second LLM call to judge whether the tool selection was "reasonable" given the query
   - Compare deterministic vs. LLM-judge results to find disagreements

### Key constraints
- Tool calling evaluation is deterministic and cheap — only costs the agent API calls themselves
- Run the evaluation after every change to tool descriptions or system prompts
- The test dataset should cover the full range: correct tool use, wrong tool use, and no-tool-needed scenarios
- Keep the evaluation script runnable as a standalone command: `npx tsx lib/tool-eval/evaluate.ts`

### Files to create
- `lib/tool-eval/test-cases.ts` — test dataset
- `lib/tool-eval/evaluate.ts` — evaluation runner + metrics
- `lib/tool-eval/results.md` — evaluation results summary (generated)

### Done when
- [ ] Test dataset with 14+ cases across 4 difficulty tiers
- [ ] Evaluation script runs and produces accuracy metrics
- [ ] Tool selection accuracy is documented per difficulty tier
- [ ] At least 4 "no tool expected" edge cases are included and pass
- [ ] Results are documented in `lib/tool-eval/results.md`
- [ ] Any failing cases have been addressed (improved descriptions/prompts)

---

## Phase 5: UI Polish + Integration Testing

**Status:** NOT STARTED
**Estimated time:** 2-3 hours
**Depends on:** Phases 0-4b

### Tasks

1. Add RAG visualization: show which chunks were retrieved and their similarity scores
2. Add progress indicators for tool execution and retrieval
3. Ensure all new UI elements work with i18n (DE/EN)
4. Test all flows end-to-end:
   - Upload PDF > chunks embedded in Supabase > chat uses retrieval > sources shown
   - Tool calls work in preparation chats
   - Gap analysis still works (no RAG, direct document injection)
   - Mock interview still works
   - AI settings are applied to all new features
5. Update DOCUMENTATION.md with Sprint 2 architecture changes:
   - New architecture diagram showing Supabase + pgvector
   - New sections for RAG pipeline, tool calling, LangChain
   - Updated tech stack table
   - Updated project structure
   - **New section: Knowledge Base** — document the interview-coach-skill source, file mapping, and how the knowledge base is embedded
   - **New section: 5-Dimension Scoring Rubric** — document the rubric from interview-coach-skill and how it maps to the existing 1-10 scale
   - **New section: Tool Calling Evaluation** — document the evaluation methodology, test dataset design, and results
6. Update README.md with new features and Sprint 2 optional tasks completed

### Done when
- [ ] All features work end-to-end
- [ ] UI is polished with proper loading states
- [ ] Documentation is updated
- [ ] Build passes

---

## Phase 6: Deploy to Vercel + Supabase

**Status:** NOT STARTED
**Estimated time:** 2-3 hours
**Depends on:** Phases 0-5 (everything must work locally first)

### Tasks

1. **Vercel setup:**
   - Connect the GitHub repository to Vercel
   - Set environment variables in Vercel dashboard:
     - `OPENAI_API_KEY`
     - `DATABASE_URL` (Supabase pooled connection string)
     - `DIRECT_URL` (Supabase direct connection string)
     - `SUPABASE_URL` (if using Supabase client for vectors)
     - `SUPABASE_SERVICE_ROLE_KEY` (if using Supabase client for vectors)
   - Set build command: `npx prisma generate && npm run build`
   - Set Node.js version to 18 or 20

2. **Prisma on Vercel:**
   - Add `prisma generate` to the build step (or add a `postinstall` script in package.json)
   - Ensure `@prisma/client` is in dependencies (not devDependencies)

3. **Seed the knowledge base in production:**
   - Run the knowledge base seed script against the production Supabase database
   - This embeds all 11 knowledge base files (9 from interview-coach-skill + 2 custom)
   - This can be done locally by temporarily pointing DATABASE_URL to the production DB
   - Or create a protected API endpoint that triggers seeding

4. **Test the deployed app:**
   - Create a project, upload PDF, verify gap analysis
   - Start a preparation chat, verify streaming works
   - Verify RAG retrieval and source display
   - Verify tool calling works (especially 5-dimension scoring)
   - Test on mobile

5. **Domain and polish (optional):**
   - Add a custom domain in Vercel if desired
   - Set up Vercel Analytics (free tier)

### Key constraints
- Vercel serverless functions have a 10-second timeout on the free plan (30s on Pro). Streaming responses work fine because the connection stays open, but long-running non-streaming calls (like gap analysis) may need optimization.
- The ai-settings must be in the database (done in Phase 0) — Vercel has no persistent filesystem.
- File uploads (PDFs) are processed in memory and text is stored in the database. The actual PDF files are NOT stored — only the extracted text. This is fine for Vercel.

### Done when
- [ ] App is deployed and accessible via Vercel URL
- [ ] All features work in production (chat, RAG, tools, gap analysis)
- [ ] Environment variables are configured
- [ ] Knowledge base is seeded in production (11 files embedded)
- [ ] This counts as the Hard optional task: "Deploy to cloud with proper scaling"

---

## Phase 7: Optional Tasks (Bonus Points)

**Status:** NOT STARTED
**Estimated time:** 4-8 hours (pick based on available time)

Choose from these to maximize evaluation score (need 2 medium + 1 hard for max points).
Note: Deployment (Phase 6) already counts as 1 hard task.
Note: Tool Calling Evaluation (Phase 4b) already counts as 1 medium task.

### Medium (pick 2+, 1 already done via Phase 4b)
- [x] **Tool calling evaluation** (done in Phase 4b — deterministic + optional LLM-as-Judge)
- [ ] Calculate and display token usage and costs (partially done — enhance with per-session totals)
- [ ] Add visualization of tool call results (done in Phase 4 if styled cards are implemented)
- [ ] Implement conversation export in various formats (PDF, CSV, JSON) — currently only Markdown
- [ ] Connect to tools from a publicly available remote MCP server
- [ ] Implement advanced caching strategies for RAG retrieval

### Hard (pick 1+ additional, since deploy is already done)
- [ ] Implement RAG evaluation using RAGAs or custom pipeline
- [ ] Implement tools as MCP servers
- [ ] Implement advanced indexing (e.g., RAPTOR, ColBERT)

---

## Session Log

> Add an entry here after each Claude Code session. Format:
> ### Session X (Date) – Phase Y: Description
> - What was done
> - What files were changed
> - What is next

### Session 1 (March 20, 2026) – Phase 0: Supabase Setup + PostgreSQL Migration
- Migrated from SQLite + LibSQL to Supabase PostgreSQL + PrismaPg adapter
- Added AiSettings (singleton) and VectorDocument models to Prisma schema
- Enabled pgvector extension, added embedding column + ivfflat index via raw SQL
- Migrated ai-settings from file-based JSON to database storage
- Configured pooled (port 6543) + direct (port 5432) connection strings
- Fixed Turbopack root issue caused by stray home directory package-lock.json
- Build passes, all existing features work against PostgreSQL
- **Next:** Phase 1 — LangChain Refactor

### Session 2 (March 20, 2026) – Phase 1: LangChain Refactor
- Installed `langchain`, `@langchain/openai`, `@langchain/core`
- Created `lib/langchain.ts` — LangChain `ChatOpenAI` wrapper with `streamChat()` (streaming via `model.stream()` with `streamUsage: true`), `chat()` (non-streaming via `model.invoke()`), `toLangChainMessages()` helper, and raw `openaiClient` export for Whisper
- `createModel()` factory handles restricted models (gpt-5-mini/nano) by skipping temperature/frequencyPenalty/topP
- Updated `app/api/messages/route.ts` — streaming via LangChain (`chunk.content` for text, `chunk.usage_metadata` for token counts)
- Updated `app/api/projects/[id]/gap-analysis/route.ts` — non-streaming via `model.invoke()` (`response.content` instead of `response.choices[0]?.message?.content`)
- Updated `app/api/transcribe/route.ts` — import path change to `openaiClient` from `lib/langchain`
- Deleted `lib/openai.ts` (fully replaced)
- Build passes, streaming verified end-to-end (token tracking + cost calculation working)
- **Next:** Phase 2 — RAG Pipeline: Ingestion with Supabase pgvector

### Session 3 (March 20, 2026) – Phase 2: RAG Pipeline — Ingestion with Supabase pgvector
- Installed `@supabase/supabase-js`, `@langchain/textsplitters`
- Created `lib/supabase.ts` — Supabase client using service role key
- Created `lib/vectorstore.ts` — core RAG ingestion module:
  - `addDocuments(projectId, text, source)` — chunks text with `RecursiveCharacterTextSplitter` (500/50), embeds with `text-embedding-3-small`, inserts via raw SQL with `::vector` cast
  - `retrieveContext(projectId, query, k)` — cosine similarity search (`1 - (embedding <=> query)`) filtered by projectId OR `__knowledge_base__`
  - `deleteProjectDocuments(projectId)` — cleanup via Prisma `deleteMany`
- Created `lib/knowledge-base/` directory with 11 markdown files:
  - 9 files adapted from `github.com/noamseg/interview-coach-skill` references directory (cleaned to remove tool-specific workflow references)
  - 2 custom files: `who-interview-method.md` (WHO 4-stage interview framework) and `interview-categories.md` (app's 5 interview categories)
- Created `scripts/seed-knowledge-base.ts` — idempotent seed script:
  - Creates a sentinel `__knowledge_base__` Project row (required by foreign key constraint)
  - Reads all `.md` files from `lib/knowledge-base/`, chunks, embeds, and inserts
  - Loads both `.env` and `.env.local` via dotenv
- Updated `app/api/upload/route.ts` — after PDF text extraction, calls `addDocuments()` for CV, job description, and additional documents
- Updated `app/api/projects/[id]/route.ts` — DELETE handler calls `deleteProjectDocuments()` before project deletion
- Updated `app/api/projects/route.ts` — GET excludes the `__knowledge_base__` sentinel project from the sidebar listing
- Verified `retrieveContext()` returns relevant results (tested: "How should I structure my STAR answer?")
- Build passes, app verified in browser (no console errors, sentinel project hidden from sidebar)
- **Next:** Phase 3 — RAG Pipeline: Retrieval + Query Translation

### Session 4 (March 20, 2026) – Phase 3: RAG Pipeline — Retrieval + Query Translation
- Created `lib/rag.ts` — multi-query retrieval with query translation:
  - `generateAlternativeQueries()` — generates 3 alternative rephrasings using same model as chat (temperature 0, maxTokens 200)
  - `retrieveWithQueryTranslation()` — searches vector store with all 4 queries (original + 3 alternatives) in parallel, deduplicates by content keeping highest similarity, returns top-k ranked chunks
- Updated `app/api/messages/route.ts`:
  - Added RAG retrieval before LLM call (only for `preparation` and `mock_interview` chat types)
  - Injects retrieved chunks as `## Relevant Context` section in system prompt (after CV/JD, before chat history)
  - RAG failure is non-blocking — logs error, continues without context
  - Sends `sources` SSE event after `done` event with `{ source, similarity, preview }[]`
- Updated `components/chat-window.tsx`:
  - Extended `Message` and `StreamMeta` interfaces with `sources` field
  - Updated stream parser to capture `sources` event after `done`
  - Passes sources to `MessageBubble` in all three message creation paths (autoStart, sendMessage, regenerate)
- Updated `components/message-bubble.tsx`:
  - Added collapsible "Sources" section below AI messages
  - Shows source filename, similarity percentage badge, 2-line content preview
- Added i18n keys: `sources.label` — "Quellen" (DE) / "Sources" (EN)
- Build passes, app verified in browser (no console errors, sources UI renders correctly)
- **Next:** Phase 4 — Tool Calling

### Session 5 (March 21, 2026) – Phase 4: Tool Calling
- Created `lib/tools.ts` with 3 LangChain tools using `@langchain/core/tools`:
  - `score_answer` — 5-dimension rubric scoring (Substance, Structure, Relevance, Credibility, Differentiation) via dedicated LLM call with full rubric from knowledge base. Maps 1-5 dimensions to 1-10 overall score via `avg * 2`
  - `get_weak_areas` — queries flagged messages grouped by category, returns avg scores + sample questions
  - `search_knowledge_base` — calls `retrieveContext()` from vector store for coaching material lookup
- Updated `lib/langchain.ts` — added `createBoundModel()` (uses `ChatOpenAI.bindTools()`) and exported `toLangChainMessages()`
- Updated `app/api/messages/route.ts`:
  - Added tool execution loop for preparation chats: binds tools → invokes model → executes tool calls → feeds ToolMessage results back → streams final text response
  - SSE events for tool calls: `{ toolCall: { name, status: "running" } }` and `{ toolCall: { name, status: "done", result } }`
  - Score extraction prefers tool-based `overallScore` over regex fallback
  - Auto-injects `projectId` and `jobDescription` into tool args when missing
- Created `components/tool-call-card.tsx` — UI components for tool result display:
  - `ScoreCard` — overall score badge + 5-dimension progress bars + strengths/weaknesses + suggestion + root cause
  - `WeakAreasCard` — weak areas grouped by category with avg scores
  - `KnowledgeCard` — knowledge base search results with source + similarity
- Updated `components/chat-window.tsx` — handles `toolCall` SSE events, shows active tool cards during streaming, attaches completed tool results to messages, clears on finish
- Updated `components/message-bubble.tsx` — renders `ToolCallCard` components below message content
- Added 18 i18n keys (DE + EN) for tool-related UI text
- Updated `lib/prompts.ts`:
  - **Marcus Webb v2 system prompt** — structured onboarding (3 questions one at a time), 5-dimension scoring built into prompt, feedback structure (What I Heard → Score → Working → Gap → Next), coaching intelligence (weak area tracking, story excavation, candidate adaptation), tool usage rules, 12 non-negotiable rules
  - **Gap Analysis v2 prompt** — 4-level fit scoring (Strong Fit → Workable → Stretch → Gap), seniority inference, story bank candidates with excavation prompts, dimension risk assessment table, coaching priority plan ordered by interview impact
- Build passes, app verified in browser (no compilation errors, no new console errors)
- **Next:** Phase 4b — Tool Calling Evaluation

---

## Quick Reference: Key Files

| File | Purpose | Sprint 2 changes |
|---|---|---|
| prisma/schema.prisma | Database schema | Phase 0: Switch to PostgreSQL, add VectorDocument |
| lib/db.ts | Database connection | Phase 0: Remove LibSQL adapter |
| lib/ai-settings.ts | AI settings | Phase 0: Migrate from file to database |
| lib/langchain.ts | LangChain ChatOpenAI wrapper (was lib/openai.ts) | Phase 1: ✅ Refactored to LangChain |
| lib/supabase.ts | Supabase client (NEW) | Phase 0/2: Create if using SupabaseVectorStore |
| lib/vectorstore.ts | Vector store (NEW) | Phase 2: Create with pgvector |
| lib/rag.ts | RAG retrieval + query translation (NEW) | Phase 3: ✅ Created |
| lib/tools.ts | Tool definitions (NEW) | Phase 4: ✅ Created (score_answer, get_weak_areas, search_knowledge_base) |
| lib/tool-eval/test-cases.ts | Tool evaluation test dataset (NEW) | Phase 4b: Create |
| lib/tool-eval/evaluate.ts | Tool evaluation runner (NEW) | Phase 4b: Create |
| lib/tool-eval/results.md | Tool evaluation results (NEW) | Phase 4b: Generated |
| lib/knowledge-base/ | Static domain documents (NEW — 9 from interview-coach-skill, cleaned + 2 custom) | Phase 2: Create |
| app/api/messages/route.ts | Chat endpoint | Phases 1, 3, 4: Major changes (Phase 3 ✅, Phase 4 ✅) |
| app/api/upload/route.ts | PDF upload | Phase 2: Add embedding |
| components/message-bubble.tsx | Message display | Phases 3, 4: Add sources + tool results (Phase 3 ✅, Phase 4 ✅) |
| components/chat-window.tsx | Chat UI | Phases 3, 4: Parse new SSE events (Phase 3 ✅, Phase 4 ✅) |
| components/tool-call-card.tsx | Tool result cards (NEW) | Phase 4: ✅ Created (ScoreCard, WeakAreasCard, KnowledgeCard) |
| lib/prompts.ts | System prompts | Phase 4: ✅ Updated (Marcus Webb v2 + Gap Analysis v2) |
| DOCUMENTATION.md | Full project docs | Phase 5: Update with Sprint 2 sections |

---

## Knowledge Base File Inventory

Summary of all files in `lib/knowledge-base/` (11 files after cleanup — 8 command workflow files removed to reduce RAG pollution):

| # | File | Source | Primary use |
|---|---|---|---|
| 1 | rubrics-and-scoring.md | interview-coach-skill (cleaned) | `score_answer` tool rubric, general scoring |
| 2 | storybank-and-star-method.md | interview-coach-skill (cleaned) | STAR method coaching, story building |
| 3 | differentiation-and-earned-secrets.md | interview-coach-skill (cleaned) | Making answers memorable |
| 4 | coaching-frameworks.md | interview-coach-skill (cleaned) | Gap-handling, signal-reading, psych readiness |
| 5 | story-mapping.md | interview-coach-skill (cleaned) | Story-to-question mapping |
| 6 | scoring-calibration.md | interview-coach-skill (cleaned) | Scoring drift, outcome correlation |
| 7 | role-specific-drills.md | interview-coach-skill (cleaned) | PM, Engineering, Design drills |
| 8 | scored-examples.md | interview-coach-skill (cleaned) | Few-shot scored answer examples |
| 9 | challenge-protocol.md | interview-coach-skill (cleaned) | Challenge framework |
| 10 | who-interview-method.md | custom | WHO method overview |
| 11 | interview-categories.md | custom | App's 5 interview categories |

**Removed files** (command workflows for interview-coach-skill that polluted RAG retrieval):
coaching-kickoff.md, interview-prep-workflow.md, transcript-analysis.md, transcript-analysis-workflow.md, practice-drills-workflow.md, mock-interview-workflow.md, storybank-workflow.md, jd-decoding.md

**Cleanup applied to remaining 9 interview-coach-skill files:** Removed references to coaching_state.md, Interview Loops, drill progression stages, /kickoff /prep /analyze /practice /mock /stories /decode commands, and other features specific to the interview-coach-skill tool. Preserved all domain knowledge (scoring rubrics, coaching frameworks, drill content, story mapping concepts).

---

## Architecture Overview (Sprint 2)

```
Browser (Next.js Frontend)
    |
    v
Vercel (Next.js API Routes)
    |
    +---> Supabase PostgreSQL (Prisma ORM)
    |         - Projects, Chats, Messages, Documents
    |         - VectorDocument table (pgvector embeddings)
    |         - AI Settings
    |
    +---> OpenAI API
    |         - ChatOpenAI via LangChain (streaming)
    |         - text-embedding-3-small (embeddings)
    |         - Whisper (voice transcription)
    |
    +---> LangChain
    |         - ChatOpenAI (chat + tool calling)
    |         - OpenAIEmbeddings (document + query embedding)
    |         - RecursiveCharacterTextSplitter (chunking)
    |         - Tool definitions (score_answer, get_weak_areas, search_knowledge_base)
    |         - Multi-query retrieval (query translation)
    |         - Tool calling evaluation (Phase 4b)
    |
    +---> Knowledge Base (lib/knowledge-base/)
              - 9 files adapted from interview-coach-skill (MIT licensed, cleaned)
              - 2 custom files (WHO method, interview categories)
              - Embedded chunks in pgvector
              - Provides: scoring rubrics, STAR/WHO frameworks,
                coaching methodology, practice drills, examples
```
