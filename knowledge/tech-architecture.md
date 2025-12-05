# Technology Architecture

**Scope**: Base infrastructure for initial homepage with GitHub CTA **Reference**:
Informed by competitor analysis

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

This stack prioritizes proven patterns with one upgrade: Tailwind 4. Familiarity enables
speed. Innovation happens at the product layer, not infrastructure.

---

## Project Structure (Category B - Confirmed)

Flat structure without `src/` directory. Minimal nesting, maximum clarity.

```
carmenta/
├── app/              # Next.js App Router (routes only)
├── components/       # React components
│   └── ui/           # shadcn/ui base components
├── lib/              # Utilities, hooks, types, business logic
├── public/           # Static assets
├── knowledge/        # Product specifications (this folder)
├── platform/         # Platform-specific code (added later)
│   ├── electron/     # Desktop wrapper (M3+)
│   └── capacitor/    # Mobile wrapper (M4+)
└── [config files]
```

### Why This Structure

**No `src/` directory**: The `src/` convention is cargo-culted from compiled languages
where source/binary distinction matters. In web projects, it adds nesting without
semantic value. Next.js explicitly supports both patterns - we choose flat.

**`app/` for routes only**: Next.js App Router requires the `app/` directory. We keep it
focused on routing - pages, layouts, API routes. No colocated components or utilities.

**`components/` at root**: All React components live here. The `ui/` subfolder holds
shadcn/ui primitives. Feature components live alongside or in feature subfolders as
complexity grows.

**`lib/` for everything else**: Utilities, custom hooks, types, business logic. One
folder instead of scattered `hooks/`, `utils/`, `types/` directories. Subfolders emerge
when needed (e.g., `lib/db/` for database code).

**`platform/` for future expansion**: Empty now. When Electron (desktop) and Capacitor
(mobile) arrive, their platform-specific code goes here. Shared code stays in
`components/` and `lib/`.

### Platform Trajectory

Web app → PWA → Electron desktop → Capacitor mobile.

**Research findings** (November 2025):

1. **Capacitor constraint**: Requires `output: 'export'` (static HTML). No SSR in the
   Capacitor build. This is fundamental - Capacitor wraps a static web app in a native
   shell.

2. **Two viable patterns**:
   - _Single codebase_: One Next.js app, static export for all platforms. Simple but
     sacrifices SSR everywhere.
   - _Monorepo split_: Separate `apps/web` (SSR) and `apps/mobile` (static) sharing
     `packages/ui` and `packages/lib`. More complexity, preserves SSR for web.

3. **Our approach**: Start flat, evolve to monorepo when mobile arrives. The refactor is
   straightforward - move files and add a packages layer. No need to over-engineer for
   M0.

4. **Electron**: Can wrap Next.js directly in dev mode or the production build. No
   special structure needed until M3+.

**Decision**: Flat structure for M0-M3. Evaluate monorepo split when Capacitor
integration begins (M4+). This is a two-way door - we can refactor when the need is
real.

### References

