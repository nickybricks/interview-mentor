# LinkedIn Analyzer — Workflow

```mermaid
flowchart TD
    A["User clicks LinkedIn card<br/><i>Project Dashboard</i>"] --> B["Modal opens<br/>Pre-filled with paste template"]
    B --> C["User pastes profile text<br/>& selects depth level"]
    C --> D{"Click<br/>Start LinkedIn Audit"}

    D --> E["POST /api/chats<br/>type: linkedin<br/>metadata: { depthLevel, profileText }"]
    E --> F["Chat created in DB<br/>with metadata stored as JSON"]
    F --> G["Navigate to<br/>/project/:id/chat/:chatId"]

    G --> H["ChatWindow mounts<br/>GET /api/chats/:id"]
    H --> I{"linkedInAutoSend<br/>effect triggers"}
    I -->|"chat.metadata.profileText<br/>exists & no messages"| J["Auto-send profile text<br/>POST /api/messages"]

    J --> K["Messages API"]

    subgraph API["Messages API — Server"]
        K --> L["Build system prompt<br/>buildLinkedInPrompt()"]
        L --> M["Inject coaching context<br/>CV, target roles, strengths,<br/>concerns, gap areas"]
        M --> N["RAG retrieval<br/>Knowledge base search"]
        N --> O["Stream to LLM<br/>with linkedInTools bound"]
    end

    subgraph DEPTH["Depth-Dependent Audit Flow"]
        O --> P{"depthLevel?"}
        P -->|quick| Q["Audit: Headline, About, Skills<br/>Top 3 fixes only"]
        P -->|standard| R["Audit all 9 sections<br/>+ Content Strategy"]
        P -->|deep| S["Audit all 9 sections<br/>+ Consistency Check<br/>+ Content Strategy<br/>+ Challenge Protocol"]
    end

    subgraph TOOLS["Tool Calls — Server"]
        Q --> T["save_linkedin_analysis"]
        R --> T
        S --> T
        T --> U["Persist to<br/>project.coachingState<br/>.linkedInAnalysis"]
        O -.->|"optional"| V["search_knowledge_base"]
        V -.-> O
    end

    U --> W["Stream audit results<br/>back to ChatWindow"]
    W --> X["User reads audit<br/>& continues conversation"]

    subgraph SAVED["Saved Analysis Schema"]
        direction LR
        U --> Y["overallScore: Strong / Needs Work / Weak"]
        U --> Z["discoverability / credibility / differentiation"]
        U --> AA["topFixesPending: string[]"]
        U --> AB["consistencyScore (deep only)"]
    end

    style A fill:#3b82f6,color:#fff
    style D fill:#f59e0b,color:#000
    style F fill:#10b981,color:#fff
    style T fill:#8b5cf6,color:#fff
    style U fill:#10b981,color:#fff
    style DEPTH fill:#fefce8,stroke:#f59e0b
    style TOOLS fill:#f5f3ff,stroke:#8b5cf6
    style API fill:#eff6ff,stroke:#3b82f6
    style SAVED fill:#ecfdf5,stroke:#10b981
```

## Key Files

| Layer | File | Role |
|-------|------|------|
| UI — Modal | `app/project/[id]/page.tsx` | LinkedIn card, depth selector, profile textarea, `startLinkedInAudit()` |
| UI — Chat | `components/chat-window.tsx` | `linkedInAutoSend` effect auto-sends profile on mount |
| API — Chat creation | `app/api/chats/route.ts` | Creates chat with `metadata: { depthLevel, profileText }` |
| API — Messages | `app/api/messages/route.ts` | Routes linkedin chats to `buildLinkedInPrompt`, binds `linkedInTools` |
| Prompt builder | `lib/prompts.ts` | `buildLinkedInPrompt()` — injects coaching state + depth level into system prompt |
| Tools | `lib/tools.ts` | `saveLinkedInAnalysis` — persists audit results to `project.coachingState` |
| AI Settings | `lib/ai-settings.ts` | `linkedin` feature key — model, temperature, token config |
| Schema | `prisma/schema.prisma` | `Chat.metadata Json?` stores depth level & profile text |

## Depth Levels

| Level | Sections Audited | Content Strategy | Consistency Check | Challenge Protocol |
|-------|-----------------|------------------|-------------------|--------------------|
| Quick | Headline, About, Skills | No | No | No |
| Standard | All 9 | Yes (unless triage/focused timeline) | No | No |
| Deep | All 9 | Yes (unless triage/focused timeline) | Yes | Yes |
