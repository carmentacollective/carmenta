# Foundation

The technology stack and development environment. Everything else is built on this.

## Why This Exists

Every product needs a foundation. These choices determine how fast we can build, how
maintainable the code is, and how pleasant development feels day to day.

Good foundations are invisible - they just work. Bad foundations create friction at
every turn.

## Core Technologies

| Technology | Version | Why |
|------------|---------|-----|
| **Next.js** | 16 | App Router, React Server Components, Turbopack default |
| **React** | 19 | Server components, bundled with Next.js 16 |
| **TypeScript** | 5.9+ | Strict mode |
| **Node.js** | 24 LTS | "Krypton" - LTS through Apr 2028 |
| **pnpm** | 10.x | Fast, strict, workspace-ready |

## Styling

| Technology | Why |
|------------|-----|
| **Tailwind CSS** | Utility-first, fast iteration |
| **tailwind-merge** | Conflict-free class merging |
| **class-variance-authority** | Type-safe component variants |

## Data

| Technology | Why |
|------------|-----|
| **Drizzle ORM** | Type-safe, lightweight, SQL-like syntax |
| **Zod** | Runtime validation, TypeScript inference |
| **postgres** | PostgreSQL driver for Drizzle |

## Code Quality

| Technology | Why |
|------------|-----|
| **ESLint 9** | Flat config, modern rules |
| **Prettier** | Consistent formatting |
| **Husky** | Git hooks |
| **lint-staged** | Pre-commit checks on staged files |

## Environment Variables

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

## Installation

We use interactive install scripts rather than AI-generated boilerplate. This ensures
we're always on the latest stable versions.

### Project Initialization

```bash
cd /Users/nick/src/carmenta
pnpm create next-app@latest .
```

Prompts:
- TypeScript: Yes
- ESLint: Yes
- Tailwind CSS: Yes
- `src/` directory: Yes
- App Router: Yes
- Turbopack: Yes
- Import alias: @/*

### Additional Tooling

```bash
# Environment variables
pnpm add @t3-oss/env-nextjs zod

# Prettier
pnpm add -D prettier prettier-plugin-tailwindcss

# Git hooks
pnpm add -D husky lint-staged
pnpm exec husky init

# Data
pnpm add drizzle-orm postgres
pnpm add -D drizzle-kit

# Styling utilities
pnpm add class-variance-authority clsx tailwind-merge
```

## Project Structure

```
carmenta/
├── src/
│   ├── app/              # Next.js App Router
│   ├── components/       # React components
│   │   └── ui/           # Base UI components
│   ├── lib/              # Utilities and shared code
│   │   ├── db/           # Database client and schema
│   │   └── env.ts        # Environment variable definitions
│   └── styles/           # Global styles
├── knowledge/            # Product knowledge
├── public/               # Static assets
└── .cursor/              # AI assistant configuration
```

## Configuration

### package.json engines

```json
{
  "engines": {
    "node": ">=24.0.0",
    "pnpm": ">=10.0.0"
  },
  "packageManager": "pnpm@10.23.0"
}
```

### TypeScript

Strict mode with `noUncheckedIndexedAccess`.

### ESLint 9

Flat config (`eslint.config.mjs`) with Next.js recommended rules.

### Prettier

Uses `prettier-plugin-tailwindcss` for class sorting.

### Pre-commit Hooks

lint-staged runs ESLint fix and Prettier on staged files.

## Integration Points

- **Hosting**: Render expects Node.js 24, standalone build output
- **Data Storage**: Drizzle ORM connects to Render-managed Postgres

## Success Criteria

- `pnpm dev` starts in under 3 seconds (Turbopack)
- Type errors caught at compile time
- Consistent code style across all files
- New developers can start contributing within an hour
- Missing environment variables fail fast with clear errors

---

## Open Questions

### Architecture

- Monorepo: Do we need workspace structure later?

### Product Decisions

- Browser support: What's the minimum?

### UI Decisions (separate component needed)

- Component library: Radix UI? Headless UI? Custom?
- Icons: Lucide? Heroicons?
- Animation: Framer Motion? CSS transitions?
