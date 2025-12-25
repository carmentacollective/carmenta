# Vercel AI SDK Stack Refactor Plan

## Context

We analyzed the AI SDK V6 agent paradigm (`ToolLoopAgent`,
`createAgentUIStreamResponse`) and decided **not to adopt it**. The higher-level
abstraction would lose functionality we depend on:

- **Prompt caching** - Anthropic's `cache_control: "ephemeral"` on system message layers
  (~90% cost reduction)
- **Dynamic model selection** - Concierge picks model per-request; agents bind at
  instantiation
- **Custom headers** - `X-Concierge-*`, `X-Connection-*`, `X-Context-Utilization-*` for
  client state
- **Transient status** - `onChunk` callbacks for "Searching knowledge base..." UX
- **Provider options** - OpenRouter fallback chains, reasoning token configs

Full analysis: `knowledge/vercel/ai-sdk.md`

## What We're Doing Instead

Improve the existing `streamText()` implementation without changing to agents. Clean up
code organization, extract reusable patterns, improve maintainability.

## The Refactor

### PR 1: Eval Restructure (Foundation) ✅ COMPLETE

Reorganized `evals/` folder for clarity. Files moved from flat to suite-based
organization:

```
evals/
├── routing/
│   ├── eval.ts
│   ├── cases.ts
│   └── scorer.ts
├── concierge/
│   ├── eval.ts
│   ├── cases.ts
│   ├── scorer.ts
│   └── runner.ts
├── attachments/
│   ├── eval.ts
│   ├── cases.ts
│   └── scorer.ts
├── competitive/
│   ├── eval.ts
│   ├── queries.ts
│   └── scorer.ts
├── shared/
│   ├── api-client.ts
│   ├── stream.ts
│   └── messages.ts
└── fixtures/
```

**Why:** Creates safety net before touching production code. Run evals before/after each
subsequent PR to catch regressions.

### PR 2: Tool & Helper Extraction

Extract inline code from the 1400-line route handler:

1. **Tools to `/lib/tools/`** - The 5 built-in tools (compareOptions, webSearch,
   fetchPage, deepResearch, searchKnowledge) are defined inline. Extract to dedicated
   files.

2. **Discovery tools** - Currently created inline when pending discoveries exist.
   Extract to `/lib/tools/discovery/`.

3. **Reasoning helper** - Lines 845-873 manually strip reasoning blocks before
   multi-turn API calls (workaround for Anthropic bug). Extract to
   `/lib/ai/messages.ts`.

4. **OpenRouter client** - Created in both `route.ts` and `concierge/index.ts`.
   Consolidate to single `/lib/ai/openrouter.ts`.

**Why:** Route handler should orchestrate, not define. Extracted code is testable in
isolation. Cleaner imports, easier to understand flow.

### PR 3: Middleware & Patterns

Introduce middleware pattern for cross-cutting concerns:

1. **Telemetry middleware** - Currently `experimental_telemetry` config inline. Extract
   to reusable middleware.

2. **Error handling middleware** - Sentry capture logic is inline with breadcrumbs
   scattered. Centralize.

3. **Transient writer cleanup** - Current pattern captures writer reference during
   `createUIMessageStream` execution for use in `onChunk`. Explore cleaner approaches.

**Why:** These concerns are repeated across route handlers. Middleware pattern makes
them composable and testable.

## Sequencing

```
PR 1 → verify evals pass → PR 2 → verify evals pass → PR 3 → verify evals pass
```

Each PR is a checkpoint. If evals regress, stop and investigate before proceeding.

## Eval Coverage Gaps to Address

Before PR 3 (the riskier pattern changes), consider adding:

| Gap                       | Purpose                                                           |
| ------------------------- | ----------------------------------------------------------------- |
| Tool output quality tests | Verify tools return useful content, not just that they're invoked |
| Transient status tests    | Verify "Searching..." messages appear during tool execution       |
| Error path tests          | Verify graceful degradation when things fail                      |

Current coverage is strong for routing decisions but thin on streaming UX and error
handling.

## Baseline

A baseline eval run was started on 2024-12-24. Check Braintrust dashboard for results,
or look for `BASELINE-2024-12-24.md` if the background task completed.

Run baseline before starting each PR:

```bash
pnpm braintrust eval evals/routing/eval.ts
pnpm braintrust eval evals/competitive/eval.ts
```

## Files to Study

- `/app/api/connection/route.ts` - The 1400-line route handler being refactored
- `/lib/concierge/index.ts` - Model routing logic
- `/lib/integrations/tools.ts` - Integration tool factory pattern (good reference)
- `/lib/streaming/transient-writer.ts` - Transient message utilities
- `knowledge/vercel/ai-sdk.md` - Full V6 analysis and decision rationale
