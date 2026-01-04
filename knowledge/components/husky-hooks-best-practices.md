# Git Hooks Best Practices

Modern git hooks configuration for maintaining code quality at commit time. Prevents
broken code from entering the repository while keeping developers in flow. This spec
covers hook management tools, performance optimization, and production-ready workflows.

## Why This Exists

Git hooks automate quality checks before code enters version control. They catch issues
immediately—missing types, linting errors, broken tests—when fixing them is fastest and
context is fresh. This prevents the "green commit, broken build" cycle that fragments
attention.

The alternative is discovering issues minutes later in CI, or worse, hours later when
another developer pulls the changes. Early feedback keeps us in flow state.
Well-configured hooks feel invisible until they save you from committing something
broken.

This is distinct from CI/CD (which handles comprehensive testing and deployment) and
from IDE linting (which provides real-time feedback while coding). Hooks are the final
quality gate before code becomes permanent history.

## Current Landscape (2026)

### Hook Management Tools

Three primary approaches dominate:

**Husky (v9)** - Most popular, 20M+ weekly downloads. JavaScript-based, 2kB footprint
with zero dependencies. Simple setup with `husky init`, manual hook file creation,
automatic CI detection. Uses `.husky/` directory for hook scripts.
[Husky Official Site](https://typicode.github.io/husky/),
[GitHub](https://github.com/typicode/husky),
[Husky v9 Guide](https://itenium.be/blog/dev-setup/git-hooks-with-husky-v9/)

**Lefthook** - Go-based alternative optimized for performance. Runs hooks in parallel by
default, 2x faster than Husky with 142x+ smaller footprint (47kB). YAML configuration,
excellent monorepo support, built-in caching. Used by leading Next.js boilerplates.
[Lefthook Benefits](https://dev.to/quave/lefthook-benefits-vs-husky-and-how-to-use-30je),
[Performance Comparison](https://npm-compare.com/husky,lefthook,lint-staged,pre-commit)

**simple-git-hooks** - Minimal alternative (262K weekly downloads). Single command per
hook, manual application of changes. Best for small projects that set hooks once and
forget. Better Yarn 2 support than Husky.
[simple-git-hooks GitHub](https://github.com/toplenboren/simple-git-hooks),
[Migration Discussion](https://dev.to/acro5piano/i-ve-replaced-husky-with-simple-git-hooks-2543)

**pre-commit (Python)** - Framework with built-in caching to `~/.cache/pre-commit`.
Assumes immutable refs (tags/SHAs) for cache keys. Popular in polyglot environments.
Strong community plugin ecosystem. [pre-commit.com](https://pre-commit.com/),
[Performance Guide](https://medium.com/uleap/git-pre-commit-part-2-the-framework-c825847eaa92)

### File Processing Tools

**lint-staged** - Runs commands only on staged files. 20M+ weekly downloads, standard in
JavaScript ecosystem. Supports glob patterns, parallel execution, automatic staging of
fixes. Performance boost by limiting scope.
[lint-staged GitHub](https://github.com/lint-staged/lint-staged),
[Configuration Guide](https://betterstack.com/community/guides/scaling-nodejs/husky-and-lint-staged/)

**nano-staged** - Lightweight alternative to lint-staged. 2x faster, 100x smaller (47kB
vs ~6.7MB), single dependency. Best for performance-critical workflows.
[nano-staged GitHub](https://github.com/usmanyunusov/nano-staged),
[Comparison](https://debricked.com/select/compare/npm-stylelint-prettier-vs-npm-lint-staged-vs-npm-nano-staged)

### Commit Message Enforcement

**commitlint** - Validates commit messages against conventional commits spec. Integrates
with Husky/Lefthook via `commit-msg` hook. Prevents commits with invalid message format.
[commitlint Guide](https://commitlint.js.org/guides/local-setup.html),
[Setup with Husky](https://theodorusclarence.com/shorts/husky-commitlint-prettier)

**commitizen** - Interactive commit message builder. Prompts for type, scope, subject,
body. Ensures properly formatted conventional commits. Often paired with commitlint for
validation.
[Commitizen Setup](https://www.codu.co/articles/enforcing-conventional-commit-messages-using-git-hooks-with-husky-commitlint-hgcazwml)

**gitmoji** - Emoji-based commit types (✨ feat, 🐛 fix, etc.). Multiple integrations
available: `commitizen-emoji`, `cz-conventional-gitmoji`, `commitlint-config-gitmoji`.
Makes commit history more scannable.
[Gitmoji Integration Guide](https://medium.com/@jebarpg/setting-up-gitmoji-in-commitizen-commitlint-conventional-changelog-and-semantic-release-with-ace3ac7cc850),
[gitmoji.dev](https://gitmoji.dev)

## What Leaders Do

Analysis of production repositories reveals consistent patterns:

### Vercel Turborepo Pattern

[Turborepo package.json](https://github.com/vercel/turborepo)

```json
{
  "scripts": {
    "prepare": "husky install"
  },
  "devDependencies": {
    "husky": "8.0.3",
    "lint-staged": "13.1.0"
  },
  "lint-staged": {
    "*.{js,jsx,ts,tsx}": ["prettier --write"],
    "*.{md,mdx,mjs,yml,yaml,css}": ["prettier --write"],
    "*.toml": ["taplo format"],
    "*.rs": ["bash -c 'cargo fmt'"]
  }
}
```

`.husky/pre-commit`:

```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

pnpm exec lint-staged
```

**Pattern**: Simple, focused on formatting only. No linting or type checking in hooks
(reserved for CI). Supports multiple languages (JS, Rust, TOML). Uses pnpm for monorepo
compatibility.

### Next.js Production Boilerplate Pattern

[Next.js Boilerplate by ixartz](https://github.com/ixartz/Next-js-Boilerplate) - 20K+
stars, production-ready template

Migrated from Husky to **Lefthook** for performance. Configuration in `lefthook.yml`:

```yaml
# Validate commit messages
commit-msg:
  commands:
    commitlint:
      run: npx --no -- commitlint --edit {1}

# Validate content before committing
pre-commit:
  commands:
    lint:
      glob: "*"
      run: npx --no -- eslint --fix --no-warn-ignored {staged_files}
      stage_fixed: true
      priority: 1
    check-types:
      glob: "*.{ts,tsx}"
      run: npm run check:types
      priority: 2
```

**Pattern**: Parallel execution with priority ordering. Auto-stage fixes
(`stage_fixed: true`). Full TypeScript checking (`tsc --noEmit`). Commit message
validation. Uses `npx --no` to skip package installation prompts.

### Common Production Workflows

**Pre-commit hooks typically run:**

- Code formatting (Prettier, Biome) with auto-fix
- Linting (ESLint) on staged files only
- Type checking (incremental when possible)
- Import sorting, unused import removal

**Pre-push hooks handle:**

- Integration tests
- Build verification
- Security scanning
- Branch protection (prevent direct push to main)

**Commit-msg hooks enforce:**

- Conventional commit format
- Message length limits
- Issue tracker references
- Emoji conventions (when using gitmoji)

[Pre-push Best Practices](https://dev.to/jameson/pre-push-hooks-42g5),
[Hook Strategy Guide](https://www.shakacode.com/blog/maximizing-code-quality-with-rails-pre-commit-and-pre-push-hooks/)

## Performance Optimization

Speed is critical—slow hooks disrupt flow and encourage `--no-verify` bypasses.

### Scope Limitation

Run checks only on staged files, not entire codebase. lint-staged and nano-staged handle
this automatically. For monorepos, scope to affected packages using workspace filters.

### Incremental Type Checking

TypeScript 4.0+ supports `--incremental` with `--noEmit`. Caches type information
between runs. One team reduced type checking from 50s to 7s using incremental builds.
[TypeScript Incremental Setup](https://dev.to/samueldjones/run-a-typescript-type-check-in-your-pre-commit-hook-using-lint-staged-husky-30id),
[Performance Case Study](https://thoughtspile.github.io/2021/06/14/faster-pre-commit/)

**Important caveat**: Type checking only staged files is risky—changing types in one
file can break another unstaged file. Better to run full incremental type check.

### Parallel Execution

Lefthook runs hooks in parallel by default. With Husky/lint-staged, use task runners
like `npm-run-all` with `--parallel` flag for independent checks.

### Caching Strategies

- pre-commit framework caches to `~/.cache/pre-commit` based on immutable refs
- TypeScript's `--incremental` creates `.tsbuildinfo` cache files
- ESLint's `--cache` flag caches lint results between runs
- Turbo/Nx can cache hook outputs in monorepos

### Skip in CI

Hooks are for local development. CI runs its own comprehensive checks. Always skip hook
installation in CI:

```bash
# Modern Husky (v6+)
HUSKY=0 npm ci

# Older versions
HUSKY_SKIP_INSTALL=1 npm ci
```

Detect CI automatically:

```javascript
if (process.env.CI === "true" || process.env.NODE_ENV === "production") {
  process.exit(0);
}
```

[CI Skip Patterns](https://typicode.github.io/husky/how-to.html),
[Environment Variables](https://lightrun.com/answers/typicode-husky-skip-installing-hooks-on-ci)

## Integration Patterns

### Next.js + TypeScript + pnpm (Carmenta's Stack)

**Option 1: Husky + lint-staged (Traditional)**

```json
{
  "scripts": {
    "prepare": "husky install",
    "lint": "eslint .",
    "format": "prettier --write .",
    "type-check": "tsc --noEmit --incremental"
  },
  "devDependencies": {
    "@commitlint/cli": "^20.1.0",
    "@commitlint/config-conventional": "^20.0.0",
    "husky": "^9.0.0",
    "lint-staged": "^15.0.0"
  },
  "lint-staged": {
    "*.{js,jsx,ts,tsx}": ["eslint --fix --max-warnings=0", "prettier --write"],
    "*.{json,md,mdx,css,yml,yaml}": ["prettier --write"]
  }
}
```

`.husky/pre-commit`:

```bash
#!/usr/bin/env sh
pnpm exec lint-staged
```

`.husky/commit-msg`:

```bash
#!/usr/bin/env sh
npx --no -- commitlint --edit "$1"
```

`.husky/pre-push`:

```bash
#!/usr/bin/env sh
pnpm run type-check
pnpm run test
```

**Option 2: Lefthook (Performance-Optimized)**

```yaml
# lefthook.yml
commit-msg:
  commands:
    commitlint:
      run: npx --no -- commitlint --edit {1}

pre-commit:
  parallel: true
  commands:
    format:
      glob: "*.{js,jsx,ts,tsx,json,md,mdx,css,yml,yaml}"
      run: prettier --write {staged_files}
      stage_fixed: true
    lint:
      glob: "*.{js,jsx,ts,tsx}"
      run: eslint --fix --max-warnings=0 {staged_files}
      stage_fixed: true

pre-push:
  commands:
    type-check:
      run: tsc --noEmit --incremental
    test:
      run: pnpm run test
```

Install: `pnpm add -D lefthook && npx lefthook install`

### Monorepo Considerations

In pnpm workspaces, hooks live at repository root. Use workspace filters to scope
commands:

```json
{
  "scripts": {
    "lint:web": "pnpm --filter web run lint",
    "lint:api": "pnpm --filter api run lint"
  }
}
```

Ensure `.git` is at root. Hook scripts reference correct paths. Be careful with how
pnpm/yarn lay out `node_modules` in workspaces.
[Monorepo Setup Guide](https://dev.to/mimafogeus2/enforce-git-hooks-in-monorepos-with-husky-but-how-3fma),
[pnpm Workspace Patterns](https://medium.com/@syedzainullahqazi/setting-up-husky-to-run-lint-and-typecheck-on-entire-monorepo-5ce0c5a37556)

### commitlint Configuration

`commitlint.config.js`:

```javascript
module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [
      2,
      "always",
      [
        "feat",
        "fix",
        "docs",
        "style",
        "refactor",
        "perf",
        "test",
        "build",
        "ci",
        "chore",
        "revert",
      ],
    ],
    "subject-case": [2, "never", ["upper-case"]],
    "header-max-length": [2, "always", 100],
  },
};
```

For gitmoji integration, use `commitlint-config-gitmoji`:

```javascript
module.exports = {
  extends: ["gitmoji"],
  rules: {
    "header-max-length": [2, "always", 100],
  },
};
```

## Pre-commit vs CI Strategy

**The Principle**: Fast local feedback for quick checks, comprehensive CI for everything
else. Avoid exact duplication—wasted compute and slower commits.

### What Runs Where

**Pre-commit (< 5 seconds):**

- Format staged files (Prettier/Biome)
- Lint staged files (ESLint with auto-fix)
- Staged file validation (no console.log, no debugger)

**Pre-push (< 30 seconds):**

- Incremental type checking (full project, not just staged)
- Unit tests (fast tests only, or affected tests)
- Build verification (ensure `next build` succeeds)

**CI/CD (comprehensive):**

- Full type checking (no incremental cache)
- Full test suite (including E2E)
- Security scanning (Snyk, CodeQL)
- Bundle size analysis
- Deployment preview (Vercel, Netlify)
- Performance testing

**Why not run everything locally?** CI provides a clean environment, catches
environment-specific issues, enforces checks even when hooks are bypassed, and runs on
every PR regardless of developer setup.
[CI/CD Strategy Guide](https://kinsta.com/blog/git-hooks/),
[Pre-push Patterns](https://www.slingacademy.com/article/git-pre-push-hook-a-practical-guide-with-examples/)

## Future Direction

### Emerging Patterns (6-12 months)

**AI-Powered Code Quality**: Tools like GitHub Copilot and Cursor are adding pre-commit
suggestions—automated refactoring, security fixes, performance improvements. Expect
hooks that run LLM-based checks: "Does this change introduce a security vulnerability?"
"Is this change well-documented?"

**Semantic Validation**: Beyond syntax checking, semantic analysis of changes. "This
modifies a public API—did you update documentation?" "This changes authentication
logic—are there corresponding test updates?"

**Progressive Hook Strictness**: Hooks that adapt based on branch. Stricter checks for
`main`, relaxed for feature branches. Automated by detecting branch patterns.

**Distributed Caching**: Turborepo/Nx-style remote caching for hook results. If another
developer already ran hooks on this exact commit, reuse their results. Requires
deterministic hook execution.

**Native Git Hook Management**: Git 2.9+ supports `core.hooksPath` for local hooks
without external tools. Expect more projects to drop Husky/Lefthook for zero-dependency
native hooks.
[Native Hooks Discussion](https://dev.to/azu/git-hooks-without-extra-dependencies-like-husky-in-node-js-project-jjp)

### Becoming Possible

**Real-time Type Checking During Commit**: TypeScript Language Server integration that
runs incrementally as files are staged. Zero perceptible delay—type errors surface
before `git commit` even runs.

**Visual Hook Status**: IDE extensions showing hook execution in real-time. Progress
bars, per-check status, instant failure feedback. Hooks feel less like a black box.

**Selective Hook Bypass with Justification**: Instead of `--no-verify` (bypasses all
hooks), granular bypass:
`git commit --skip-typecheck --reason="WIP, types fixed in next commit"`. Logged for
audit.

**Hook Execution Tracing**: Built-in observability for why hooks are slow. "ESLint took
3.2s on 47 files, type check took 1.8s." Automatic suggestions: "Consider incremental
type checking."

## Gap Assessment

### Achievable Now (2026)

- Husky v9 or Lefthook with lint-staged/nano-staged
- Commitlint with conventional commits or gitmoji
- Incremental TypeScript checking
- Parallel hook execution
- Automatic CI detection and hook skipping
- Monorepo support with workspace filters
- Caching for repeated hook runs

### Emerging (6-12 months)

- AI-powered semantic validation in hooks
- Distributed hook result caching (Nx/Turbo Cloud)
- Progressive strictness based on branch/context
- Native Git hook management (zero dependencies)
- Real-time IDE integration showing hook status

### Aspirational (Requires Breakthroughs)

- Zero-latency type checking during staging
- Intelligent hook bypass with audit trail
- Self-optimizing hooks based on codebase analysis
- Collaborative hook result sharing across teams

## Success Criteria

- Hooks complete in < 5 seconds for typical commit (< 50 files)
- Developers never need `--no-verify` for legitimate commits
- Zero broken commits reach CI (hooks catch issues first)
- Hook failures provide actionable error messages with fix suggestions
- New contributors onboard without hook configuration friction
- Hooks auto-disable in CI without manual environment variable setting
- Type safety throughout—no `any` types in hook scripts

## Architecture Decisions

### Tool Selection for Carmenta

**Recommendation: Lefthook**

Rationale:

- 2x faster than Husky with parallel execution by default
- YAML configuration more readable than bash scripts
- Growing adoption in modern Next.js projects (see ixartz boilerplate)
- Better monorepo support out of the box
- Smaller footprint (47kB vs Husky's larger ecosystem)

Migration from no hooks is simple:

1. `pnpm add -D lefthook`
2. Create `lefthook.yml` at repository root
3. `npx lefthook install`
4. Add to `.gitignore`: `.lefthook/` (local overrides)

**Alternative: Husky v9** if we prioritize:

- Ecosystem familiarity (more Stack Overflow answers)
- Proven stability (20M+ weekly downloads)
- Simpler mental model (just bash scripts)

### Scope of Pre-commit Checks

**Run locally:**

- Prettier formatting (auto-fix, stage changes)
- ESLint on staged files (auto-fix, stage changes)
- No `console.log` or `debugger` in staged files

**Skip locally, run in CI:**

- Full test suite (too slow for commit flow)
- E2E tests (require dev server, database)
- Bundle size analysis (requires full build)
- Security scanning (comprehensive, slow)

**Run in pre-push:**

- Incremental TypeScript type check (full project)
- Fast unit tests (< 30s total)
- Build verification (`next build --dry-run` if available)

This balances fast feedback with comprehensive validation.

### Commit Message Format

Use conventional commits with optional gitmoji for visual scanning:

```
✨ feat(chat): add streaming response indicators

🐛 fix(auth): handle expired session redirect

📝 docs: update deployment guide for Vercel
```

Enforce with commitlint. Format is familiar to AI coding assistants (easier to parse),
compatible with semantic-release for automated versioning, and makes git log highly
scannable.

## Implementation Examples

### Lefthook Configuration for Carmenta

`lefthook.yml`:

```yaml
# Validate commit messages
commit-msg:
  commands:
    commitlint:
      run: npx --no -- commitlint --edit {1}

# Fast quality checks on staged files
pre-commit:
  parallel: true
  commands:
    format:
      glob: "*.{js,jsx,ts,tsx,json,md,mdx,css}"
      run: prettier --write {staged_files}
      stage_fixed: true
      priority: 1
    lint:
      glob: "*.{js,jsx,ts,tsx}"
      run: eslint --fix --max-warnings=0 {staged_files}
      stage_fixed: true
      priority: 2
    no-console:
      glob: "*.{js,jsx,ts,tsx}"
      run: |
        if grep -rn "console\\.log" {staged_files} 2>/dev/null; then
          echo "❌ Found console.log in staged files. Remove before committing."
          exit 1
        fi
      priority: 3

# Comprehensive checks before pushing
pre-push:
  commands:
    type-check:
      run: pnpm run type-check
    test:
      run: pnpm run test --run
    build-check:
      run: pnpm run build
```

### Package Scripts

`package.json`:

```json
{
  "scripts": {
    "prepare": "lefthook install || true",
    "type-check": "tsc --noEmit --incremental",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "test": "vitest",
    "build": "next build"
  },
  "devDependencies": {
    "@commitlint/cli": "^20.1.0",
    "@commitlint/config-conventional": "^20.0.0",
    "lefthook": "^2.0.7",
    "prettier": "^3.0.0",
    "eslint": "^9.0.0",
    "typescript": "^5.0.0"
  }
}
```

Note the `|| true` in prepare script—prevents install failures in CI when `LEFTHOOK=0`
is set.

### commitlint Configuration

`commitlint.config.js`:

```javascript
module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    // Allow gitmoji at start of subject
    "subject-case": [0],
    "header-max-length": [2, "always", 100],
    "type-enum": [
      2,
      "always",
      [
        "feat", // ✨ New feature
        "fix", // 🐛 Bug fix
        "docs", // 📝 Documentation
        "style", // 💄 Code style (formatting, etc.)
        "refactor", // ♻️  Code refactoring
        "perf", // ⚡ Performance improvement
        "test", // ✅ Tests
        "build", // 🔧 Build system
        "ci", // 👷 CI/CD
        "chore", // 🔨 Maintenance
        "revert", // ⏪ Revert commit
      ],
    ],
  },
};
```

### TypeScript Incremental Type Checking

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "incremental": true,
    "tsBuildInfoFile": ".tsbuildinfo",
    "noEmit": true
    // ... other options
  }
}
```

Add `.tsbuildinfo` to `.gitignore`.

## Open Questions

### Tool Choice

Should we start with Husky (more familiar) or Lefthook (faster, modern)? Lefthook has
momentum in new projects but Husky has deeper ecosystem support. Performance difference
may not matter for Carmenta's current size.

### Type Checking Scope

Run incremental type check on pre-commit or only pre-push? Pre-commit gives faster
feedback but adds 1-2s. Pre-push allows batching multiple commits, but delays feedback.
Could make this configurable per developer.

### Console.log Policy

Block all `console.log` or allow with explicit bypass comment? Sometimes legitimate for
debugging deployed code. Could enforce structured logging (pino) instead via ESLint rule
rather than hook.

### Hook Bypass Logging

Should we log when developers use `--no-verify`? Would help identify recurring pain
points (which checks are too slow/annoying). But feels surveillance-y. Maybe optional
telemetry?

### Monorepo Scoping

When hooks run in monorepo root, should they scope to affected packages or always run
everywhere? Turborepo/Nx can detect affected packages via git diff. More complex but
faster for large repos.

## Related Components

- **Testing** ([testing.md](./testing.md)) - CI runs comprehensive test suites; hooks
  run fast subset
- **Observability** ([observability.md](./observability.md)) - Log hook execution times
  to identify bottlenecks
- **Developer Experience** - Fast hooks maintain flow state; slow hooks encourage
  bypasses

---

_Research conducted January 2026. All referenced tools and patterns verified against
current documentation and production usage._
