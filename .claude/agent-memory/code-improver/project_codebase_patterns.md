---
name: Codebase Patterns & Architecture
description: Key patterns, conventions, and recurring issues found across interview-mentor codebase
type: project
---

Project is a Next.js 16 App Router app with LangChain, Prisma 7, Tailwind v4, shadcn/ui.

**Why:** Established during first full codebase review (2026-03-30). Use to orient future reviews.

**How to apply:** When reviewing any file, cross-check against these patterns before suggesting anything that contradicts them.

## Established patterns
- API routes use try/catch with NextResponse.json({ error }, { status }) — consistent
- All chat types: kickoff, preparation, mock_interview, gap_analysis, linkedin
- AI settings stored as singleton in DB (AiSettings table, id="singleton")
- i18n via flat translation map in lib/i18n-server.ts (de/en), client hook in lib/i18n.ts
- Streaming uses SSE (text/event-stream) with JSON events: { text }, { done }, { error }, { toolCall }, { sources }, { kickoff_complete }
- Tool-calling loop has a maxIterations=5 guard against infinite loops
- Sessions are identified only by sessionId (no auth/JWT) — single-tenant design
- Message scoring: tool-based (score_answer) preferred, regex fallback on fullResponse
- LinkedIn profile text stored in chat.metadata.profileText — sent as first user message auto-send

## Recurring issues found in this review
- No authentication on any API route — all routes are open if you know the sessionId
- ai-settings PUT route does no input validation (no type checking of body fields)
- Polling (setInterval) used for gap analysis result instead of webhooks/streaming
- LinkedInModal close button has no accessible aria-label
- fetchProject defined inside component but not wrapped in useCallback — ESLint exhaustive-deps would flag this
- scoreAnswer tool hardcodes gpt-4.1-mini model (not configurable)
- validateFileBuffer only checks filename extension, not magic bytes (PDF header %PDF-)
- Dynamic import of ToolMessage inside the tool execution loop (per-iteration dynamic import)
- No error boundary wrapping ChatWindow
- cat.avg displayed as integer "7/10" instead of "7.0/10" (inconsistent with overall score display)
