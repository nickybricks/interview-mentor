# Lessons Learned

<!-- Patterns and corrections log. Updated after any correction from the user. -->

## Prisma JSON fields require round-trip serialization for typed arrays

Prisma's `InputJsonValue` type doesn't accept typed arrays like `QuestionBankEntry[]` directly — TypeScript complains about a missing index signature. The fix is `JSON.parse(JSON.stringify({ ...existing, newArray: [...] }))` before passing to Prisma's `data.coachingState`. This is the same pattern already used in `saveCoachingProfile` and `saveLinkedInAnalysis`.

## Backticks inside template literals must be escaped

When adding prompt text that references tool names or argument names using backtick notation (e.g., \`addQuestion\`, \`endSession\`), those backticks must be escaped as \\\` inside a TypeScript template literal. Unescaped backticks terminate the template literal and cause a parse error at build time. This applies to all string content in `lib/prompts.ts` which uses a single top-level template literal per prompt.

## System prompt coaching behavior: distinguish coaching exchanges from scored answers

When coaching sessions felt scattered, the root cause was the prompt allowing `score_answer` on any response — including one-sentence clarifications. The fix required three reinforcing changes in the same prompt: (1) a "Mastery Before Moving On" rule in the session flow section, (2) an explicit "Only call score_answer for FULL answers" in the Score Source Rule, and (3) a dedicated "Coaching Exchanges vs. Scored Answers" section near the Tool Usage Rules. All three were needed — patching only one or two left the model room to rationalize the old behavior.

## Never let GPT generate timestamps — inject server-side

GPT has no access to real time and will hallucinate plausible-looking dates (e.g. `"2024-03-26T09:50:00Z"`). Any field that records *when* something happened (audit date, session date, etc.) must be generated server-side with `new Date().toISOString()` and removed from the tool's Zod schema so the model never provides it. Inject the current date into every system prompt (`CURRENT DATE (UTC): ...`) so the model can reason about relative time (e.g. "interview is tomorrow") without having to guess.

## i18n: both locales must be updated together

The `TranslationKey` type is derived from `typeof translations.de` and used as an index into both `de` and `en` sub-objects. Adding a key only to `de` causes a TS7053 error at the `t()` call site because the union type of both locale objects no longer includes the new key. Always add new keys to `de` and `en` in the same edit.