- [Next.js Project Structure Docs](https://nextjs.org/docs/app/getting-started/project-structure)
- [nextjs-native-starter](https://github.com/RobSchilderr/nextjs-native-starter) -
  Turborepo monorepo example
- [nextjs-tailwind-ionic-capacitor-starter](https://github.com/mlynch/nextjs-tailwind-ionic-capacitor-starter) -
  Single codebase example
- [Capgo 2025 Guide](https://capgo.app/blog/building-a-native-mobile-app-with-nextjs-and-capacitor/) -
  Next.js 15 + Capacitor

### Installation Approach

When setting up, prefer scripted installers over writing config files from memory:

- Use `npx create-next-app@latest` for Next.js scaffold
- Use `npx shadcn@latest init` for shadcn/ui setup
- Use `npx playwright install` for browser binaries
- Use `bunx` or `bun create` variants where available

For packages with complex setup, fetch latest documentation from Context7 MCP server
before installing. This ensures we use current best practices rather than stale
patterns.

---

## Decision Categories

- **(a) Obvious** - Industry standard, not debatable
- **(b) Confirmed** - Validated through dialogue
- **(d) Deferred** - Requires deep research for later phases

---

## Core Framework (Category A - Obvious)

These are industry standards for modern React applications. No debate needed.

| Choice         | Version | Rationale                                                                      |
| -------------- | ------- | ------------------------------------------------------------------------------ |
| **Next.js**    | 16.x    | React framework standard. 7/10 competitors use it. App Router, RSC, streaming. |
| **React**      | 19.x    | Latest stable with concurrent features                                         |
| **TypeScript** | 5.9+    | Type safety is table stakes                                                    |
| **bun**        | 1.x     | Fast runtime and package manager. All-in-one tooling for TypeScript.           |
| **Node.js**    | 24+     | Latest with native ESM, performance improvements                               |

### Why Next.js 16 over 15?

Vercel's ai-chatbot runs 15.3-canary. LobeChat runs 16.0.2-canary. The ecosystem has
moved to 16. We follow.

---

## Styling & UI (Category B - Confirmed)

| Choice                       | Version | Rationale                                                      |
| ---------------------------- | ------- | -------------------------------------------------------------- |
| **Tailwind CSS**             | 4.x     | CSS-first config, native cascade layers. ai-chatbot reference. |
| **Radix UI**                 | latest  | Accessible primitives. Universal choice across competitors.    |
| **shadcn/ui**                | latest  | Copy-paste components, full ownership. Proven in production.   |
| **lucide-react**             | latest  | Icon library. Used by ai-chatbot, lobe-chat.                   |
| **class-variance-authority** | latest  | Component variant management. shadcn pattern.                  |
| **tailwind-merge**           | latest  | Intelligent class merging. shadcn pattern.                     |
| **clsx**                     | latest  | Conditional class composition. Universal.                      |

### Tailwind 4 Migration Notes

Tailwind 4 uses CSS-first configuration instead of JS config. Key differences:

- `@theme` directive in CSS instead of `tailwind.config.js`
- Native CSS cascade layers
- Automatic content detection (no `content` array needed)
- Breaking: some class name changes, check migration guide

Reference: ai-chatbot uses `@tailwindcss/postcss` v4.1 with `@tailwindcss/typography`

---

## Validation & Type Safety (Category A - Obvious)

| Choice                 | Version | Rationale                                          |
| ---------------------- | ------- | -------------------------------------------------- |
| **Zod**                | 4.x     | Universal standard. Used by ai-chatbot, lobe-chat. |
| **@t3-oss/env-nextjs** | latest  | Type-safe environment variables. Common pattern.   |

Zod 4 is the latest major version.

### Environment Variable Pattern

Type-safe environment variable management using `@t3-oss/env-nextjs` with Zod.

Variables are optional at import time to support tests, CI, and partial environments.
Validation happens at point of use with `assertEnv()`. Critical variables validated at
production startup in `instrumentation.ts` via `validateProductionEnv()`.

Benefits:

- Type-safe access with autocomplete
- Lazy validation - optional at import, validated when needed
- Production fail-fast - missing critical vars caught at startup
- Test-friendly - `skipValidation` allows tests without full env
- Client/server separation enforced by schema

---

## Linting & Formatting (Category B - Confirmed)

| Choice                          | Version | Rationale                            |
| ------------------------------- | ------- | ------------------------------------ |
| **ESLint**                      | 9.x     | Standard linter. Flat config format. |
| **Prettier**                    | 3.x     | Standard formatter.                  |
| **prettier-plugin-tailwindcss** | latest  | Auto-sort Tailwind classes.          |
| **husky**                       | 9.x     | Git hooks for pre-commit checks.     |
| **lint-staged**                 | latest  | Run linters on staged files only.    |

### Why ESLint + Prettier over Biome?

Biome is faster (10-100x) but ESLint has:

- More mature plugin ecosystem
- Better Next.js integration via `eslint-config-next`
- Can always migrate to Biome later (it's a two-way door)

### Pre-commit Hook Pattern

```json
"lint-staged": {
  "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
  "*.{json,md,css}": ["prettier --write"]
}
```

---

## Testing Foundation (Category B - Confirmed)

| Choice                     | Version | Rationale                                  |
| -------------------------- | ------- | ------------------------------------------ |
| **Vitest**                 | 3.x     | Fast unit testing. Native ESM, TypeScript. |
| **@testing-library/react** | latest  | Component testing utilities.               |
| **Playwright**             | 1.x     | E2E testing. Cross-browser support.        |
| **@vitest/coverage-v8**    | latest  | Coverage reporting.                        |

### Test Script Pattern

```json
"scripts": {
  "test": "vitest run",
  "test:coverage": "vitest run --coverage",
  "test:e2e": "playwright test",
  "test:e2e:ui": "playwright test --ui"
}
```

---

## Logging (Category B - Confirmed)

| Choice          | Version | Rationale                                    |
| --------------- | ------- | -------------------------------------------- |
| **Pino**        | 10.x    | Structured JSON logging. Fast, low overhead. |
| **pino-pretty** | latest  | Dev-friendly log formatting.                 |

Error tracking and analytics are handled in separate component specifications.

---

## Deployment Target (Category B - Confirmed)

| Choice     | Rationale                                 |
| ---------- | ----------------------------------------- |
| **Render** | More control than Vercel. Docker support. |

### Render Configuration

- Auto-deploy from main branch
- Node.js 24 runtime
- Build command: `bun build`
- Start command: `bun start`

For initial homepage, static export is also an option (`output: 'export'` in
next.config).

---

## Data Layer (Category B - Confirmed)

| Choice          | Version | Rationale                                         |
| --------------- | ------- | ------------------------------------------------- |
| **Drizzle ORM** | latest  | Type-safe, lightweight, SQL-like syntax.          |
| **postgres**    | latest  | PostgreSQL driver for Drizzle. Render-compatible. |

Drizzle provides type-safe database access with minimal abstraction over SQL. Pairs with
Render-managed PostgreSQL for production.

---

## AI/LLM Layer (Category B - Confirmed)

| Choice                          | Version | Rationale                                             |
| ------------------------------- | ------- | ----------------------------------------------------- |
| **Vercel AI SDK**               | 5.x     | Streaming, hooks, transport layer. Industry standard. |
| **@openrouter/ai-sdk-provider** | latest  | OpenRouter integration for multi-model access.        |

### Chat Architecture: Backend-First with SSE

Carmenta uses a backend-first architecture where the database is the source of truth and
the frontend renders from server state. This enables multi-tab support, background
tasks, and conversation recovery.

**Streaming pattern**: Server-Sent Events (SSE) via Vercel AI SDK's
`toDataStreamResponse()`. SSE provides:

- Simpler protocol than WebSocket (HTTP-based, auto-reconnect)
- Sufficient for server→client streaming
- Native AI SDK support
- Serverless-friendly

**Multi-tab synchronization**: BroadcastChannel API broadcasts message updates across
tabs. All tabs maintain SSE connections to backend and display the same server state.

**State ownership**: PostgreSQL owns conversation history. Backend streams to frontend.
Frontend displays messages using simple React state.

See
[decisions/chat-architecture-backend-first.md](./decisions/chat-architecture-backend-first.md)
for full rationale.

### Why OpenRouter?

OpenRouter is a unified API gateway providing access to 300+ models from all major
providers (Anthropic, OpenAI, Google, Meta, Mistral, etc.) through a single API key.

Benefits:

- **Model flexibility**: Switch models without managing multiple API keys
- **Cost optimization**: Transparent per-token pricing, compare across providers
- **Fallback capability**: Route to alternative providers if one is unavailable
- **New model access**: Immediate availability when providers release new models
- **Unified billing**: One dashboard for all model usage

For model selection logic, see
[model-intelligence.md](./components/model-intelligence.md).

---

## Deferred Decisions (Category D - Deep)

These require deep research and are out of scope for initial homepage:

- **Voice input** - OpenAI Realtime vs Whisper vs browser APIs
- **Local-first database** - PGLite for offline support (complementing PostgreSQL)
- **Authentication** - Clerk vs NextAuth vs custom
- **MCP integration** - Architecture patterns from LibreChat/LobeChat

---

## Reference Stack Comparison

| Category        | ai-chatbot             | lobe-chat                 |
| --------------- | ---------------------- | ------------------------- |
| Framework       | Next.js 15 canary      | Next.js 16 canary         |
| Package Manager | pnpm 9                 | pnpm 10                   |
| Styling         | Tailwind 4             | Ant Design + antd-style   |
| Components      | Radix                  | Ant Design                |
| Linting         | Biome (ultracite)      | ESLint 8                  |
| Formatting      | Biome                  | Prettier                  |
| Testing         | Playwright             | Vitest + Playwright       |
| Validation      | Zod                    | Zod                       |
| Database        | Drizzle + Postgres     | Drizzle + PGLite/Postgres |
| Observability   | Vercel + OpenTelemetry | PostHog + Custom          |
