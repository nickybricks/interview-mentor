# Todo

<!-- Current task plan. Add checkable items as you go. -->

- [x] Add `updateCoachingState` LangChain tool to persist preparation session progress
  - [x] Add `dimensions?` to `QuestionBankEntry`, `summary?`/`weakestDimension?` to `SessionEntry`, `chatId: string | null` in `coaching-state.ts` types
  - [x] Implement tool in `lib/tools.ts` — discriminated union on `action` field (`addQuestion` / `endSession`), read-modify-write via Prisma JSON
  - [x] Add to `interviewTools` export
  - [x] Bind in `route.ts`: add `mock_interview` to `TOOL_ENABLED_TYPES`, inject `projectId` for `update_coaching_state`
  - [x] `npm run build` passes

- [x] Instruct AI to use updateCoachingState tool in preparation sessions (prompts.ts E_structured_output)
  - [x] Add addQuestion and endSession rules to Tool Usage Rules section
  - [x] Add patterns note to Weak Area Tracking section
  - [x] Add endSession call to Rule 10 (session ending)
  - [x] Escape backticks inside template literal to fix parse error
  - [x] `npm run build` passes

- [x] Fix coaching behavior: mastery before moving on (prompts.ts E_structured_output)
  - [x] Add "Mastery Before Moving On" rule to Ongoing Coaching section
  - [x] Add scoring clarification to Score Source Rule
  - [x] Modify Score 5-7 block: remove "move on" option, require reattempt
  - [x] Reinforce Score 1-4: "another try" = full reattempt of original question
  - [x] Add "Coaching Exchanges vs. Scored Answers" section
  - [x] `npm run build` passes

- [x] Fix hallucinated date in save_linkedin_analysis tool
  - [x] Remove `date` from Zod schema — GPT no longer provides it
  - [x] Generate date server-side with `new Date().toISOString()` inside the tool handler
  - [x] Inject `CURRENT DATE (UTC)` into LinkedIn system prompt via `buildLinkedInPrompt`
  - [x] Inject `CURRENT DATE (UTC)` into all other system prompts in `route.ts` (`fullSystemPrompt` build)
  - [x] `npm run build` passes

- [x] Add "coming soon" LinkedIn card to project dashboard session grid
  - [x] Add i18n keys: `project.comingSoon`, `project.linkedinDesc`, `project.soon` (DE + EN)
  - [x] Add "Demnächst" / "Coming Soon" section heading below existing cards
  - [x] Add non-interactive LinkedIn card with 💼 emoji, muted styles, and "Bald"/"Soon" badge
  - [x] `npm run build` passes
