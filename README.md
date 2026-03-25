# Interview Mentor

AI-powered interview preparation app that helps job applicants practice for interviews with personalized coaching, gap analysis, and mock interviews.

## Project Overview

Interview Mentor is a full-stack web application that acts as an AI interview coach. Users upload their CV (PDF) and a job description, and the app guides them through three phases:

1. **Gap Analysis** — Compares the CV against the job description to identify strengths, gaps, and areas to improve
2. **Interview Preparation** — Asks targeted questions from 5 categories (Experience, Problem-Solving, Leadership, Technical, Motivation), provides detailed feedback with scores (1–10), and uses spaced repetition to focus on weak areas
3. **Mock Interviews** — Simulates a realistic interview session (unlocked when the user's average score reaches 7.0+)

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

- **Gap Analysis** — Automated CV vs. job description comparison with markdown-rendered results
- **Interview Preparation** — AI-coached practice with 5 prompt variants (A–E), score tracking, and spaced repetition
- **Mock Interviews** — Simulated interview sessions (unlocked at score ≥ 7.0)
- **AI Settings Panel** — Per-feature model selection, temperature, top-p, frequency penalty, editable system prompts
- **RAG Knowledge Base** — 11 curated coaching documents (scoring rubrics, STAR method, earned secrets, coaching frameworks, drills) embedded via pgvector for context-aware responses
- **Tool Calling** — LangChain tools for answer scoring (5-dimension rubric), weak area tracking, and knowledge base search
- **Security Guards** — Defense-in-depth prompt injection protection (40+ regex patterns, obfuscation detection, base64 payload scanning, prompt-level LLM guardrail)
- **Voice Input** — Speech-to-text via OpenAI Whisper with locale-aware language detection
- **Multi-File Upload** — CV, job description, and additional documents (certificates, references, transcripts)
- **Internationalization** — German (default) and English with instant switching — covers UI, API routes, prompts, export labels, and Whisper transcription language
- **Token & Cost Tracking** — Per-message input/output token counts, cost breakdown, speed metrics
- **Regenerate & Version Navigation** — ChatGPT-style `< 1/2 >` version arrows for regenerated responses
- **Markdown Export** — Download full project data (gap analysis, scores, chat transcripts) as `.md`
- **Collapsible Sidebar** — Desktop sidebar toggle, mobile Sheet overlay
- **Responsive Design** — Full mobile support with adaptive layouts

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
- [x] Prompt injection security hardening (40+ patterns + LLM guardrail)
- [x] WHO interview method question bank (50 questions)
- [x] Spaced repetition for weak answers
- [x] Collapsible sidebar

## Documentation

- **[docs/System_Prompt_Documentation.xlsx](docs/System_Prompt_Documentation.xlsx)** — Prompt testing results across 3 sheets: Gap Analysis (20 tests), Interview Prep (32 tests), and Prompt Injection Tests (998 tests)
- **[DOCUMENTATION.md](DOCUMENTATION.md)** — Full technical documentation: architecture, database schema, API routes, security, lib files, and change log

## Known Limitations & Future Work

- **Smarter question selection** — Use RAG similarity search for more relevant follow-up question selection
- **Mock interview prompt refinement** — Improve realism and difficulty scaling of mock interview sessions
- **Voice input via Whisper API** — Currently implemented; future work includes real-time streaming transcription
- **Version history on regenerate** — Currently supports version navigation; future work includes diff view between versions
- **Admin vs. user mode** — Add role-based access for coaches to review candidate progress
- **Language switching fix** — System prompts remain in German when UI switches to English; prompts need i18n support
- **Score display in header** — Show overall score prominently in the app header/sidebar for quick reference
- **Deployment (Phase 6)** — Production deployment to Vercel or similar platform

## Deployment Status

**Not deployed — runs locally.** The app is fully functional in local development. Phase 6 (Polish + Deploy) has not been started. The primary focus was on completing all core features, security hardening, and prompt testing. Deployment requires environment variable configuration and production Vercel setup. Database is already on Supabase PostgreSQL (cloud-hosted).
