# CLAUDE.md — Session Rules for Interview Mentor

> This file is read by Claude at the start of every session. Follow all instructions below.

---

## Project Overview

- **App**: Interview Mentor — AI-powered interview coach (Next.js 16 + TypeScript)
- **Repo**: `https://github.com/nickybricks/interview-mentor.git` (remote: `github`)
- **Current version**: Check `package.json` `"version"` field for the latest
- **Documentation**: See `README.md` for architecture, database, API routes, security, and RAG pipeline

---

## Session Start Checklist

1. Read this file (`CLAUDE.md`)
2. Check `README.md` for project architecture and current state
3. Check `package.json` version to know the current release

---

## Git Push & Release Workflow

When asked to push to GitHub, follow this exact process:

### 1. Version Bump (Semantic Versioning)

Determine the version bump based on scope of changes:

| Change Type | Bump | Example |
|---|---|---|
| Bug fixes, typos, minor tweaks | **Patch** (`0.2.0` → `0.2.1`) | Fix a broken API route |
| New features, significant additions | **Minor** (`0.2.0` → `0.3.0`) | Add a new phase or feature |
| Breaking changes, major rewrites | **Major** (`0.2.0` → `1.0.0`) | Complete architecture change |

- Update `"version"` in `package.json`

### 2. Update README.md

Before pushing, ensure `README.md` reflects:
- Any new features or changes
- Updated tech stack if dependencies changed
- Updated setup instructions if env vars or steps changed

### 3. Commit & Tag

```bash
# Stage all relevant files
git add -A

# Commit with version in message
git commit -m "v{VERSION}: {Brief description of changes}"

# Create a git tag
git tag v{VERSION}
```

### 4. Push

```bash
# Push to the specified remote (ask which one if not specified)
git push {remote} main --tags
```

- Default remote is `github`
- Always push tags with `--tags`

---

## Code Conventions

- **Framework**: Next.js 16 App Router (all routes under `app/`)
- **AI Layer**: LangChain (`@langchain/openai`, `@langchain/core`) — do NOT use raw OpenAI SDK for chat
- **Database**: Prisma 7 + Supabase PostgreSQL (schema in `prisma/schema.prisma`)
- **Styling**: Tailwind CSS v4 + shadcn/ui components
- **Components**: Reusable UI in `components/`, app-specific in `app/` route folders
- **Lib files**: Core logic in `lib/` (AI chains, database helpers, utils)

---

## File Structure Quick Reference

```
interview-mentor/
├── app/              # Next.js App Router pages & API routes
├── components/       # Reusable UI components (shadcn/ui based)
├── lib/              # Core logic (AI, DB, utils)
├── prisma/           # Database schema & migrations
├── docs/             # Additional documentation
├── public/           # Static assets
├── README.md         # Project documentation (keep updated on push!)
└── ai-settings.json  # AI model configuration
```

---

## Important Reminders

- Never commit `.env` or `.env.local` files
- Run `npx prisma generate` after schema changes
- The app uses `pdf-parse` v2 for CV parsing
- Mock interviews unlock at score >= 7.0
- Always check if `npm run build` succeeds before pushing
