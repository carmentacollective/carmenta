# Technology Architecture

**Last Updated**: November 2025
**Scope**: Base infrastructure for initial homepage with GitHub CTA
**Reference**: Based on mcp-hubby patterns, informed by competitor analysis

## Summary

The Carmenta tech stack for initial launch:

```
Framework:    Next.js 16 + React 19 + TypeScript 5.9
Styling:      Tailwind 4 + Radix + shadcn/ui
Tooling:      ESLint 9 + Prettier 3 + husky
Testing:      Vitest + Playwright
Validation:   Zod 4
Logging:      Pino
Deployment:   Render
```

This stack is deliberately similar to mcp-hubby with one upgrade: Tailwind 4.
Familiarity enables speed. Innovation happens at the product layer, not infrastructure.

### Installation Approach

When setting up, prefer scripted installers over writing config files from memory:

- Use `npx create-next-app@latest` for Next.js scaffold
- Use `npx shadcn@latest init` for shadcn/ui setup
- Use `npx playwright install` for browser binaries
- Use `pnpm create` variants where available

For packages with complex setup, fetch latest documentation from Context7 MCP server
before installing. This ensures we use current best practices rather than stale patterns.

---

## Decision Categories

- **(a) Obvious** - Industry standard, not debatable
- **(b) Confirmed** - Validated through dialogue
- **(d) Deferred** - Requires deep research for later phases

---

## Core Framework (Category A - Obvious)

These are industry standards for modern React applications. No debate needed.

| Choice | Version | Rationale |
|--------|---------|-----------|
| **Next.js** | 16.x | React framework standard. 7/10 competitors use it. App Router, RSC, streaming. |
| **React** | 19.x | Latest stable with concurrent features |
| **TypeScript** | 5.9+ | Type safety is table stakes |
| **pnpm** | 10.x | Fast, disk-efficient, workspace support. All competitors use pnpm. |
| **Node.js** | 22+ | LTS with native ESM, performance improvements |

### Why Next.js 16 over 15?

mcp-hubby runs 16.0.3. Vercel's ai-chatbot runs 15.3-canary. LobeChat runs 16.0.2-canary.
The ecosystem has moved to 16. We follow.

---

## Styling & UI (Category B - Confirmed)

| Choice | Version | Rationale |
|--------|---------|-----------|
| **Tailwind CSS** | 4.x | CSS-first config, native cascade layers. ai-chatbot reference. |
| **Radix UI** | latest | Accessible primitives. Universal choice across competitors. |
| **shadcn/ui** | latest | Copy-paste components, full ownership. Proven in mcp-hubby. |
| **lucide-react** | latest | Icon library. Used by mcp-hubby, ai-chatbot, lobe-chat. |
| **class-variance-authority** | latest | Component variant management. shadcn pattern. |
| **tailwind-merge** | latest | Intelligent class merging. shadcn pattern. |
| **clsx** | latest | Conditional class composition. Universal. |

### Tailwind 4 Migration Notes

Tailwind 4 uses CSS-first configuration instead of JS config. Key differences:
- `@theme` directive in CSS instead of `tailwind.config.js`
- Native CSS cascade layers
- Automatic content detection (no `content` array needed)
- Breaking: some class name changes, check migration guide

Reference: ai-chatbot uses `@tailwindcss/postcss` v4.1 with `@tailwindcss/typography`

---

## Validation & Type Safety (Category A - Obvious)

| Choice | Version | Rationale |
|--------|---------|-----------|
| **Zod** | 4.x | Universal standard. Used by mcp-hubby, ai-chatbot, lobe-chat. |
| **@t3-oss/env-nextjs** | latest | Type-safe environment variables. mcp-hubby pattern. |

Zod 4 is the latest major version. mcp-hubby uses `zod@4.1.12`.

---

## Linting & Formatting (Category B - Confirmed)

| Choice | Version | Rationale |
|--------|---------|-----------|
| **ESLint** | 9.x | Standard linter. Flat config format. |
| **Prettier** | 3.x | Standard formatter. |
| **prettier-plugin-tailwindcss** | latest | Auto-sort Tailwind classes. |
| **husky** | 9.x | Git hooks for pre-commit checks. |
| **lint-staged** | latest | Run linters on staged files only. |

### Why ESLint + Prettier over Biome?

Biome is faster (10-100x) but ESLint has:
- More mature plugin ecosystem
- Better Next.js integration via `eslint-config-next`
- Familiar workflow from mcp-hubby
- Can always migrate to Biome later (it's a two-way door)

### Pre-commit Hook Pattern (from mcp-hubby)

```json
"lint-staged": {
  "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
  "*.{json,md,css}": ["prettier --write"]
}
```

---

## Testing Foundation (Category B - Confirmed)

| Choice | Version | Rationale |
|--------|---------|-----------|
| **Vitest** | 3.x | Fast unit testing. Native ESM, TypeScript. |
| **@testing-library/react** | latest | Component testing utilities. |
| **Playwright** | 1.x | E2E testing. Cross-browser support. |
| **@vitest/coverage-v8** | latest | Coverage reporting. |

### Test Script Pattern (from mcp-hubby)

```json
"scripts": {
  "test": "vitest run",
  "test:watch": "vitest --watch",
  "test:coverage": "vitest run --coverage",
  "test:e2e": "playwright test",
  "test:e2e:ui": "playwright test --ui"
}
```

---

## Logging (Category B - Confirmed)

| Choice | Version | Rationale |
|--------|---------|-----------|
| **Pino** | 10.x | Structured JSON logging. Fast, low overhead. |
| **pino-pretty** | latest | Dev-friendly log formatting. |

Error tracking and analytics are handled in separate component specifications.

---

## Deployment Target (Category B - Confirmed)

| Choice | Rationale |
|--------|-----------|
| **Render** | mcp-hubby pattern. More control than Vercel. Docker support. |

### Render Configuration

- Auto-deploy from main branch
- Node.js 22 runtime
- Build command: `pnpm build`
- Start command: `pnpm start`

For initial homepage, static export is also an option (`output: 'export'` in next.config).

---

## Deferred Decisions (Category D - Deep)

These require deep research and are out of scope for initial homepage:

- **Chat UI primitives** - assistant-ui vs custom vs CopilotKit
- **Voice input** - OpenAI Realtime vs Whisper vs browser APIs
- **State management** - Zustand (LobeChat pattern) vs React Context vs other
- **Database** - PostgreSQL (Drizzle) vs PGLite for local-first
- **Authentication** - Clerk vs NextAuth vs custom
- **MCP integration** - Architecture patterns from LibreChat/LobeChat

---

## Reference Stack Comparison

| Category | mcp-hubby | ai-chatbot | lobe-chat |
|----------|-----------|------------|-----------|
| Framework | Next.js 16 | Next.js 15 canary | Next.js 16 canary |
| Package Manager | pnpm 10 | pnpm 9 | pnpm 10 |
| Styling | Tailwind 3 | Tailwind 4 | Ant Design + antd-style |
| Components | Radix + shadcn | Radix | Ant Design |
| Linting | ESLint 9 | Biome (ultracite) | ESLint 8 |
| Formatting | Prettier | Biome | Prettier |
| Testing | Vitest + Playwright | Playwright | Vitest + Playwright |
| Validation | Zod | Zod | Zod |
| Database | Drizzle + Postgres | Drizzle + Postgres | Drizzle + PGLite/Postgres |
| Observability | Sentry + Pino + PostHog | Vercel + OpenTelemetry | PostHog + Custom |
