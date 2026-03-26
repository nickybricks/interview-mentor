# Interview Mentor

AI-powered interview preparation app that helps job applicants practice for interviews with personalized coaching, gap analysis, and mock interviews.

## Project Overview

Interview Mentor is a full-stack web application that acts as an AI interview coach. Users create a project and are guided through four phases:

1. **Kickoff** — Conversational onboarding where the AI coach gets to know the candidate, analyzes their CV, builds a coaching profile, and creates a personalized preparation plan
2. **Gap Analysis** — Compares the CV against the job description to identify strengths, gaps, and areas to improve
3. **Interview Preparation** — Asks targeted questions from 5 categories (Experience, Problem-Solving, Leadership, Technical, Motivation), provides detailed feedback with scores (1–10), and uses spaced repetition to focus on weak areas
4. **Mock Interviews** — Simulates a realistic interview session (unlocked when the user's average score reaches 7.0+)

The AI coach uses a 50-question bank from the WHO interview method (Screening → Topgrading → Focused → Reference) and adapts questions to the candidate's profile.

## Tech Stack

| Technology | Purpose |
|---|---|
| **Next.js 16** (App Router) | Full-stack React framework (frontend + API routes) |
| **TypeScript** | Type-safe JavaScript |
| **Prisma 7** + Supabase PostgreSQL | ORM + cloud-hosted database with pgvector for RAG embeddings |
| **LangChain** (`@langchain/openai`) | AI framework with tool calling support |
| **OpenAI API** (gpt-4.1-mini default) | AI-powered coaching, gap analysis, transcription |
| **Tailwind CSS v4** | Utility-first styling |
| **shadcn/ui** (base-nova) | Pre-built UI components |
| **react-markdown** + remark-gfm | Markdown rendering for AI responses |

## Features

- **Kickoff Coaching** — Conversational onboarding with CV analysis, coaching profile creation, timeline-aware coaching plan, and coaching state persistence
- **Gap Analysis** — Automated CV vs. job description comparison with markdown-rendered results
- **Interview Preparation** — AI-coached practice with coaching-state-aware session flow: opens with kickoff context (target role, concerns, story seeds, coaching mode), eliminates redundant onboarding, adapts intensity to triage/focused/full mode, and drills interviewer concerns proactively
- **Mock Interviews** — Simulated interview sessions (unlocked at score ≥ 7.0, enhanced with coaching context)
- **AI Settings Panel** — Per-feature model selection, temperature, top-p, frequency penalty, editable system prompts
- **RAG Knowledge Base** — 11 curated coaching documents (scoring rubrics, STAR method, earned secrets, coaching frameworks, drills) embedded via pgvector for context-aware responses
- **Tool Calling** — LangChain tools for answer scoring (5-dimension rubric), weak area tracking, and knowledge base search
- **Security Guards** — Defense-in-depth prompt injection protection (prompt-level LLM guardrail + input sanitization)
- **Voice Input** — Speech-to-text via OpenAI Whisper with locale-aware language detection
- **Multi-File Upload** — CV, job description, and additional documents (certificates, references, transcripts)
- **Internationalization** — German (default) and English with instant switching — covers UI, API routes, prompts, export labels, and Whisper transcription language
- **Token & Cost Tracking** — Per-message input/output token counts, cost breakdown, speed metrics
- **Regenerate & Version Navigation** — ChatGPT-style `< 1/2 >` version arrows for regenerated responses
- **Markdown Export** — Download full project data (gap analysis, scores, chat transcripts) as `.md`
- **Collapsible Sidebar** — Desktop sidebar toggle, mobile Sheet overlay
- **Responsive Design** — Full mobile support with adaptive layouts
- **Accessibility** — aria-labels on all icon buttons, focus-visible states, semantic HTML, aria-live regions for async updates, confirmation dialogs for destructive actions, locale-aware number/currency/date formatting via `Intl.*`

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     BROWSER (Frontend)                        │
│  User types message → fetch("/api/messages", { POST })       │
└─────────────────────────────┬────────────────────────────────┘
                              │ HTTP Request
                              ▼
┌──────────────────────────────────────────────────────────────┐
│               NEXT.JS API ROUTES (Backend)                    │
│                                                              │
│  app/api/messages/route.ts                                   │
│    1. Validate message        (lib/security.ts)              │
│    2. Save to database        (lib/db.ts → Prisma → PG)     │
│    3. Load system prompt      (lib/prompts.ts)               │
│    4. RAG: multi-query retrieval (lib/rag.ts → vectorstore)  │
│    5. Inject retrieved context into system prompt             │
│    6. Fetch chat history from DB                             │
│    6b. Inject coaching state   (lib/prompts.ts → buildCoachingContext) │
│    7. Send to OpenAI          (lib/langchain.ts)             │
│       7a. Tool calling: bind tools → invoke → execute        │
│           → feed results back → loop (max 5 iterations)      │
│           Kickoff: saveCoachingProfile, searchKnowledgeBase   │
│           Preparation: scoreAnswer, getWeakAreas, searchKB    │
│    8. Stream response + tool calls + sources back to browser │
│    9. Save AI response to DB                                 │
│                                                              │
│  app/api/upload/route.ts                                     │
│    1. Parse PDF               (pdf-parse)                    │
│    2. Save text to DB         (full text, no embedding)      │
└──────────┬──────────────────────┬────────────────────────────┘
           │                      │
           ▼                      ▼
┌────────────────────────┐  ┌──────────────────┐
│  Supabase PostgreSQL    │  │  OpenAI API      │
│  (Prisma + PrismaPg)    │  │  via LangChain   │
│                         │  │                  │
│  - Projects             │  │  Chat:           │
│  - Chats                │  │  - gpt-4.1-mini  │
│  - Messages             │  │  - ChatOpenAI    │
│  - Documents            │  │  - Streaming SSE │
│  - AiSettings           │  │                  │
│  - VectorDocument       │  │  Embeddings:     │
│    (pgvector, 1536-dim) │  │  - text-embed-   │
│                         │  │    ing-3-small   │
└────────────────────────┘  └──────────────────┘
```

## Database Schema

6 models defined in `prisma/schema.prisma`:

| Model | Purpose |
|---|---|
| **Project** | One job application — stores name, company, position, CV text, job description, gap analysis result, overall score, coaching state (JSON) |
| **Chat** | Conversation session — linked to a project, typed as `kickoff`, `gap_analysis`, `preparation`, or `mock_interview` |
| **Message** | Individual message — role, content, score, category, flagged (spaced repetition), cost/token tracking, version group for regeneration |
| **Document** | Additional uploaded files (certificates, references) — linked to a project |
| **AiSettings** | Per-feature AI configuration (model, temperature, system prompt) |
| **VectorDocument** | RAG embeddings — pgvector 1536-dim chunks for knowledge base only (CV/JD are injected as full text) |

Cascade deletion: Project → Chats → Messages. Project → Documents.

## RAG Pipeline

1. **Ingestion** — Knowledge base files are chunked (1500 chars, 200 overlap), embedded with `text-embedding-3-small`, stored in `VectorDocument` via pgvector. CV/JD are **not** embedded — their full text is injected directly into the system prompt to avoid chunk pollution and redundancy
2. **Query translation** — For each user message, 3 alternative query rephrasings are generated via LLM
3. **Retrieval** — All 4 queries (original + alternatives) search pgvector (knowledge base only) in parallel, results are deduplicated (highest similarity kept), top-k returned
4. **Injection** — Retrieved chunks are formatted with `[Source N: filename]` headers and injected into the system prompt as context
5. **Knowledge base** — 11 curated coaching documents (scoring rubrics, STAR method, coaching frameworks, drills) seeded via `scripts/seed-knowledge-base.ts`

Active for `preparation` and `mock_interview` chats only (gap analysis uses the full document).

## LangChain Tools

4 tools defined in `lib/tools.ts` using `tool()` from `@langchain/core/tools` with Zod schemas:

| Tool | Purpose | Used In |
|---|---|---|
| `scoreAnswer` | Dedicated LLM call (temperature 0.2) evaluating answers across 5 dimensions: Substance, Structure, Relevance, Credibility, Differentiation (each 1–5, mapped to 1–10) | Preparation |
| `getWeakAreas` | Queries flagged messages grouped by category, returns average scores and sample questions per weak area | Preparation |
| `searchKnowledgeBase` | Searches RAG knowledge base via `retrieveContext()`, returns top 5 results with source, similarity, and preview | Preparation, Kickoff |
| `saveCoachingProfile` | Persists the candidate's coaching state (profile, resume analysis, strategy, readiness assessment) to the database after the kickoff conversation | Kickoff |

## API Routes

### Projects
| Method | URL | Description |
|---|---|---|
| `GET` | `/api/projects` | List all projects (with chats) |
| `POST` | `/api/projects` | Create project (auto-creates kickoff chat) |
| `GET` | `/api/projects/[id]` | Get project with chats |
| `PATCH` | `/api/projects/[id]` | Update project |
| `DELETE` | `/api/projects/[id]` | Delete project (cascades) |
| `GET` | `/api/projects/[id]/export` | Export as Markdown download |

### Chats
| Method | URL | Description |
|---|---|---|
| `GET` | `/api/chats?projectId=xxx` | List chats for project |
| `POST` | `/api/chats` | Create chat |
| `GET` | `/api/chats/[id]` | Get chat with messages |
| `DELETE` | `/api/chats/[id]` | Delete chat (cascades) |

### Messages
| Method | URL | Description |
|---|---|---|
| `POST` | `/api/messages` | Send message + stream AI response (SSE). Supports `regenerate: true` and `autoStart: true` |
| `PATCH` | `/api/messages/[id]/version` | Switch between regenerated versions (`direction: "prev" \| "next"`) |

### Upload & Documents
| Method | URL | Description |
|---|---|---|
| `POST` | `/api/upload` | Upload PDF (FormData: file, projectId, type, label) |
| `DELETE` | `/api/documents/[id]` | Delete additional document |

## Security

| Layer | Protection | Location |
|---|---|---|
| **XSS** | HTML/script tag stripping | `lib/security.ts` → `sanitizeInput()` |
| **Prompt injection** | LLM-level guardrail in system prompt — rejects, redirects, never scores off-topic | `lib/prompts.ts` |
| **File validation** | PDFs only, max 5MB | `lib/security.ts` → `validateFileBuffer()` |
| **Message limits** | Max 10,000 chars, non-empty | `lib/security.ts` → `validateMessageLength()` |
| **API key safety** | Server-only env vars (no `NEXT_PUBLIC_` prefix) | `.env.local` |

Prompt testing results: [docs/System_Prompt_Documentation.xlsx](docs/System_Prompt_Documentation.xlsx) — 3 sheets: Gap Analysis (20 tests), Interview Prep (32 tests), Prompt Injection (18 tests across 12 attack categories).

## Setup

```bash
# Clone the repository
git clone <repo-url>
cd interview-mentor

# Set npm cache (avoids permission issues)
export npm_config_cache=/tmp/npm-cache

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env.local
```

Create `.env.local` with:
```
OPENAI_API_KEY=sk-your-key-here
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Create `.env` with:
```
DATABASE_URL="postgresql://..."    # Supabase pooled connection (port 6543)
DIRECT_URL="postgresql://..."      # Supabase direct connection (port 5432)
```

```bash
# Run database migrations
npx prisma migrate dev

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Completed Optional Tasks

- [x] Voice input via Whisper API (speech-to-text)
- [x] AI Settings panel with per-feature configuration
- [x] Multi-file document upload (additional certificates, references)
- [x] Internationalization (DE/EN)
- [x] Token usage & cost tracking per message
- [x] Regenerate response with version navigation
- [x] Markdown export of project data
- [x] Prompt injection security hardening (prompt-level LLM guardrail)
- [x] WHO interview method question bank (50 questions)
- [x] Spaced repetition for weak answers
- [x] Collapsible sidebar
- [x] Kickoff coaching phase with coaching state persistence
- [x] Coaching profile (CoachingState) with structured schema for candidate data
- [x] Auto-created kickoff chat on project creation
- [x] Coaching context injection into downstream prompts (preparation, mock interview)
- [x] `saveCoachingProfile` tool for AI-driven profile persistence
- [x] Coaching profile included in markdown export

## Known Limitations & Future Work

- **Smarter question selection** — Use RAG similarity search for more relevant follow-up question selection
- **Mock interview prompt refinement** — Improve realism and difficulty scaling of mock interview sessions
- **Voice input via Whisper API** — Currently implemented; future work includes real-time streaming transcription
- **Version history on regenerate** — Currently supports version navigation; future work includes diff view between versions
- **Admin vs. user mode** — Add role-based access for coaches to review candidate progress
- **Language switching fix** — System prompts remain in German when UI switches to English; prompts need i18n support
- **Score display in header** — Show overall score prominently in the app header/sidebar for quick reference
- **Deployment (Phase 6)** — Production deployment to Vercel or similar platform
- **Storybank development** — Build out full storybank workflow from story seeds identified in kickoff

## Deployment Status

**Not deployed — runs locally.** The app is fully functional in local development. Database is on Supabase PostgreSQL (cloud-hosted). Deployment requires environment variable configuration and production Vercel setup.
