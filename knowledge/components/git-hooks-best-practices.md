# Git Hooks: Best Practices & Modern Implementation

## What This Is

A comprehensive analysis of modern git hooks patterns, tooling, and automation
strategies based on industry research and leading implementations. Git hooks automate
quality checks, dependency management, and development workflows—keeping code clean and
teams productive.

This spec examines what best-in-class looks like today, emerging patterns, and where git
hooks are heading as AI and automation reshape development workflows.

## Why This Matters

Git hooks are the first line of defense for code quality. They catch issues before code
review, reduce CI failures by 30-50%, and create fast feedback loops that keep
developers in flow state. When implemented well, hooks are invisible productivity
multipliers. When done poorly, they're friction that developers bypass.

The landscape is evolving rapidly: AI-powered code review in hooks, parallel execution
for performance, sophisticated dependency management, and integration with modern
monorepo tools. Understanding current best practices ensures we stay ahead.

## Current State of the Art

### Tool Landscape (2025-2026)

Three main approaches dominate:

**[Husky](https://typicode.github.io/husky/)** - JavaScript ecosystem standard

- 15M+ weekly npm downloads, 34K GitHub stars
- Native Node.js integration, simplest setup for JS/TS projects
- Sequential execution, slower on large codebases
- Best for: Single-language JavaScript/TypeScript projects

**[Lefthook](https://github.com/evilmartians/lefthook)** - Performance-first polyglot

- 555K weekly npm downloads, 6.5K GitHub stars
- Written in Go, language-agnostic YAML configuration
- Parallel execution by default, 2-5x faster than Husky
- Best for: Polyglot projects, monorepos, performance-critical workflows

**[pre-commit](https://pre-commit.com/)** - Python-based framework

- Mature ecosystem (2014), extensive hook catalog
- Language-agnostic with community hook repository
- Sequential by default, configurable parallel execution
- Best for: Python projects, teams wanting pre-built hook catalog

### Performance Considerations

Speed is critical. Developers skip hooks that take too long
([Git Hooks for Automated Code Quality Checks Guide 2025](https://dev.to/arasosman/git-hooks-for-automated-code-quality-checks-guide-2025-372f)).

Modern optimizations:

- **Parallel execution**: Lefthook runs hooks concurrently, reducing pre-commit time by
  50-70%
- **Selective testing**: lint-staged limits checks to changed files only
- **Staged hooks**: Light checks (linting) on pre-commit, heavy tests on pre-push
- **CI offloading**: Run expensive operations (full test suite) in CI, not locally

Real-world improvements:

- Ruff 0.6 (Python linter) improved lint time 98% faster: 120ms vs 7s
  ([Ruff 0.6 Pre-Commit](https://johal.in/ruff-0-6-pre-commit-git-hooks-configuration-2025/))
- Parallel execution handles 500k LOC repos flawlessly
- Pre-commit integration reduces build times 30-50% by catching issues locally

## Hook Types & Common Patterns

### pre-commit: Fast Quality Gates

**Purpose**: Catch formatting and linting errors before commit **Performance target**: <
3 seconds for typical changes

Common patterns:

```javascript
// lint-staged.config.js (Next.js pattern)
module.exports = {
  "*.{js,jsx,mjs,ts,tsx,mts,mdx}": [
    "prettier --with-node-modules --ignore-path .prettierignore --write",
    "eslint --config eslint.config.mjs --fix",
  ],
  "*.{json,md,css,html,yml,yaml,scss}": [
    "prettier --with-node-modules --ignore-path .prettierignore --write",
  ],
  "*.rs": ["rustfmt --edition 2024 --"],
};
```

**What leaders do**:

- Format code automatically (Prettier, Black, rustfmt)
- Fix auto-fixable linting errors (ESLint, Ruff)
- Type-check changed files only (TypeScript incremental)
- Block commits if errors can't be auto-fixed

**What NOT to do**:

- Full test suites (too slow, use pre-push)
- Building production bundles
- Network requests or external API calls
- Heavy type-checking of entire codebase

### pre-push: Comprehensive Validation

**Purpose**: Final validation before code leaves local machine **Performance target**: <
30 seconds for typical changes

Common patterns:

```bash
#!/bin/sh
# Branch protection example (Next.js pattern)
protected_branch='main'
protected_remote_urls="git@github.com:org/repo.git"

# Prevent accidental pushes to protected branches
is_remote_protected=0
for protected_remote_url in $protected_remote_urls; do
  if [ "$remote_url" = "$protected_remote_url" ]; then
    is_remote_protected=1
    break
  fi
done

if [ "$push_targets_protected_branch" = "1" ]; then
  echo "Prevent push to '$protected_branch'. Use --no-verify to bypass."
  exit 1
fi
```

**What leaders do**:

- Run integration tests on changed modules
- Type-check entire project (catch cross-file issues)
- Security scanning (secrets detection, dependency vulnerabilities)
- Prevent force-push to protected branches
- Build verification (ensure production build succeeds)

**Performance optimization**:

- Incremental builds when possible
- Parallel test execution
- Cache type-checking results
- Skip on feature branches, enforce on main

### post-merge: Automated State Synchronization

**Purpose**: Keep local environment in sync after pulling changes **Performance
target**: Fast detection, defer expensive operations

Carmenta's current implementation (sophisticated example):

```bash
#!/bin/sh
# Clear Next.js cache - prevents stale route types
if [ -d ".next" ]; then
  rm -rf .next
fi

# Install dependencies if lockfile changed
if git diff-tree -r --name-only --no-commit-id HEAD@{1} HEAD | grep -q "package.json\|pnpm-lock.yaml"; then
  pnpm install --silent
fi

# Regenerate DB migrations if schema changed
if git diff-tree -r --name-only --no-commit-id HEAD@{1} HEAD | grep -q "lib/db/schema.ts"; then
  pnpm run db:generate
  echo "⚠️  Review migrations in drizzle/migrations/ then run db:push"
fi
```

**What leaders do**:

- Detect lockfile changes, prompt dependency install
  ([yarnhook pattern](https://github.com/frontsideair/yarnhook))
- Clear framework caches (Next.js .next, Vite cache)
- Regenerate code (GraphQL, Prisma, Drizzle)
- Database migration warnings
- Environment file change notifications

**Emerging patterns**
([Automating NPM with Git Hooks](https://andycarter.dev/blog/automating-npm-and-composer-with-git-hooks/)):

- Smart detection: only install if lockfile changed
- Parallel operations: clear cache + check migrations simultaneously
- User prompts: ask before expensive operations
- Background execution: non-blocking notifications

### post-checkout: Branch-Aware Environment Management

**Purpose**: Adapt environment when switching branches **Performance target**: Instant
detection, deferred execution

Carmenta's implementation:

```bash
#!/bin/sh
# Only run if switching branches (not checking out files)
if [ "$3" = "1" ]; then
  # Clear Next.js cache for different route structures
  rm -rf .next

  # Warn about dependency differences
  if git diff --name-only "$1" "$2" | grep -q "package.json"; then
    echo "⚠️  Dependencies differ. Run 'pnpm install'"
  fi

  # Warn about schema differences
  if git diff --name-only "$1" "$2" | grep -q "lib/db/schema.ts"; then
    echo "⚠️  Schema differs. Run 'pnpm run db:generate'"
  fi
fi
```

**What leaders do**:

- Detect environment file differences (.env changes)
- Switch database contexts (branch-specific databases)
- Activate/deactivate feature flags
- Clear framework-specific caches
- Notify about configuration drift

**Innovative uses**
([Git Hooks Automation](https://www.digitalocean.com/community/tutorials/how-to-use-git-hooks-to-automate-development-and-deployment-tasks)):

- Automatically run asset compilation if source files changed
- Switch Node/Python versions based on branch config
- Update local service configs (activate plugins on certain branches)
- Repository validation checks

### prepare-commit-msg: Standardized Commit Messages

**Purpose**: Enforce commit message conventions **Performance target**: Instant

Modern implementations combine gitmoji + conventional commits:

```bash
#!/bin/sh
# Auto-add gitmoji based on conventional commit type
npx devmoji -e --lint
```

**What leaders do**
([Commitizen integration](https://medium.com/@jebarpg/setting-up-gitmoji-in-commitizen-commitlint-conventional-changelog-and-semantic-release-with-ace3ac7cc850)):

- Interactive commit message wizards (Commitizen)
- Auto-add emojis based on type (devmoji, cz-conventional-gitmoji)
- Branch name → ticket reference (JIRA-123 from branch)
- Template population (PR template, issue references)

**Popular patterns** ([prepare-commit-msg examples](https://github.com/folke/devmoji)):

```bash
# Devmoji: Adds emojis to conventional commits
feat: add user auth → ✨ feat: add user auth
fix: button styling → 🐛 fix: button styling
docs: update README → 📝 docs: update README
```

### commit-msg: Message Validation

**Purpose**: Enforce commit message standards **Performance target**: Instant

Industry standard:
[Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) +
[commitlint](https://commitlint.js.org/)

```bash
#!/bin/sh
npx --no -- commitlint --edit "$1"
```

**Configuration**
([commitlint best practices](https://www.freecodecamp.org/news/how-to-use-commitlint-to-write-good-commit-messages/)):

```javascript
// commitlint.config.js
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
      ],
    ],
    "subject-case": [
      2,
      "never",
      ["sentence-case", "start-case", "pascal-case", "upper-case"],
    ],
    "body-max-line-length": [2, "always", 100],
  },
};
```

**Benefits**:

- Automated changelog generation (semantic-release)
- Semantic versioning automation (MAJOR.MINOR.PATCH)
- Better git history searchability
- PR template auto-population

## CI/CD Integration Patterns

### Dual Validation Strategy

**Philosophy**: Pre-commit is convenience, CI is enforcement
([Pre-commit vs. CI](https://switowski.com/blog/pre-commit-vs-ci/))

Why both matter:

- **Local hooks**: Fast feedback, prevent easy mistakes
- **CI validation**: Unskippable source of truth

Developers can bypass local hooks with `--no-verify`. CI catches what slips through.

### Skipping Hooks on CI

Prevent hook installation in CI environments
([Husky CI best practices](https://kinsta.com/blog/git-hooks/)):

```json
{
  "scripts": {
    "prepare": "husky"
  }
}
```

Husky v9 auto-detects CI environments (`CI=true`) and skips installation. For manual
control:

```bash
# Skip in Docker/CI
HUSKY=0 npm install

# Or check in script
if [ "$CI" = "true" ]; then exit 0; fi
```

**Why skip**:

- CI runs full validation anyway (redundant)
- Speeds up CI setup time
- Avoids issues with CI-specific file permissions
- Production builds shouldn't include dev dependencies

### Performance Optimization

Modern CI strategies
([Pre-push hooks optimization](https://dev.to/arasosman/git-hooks-for-automated-code-quality-checks-guide-2025-372f)):

**Pre-commit** (local only):

- Formatting (Prettier, Black)
- Linting with auto-fix (ESLint --fix)
- Incremental type-checking (changed files only)

**Pre-push** (local + PR gate):

- Full test suite
- Integration tests
- Security scanning
- Production build verification

**CI** (ultimate gate):

- Everything from pre-push
- Cross-browser testing
- Deployment validation
- Performance benchmarks
- Dependency security audits

Reduces CI failures 30-50% by catching issues locally
([Git Hooks CI optimization](https://dev.to/arasosman/git-hooks-for-automated-code-quality-checks-guide-2025-372f)).

## Advanced Patterns

### Git Worktree Support

Challenge: Hooks live in `.git/hooks`, shared across all worktrees
([Git Worktree hooks](https://blog.tnez.dev/posts/supercharge-workflow-with-git-worktrees/)).

**Solution**: Shared hooks directory

```bash
# Create shared hooks directory
mkdir -p _hooks
git config core.hooksPath "$(pwd)/_hooks"
```

**Benefits**:

- Single source of truth for all worktrees
- Updates apply everywhere instantly
- No worktree-specific configuration drift

**Worktree-specific needs**: Use environment variables or branch detection for
worktree-aware behavior:

```bash
# Detect worktree location
WORKTREE_PATH=$(git rev-parse --show-toplevel)
if [[ "$WORKTREE_PATH" == *"/feature-login"* ]]; then
  # Worktree-specific behavior
fi
```

### Monorepo Optimization

**Problem**: Running linters on entire monorepo for small changes

**Solutions**:

1. **lint-staged with workspace awareness**

   ```javascript
   // Only check changed packages
   '*.ts': (filenames) => {
     const packages = new Set(filenames.map(f => getPackage(f)))
     return Array.from(packages).map(pkg =>
       `pnpm --filter ${pkg} run lint`
     )
   }
   ```

2. **Lefthook parallel execution per package**

   ```yaml
   # lefthook.yml
   pre-commit:
     parallel: true
     commands:
       lint-packages:
         glob: "packages/*"
         run: pnpm --filter {package} lint
   ```

3. **Nx/Turborepo affected commands**
   ```bash
   # Only test affected packages
   nx affected:test --base=main --head=HEAD
   ```

### Security & Secrets Detection

**Pre-commit patterns**
([GitHub AI security scanning](https://www.codeant.ai/blogs/best-github-ai-code-review-tools-2025)):

```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/Yelp/detect-secrets
    hooks:
      - id: detect-secrets
        args: ["--baseline", ".secrets.baseline"]

  - repo: https://github.com/gitleaks/gitleaks
    hooks:
      - id: gitleaks
```

**Modern approach** (GitHub Copilot, August 2025):

- Automatic secret scanning in AI prompts
- Block commits if API keys detected
- Integration with 1Password, AWS Secrets Manager

**Best practices**:

- Maintain secrets baseline (track known false positives)
- Fail fast on detection
- Provide remediation instructions
- Integrate with secret management tools

## Emerging Trends (2025-2026)

### AI-Powered Code Review Hooks

**Current state**
([GitHub AI Updates August 2025](https://talent500.com/blog/github-ai-updates-august-2025/)):

GPT-5 integration into GitHub Copilot (August 2025):

- Advanced reasoning for code review
- Full system implementation with error handling
- Security protocol validation
- Claude Opus 4.1 for refactoring analysis

**Pre-commit AI integration**
([AI Code Review Action](https://github.com/marketplace/actions/ai-code-review-action)):

```yaml
# .github/workflows/ai-review.yml
- uses: actions/ai-code-review@v1
  with:
    openai_api_key: ${{ secrets.OPENAI_API_KEY }}
    model: gpt-4
    review_type: security,performance,best-practices
```

**Emerging patterns**:

- Local AI review on pre-commit (lightweight models)
- Automated fix suggestions (Copilot Autofix)
- Security vulnerability detection with explanations
- Breaking change detection across repos

**Where this is heading**:

- Pre-commit AI agents that auto-fix issues
- Context-aware reviews using full codebase understanding
- Policy-as-code enforcement (block merges based on AI findings)
- Integration with private LLM deployments for sensitive code

### Performance & Developer Experience

**2025 benchmarks**:

- Ruff 0.6: 98% faster linting (7s → 120ms)
- Lefthook parallel: 2-5x faster than sequential
- Smart caching: Skip unchanged file checks

**Where this is heading**:

- Predictive pre-warming (run checks before commit based on file changes)
- Distributed hook execution (offload to remote runners)
- Incremental everything (types, tests, builds)
- AI-optimized hook ordering (learn which checks fail most often)

### Infrastructure as Code & GitOps

**Emerging patterns**:

- Terraform/Pulumi validation in pre-commit
- Kubernetes manifest linting (kubeval, kube-score)
- Policy enforcement (Open Policy Agent)
- Cost estimation for infra changes

**Example**:

```bash
# pre-commit hook for Terraform
terraform fmt -check
terraform validate
tflint --recursive
checkov --directory .
```

## Gap Assessment

### Achievable Now

**Table stakes** (every project should have):

- ✅ Formatting auto-fix (Prettier, Black)
- ✅ Linting with auto-fix (ESLint, Ruff)
- ✅ Commit message validation (commitlint)
- ✅ Branch protection (prevent push to main)
- ✅ Dependency installation on merge
- ✅ Secrets detection (gitleaks, detect-secrets)

**Leader patterns** (differentiated):

- ✅ Parallel hook execution (Lefthook)
- ✅ Smart cache invalidation (framework-specific)
- ✅ Database migration automation (schema change detection)
- ✅ Monorepo-aware selective testing
- ✅ Pre-push integration tests
- ✅ Worktree-aware hook management

### Emerging (6-12 months)

**AI-powered automation**:

- 🔶 GPT-5/Claude Opus 4.1 pre-commit review (API available, adoption growing)
- 🔶 Automated security fix suggestions (GitHub Copilot Autofix expanding)
- 🔶 Breaking change detection (emerging tools, not mainstream)
- 🔶 Policy-as-code enforcement (OPA integration patterns solidifying)

**Performance optimization**:

- 🔶 Predictive hook execution (research phase)
- 🔶 Distributed remote execution (experimental)
- 🔶 AI-optimized hook ordering (no tooling yet)

**Infrastructure validation**:

- 🔶 IaC cost estimation in hooks (tools exist, adoption low)
- 🔶 Kubernetes policy enforcement (enterprise early adopters)

### Aspirational (12+ months)

**Full AI integration**:

- 🔴 Context-aware review using entire codebase (requires significant compute)
- 🔴 Auto-refactoring based on detected patterns (research phase)
- 🔴 Predictive bug detection (ML models not production-ready)

**Advanced automation**:

- 🔴 Self-optimizing hooks (learn from team patterns)
- 🔴 Zero-config setup (project type auto-detection)
- 🔴 Real-time collaborative hooks (multi-dev sync)

## Implementation Roadmap

### Phase 1: Modern Foundations (Current → +1 month)

**Objectives**:

- Upgrade to Husky v9 (current industry standard)
- Optimize hook performance (parallel where possible)
- Add commit message validation

**Tasks**:

- Evaluate Lefthook for parallel execution (benchmark against current)
- Add commitlint + conventional commits
- Implement prepare-commit-msg for gitmoji automation
- Document hook behavior in README

**Success metrics**:

- pre-commit < 3 seconds on typical changes
- pre-push < 30 seconds
- 100% commit message compliance

### Phase 2: Advanced Automation (+1-3 months)

**Objectives**:

- AI-assisted code review in PR workflow
- Enhanced security scanning
- Worktree-optimized setup

**Tasks**:

- Add AI code review GitHub Action (GPT-4 or Claude)
- Integrate advanced secrets detection (detect-secrets baseline)
- Create shared hooks directory for worktree support
- Add monorepo optimization (if scaling to multiple packages)

**Success metrics**:

- AI review comments on 90%+ PRs
- Zero secrets in committed code
- Hooks work seamlessly across all worktrees

### Phase 3: Continuous Optimization (+3-6 months)

**Objectives**:

- Measure and optimize hook performance
- Expand coverage to infrastructure code
- Build custom hooks for Carmenta-specific workflows

**Tasks**:

- Add Terraform/IaC validation hooks
- Implement custom hooks for AI prompt validation
- Performance profiling and optimization
- Team feedback integration

**Success metrics**:

- < 5% of commits use --no-verify
- CI failure rate < 5%
- Developer satisfaction > 8/10

## Architecture Decisions

### Tool Selection: Husky (Current)

**Decision**: Continue with Husky v9 for now, evaluate Lefthook if performance becomes
bottleneck.

**Rationale**:

- Current setup works well (simple, well-understood)
- Husky 9+ is significantly faster than v8
- Ecosystem integration is mature (lint-staged, commitlint)
- Migration cost outweighs benefit unless we hit performance issues

**Reconsider if**:

- Pre-commit times exceed 5 seconds regularly
- We expand to polyglot codebase (Go, Rust, Python services)
- Monorepo grows to 10+ packages

### Hook Strategy: Staged Validation

**Decision**: Light checks on pre-commit, comprehensive on pre-push.

**Rationale**:

- Keeps commit flow fast (< 3 seconds)
- Pre-push catches integration issues before CI
- Reduces CI failures without blocking commits
- Developers can commit frequently, validate before push

**Implementation**:

```
pre-commit:  format + lint (auto-fix) + type-check (incremental)
pre-push:    tests + type-check (full) + security scan + build
CI:          everything + integration + deployment validation
```

### Commit Messages: Conventional Commits + Gitmoji

**Decision**: Adopt conventional commits with optional emoji enhancement.

**Rationale**:

- Enables automated changelog generation
- Semantic versioning automation
- Better git history readability
- Gitmoji adds visual clarity without forcing it

**Configuration**:

```bash
# Valid formats
✨ feat: add user authentication
feat: add user authentication
🐛 fix(api): handle null responses
fix(api): handle null responses
```

Both formats accepted. Emoji is enhancement, not requirement.

### CI Integration: Dual Validation

**Decision**: Run hooks locally + full validation in CI.

**Rationale**:

- Local hooks are convenience (fast feedback)
- CI is enforcement (can't be skipped)
- Developers can use --no-verify in emergencies
- CI catches what local hooks miss

**CI environment**:

- Skip hook installation (HUSKY=0)
- Run same validations as pre-push
- Add deployment-specific checks
- Report results to PR

## Open Questions

### Performance vs. Coverage Trade-offs

**Question**: Should we run full type-checking on pre-commit or defer to pre-push?

**Current thinking**: Incremental on pre-commit (changed files), full on pre-push.

**Need to decide**:

- TypeScript project references to enable true incremental
- Cache strategy for type-checking results
- When to invalidate cache (dependency changes, tsconfig updates)

### AI Code Review Integration

**Question**: Where does AI review fit? Pre-commit, pre-push, or PR-only?

**Options**:

1. **PR-only** (current GitHub Action pattern): Least friction, async feedback
2. **Pre-push with caching**: Faster feedback, potential bottleneck
3. **Opt-in pre-commit**: Developer choice, inconsistent adoption

**Leaning toward**: PR-only for now, evaluate pre-push with local LLM if latency
acceptable.

### Worktree Hook Sharing

**Question**: Should we move to shared hooks directory for worktree support?

**Trade-offs**:

- **Shared directory**: Single source of truth, manual git config
- **Current .husky**: Works with Husky tooling, duplicated across worktrees

**Decision needed**: Survey team on worktree usage frequency. If < 20% of devs use
worktrees, current approach is fine.

### Monorepo Evolution

**Question**: If we grow to multiple packages, which tool scales best?

**Future considerations**:

- Nx: Enterprise monorepo platform, sophisticated caching
- Turborepo: Simpler, Vercel ecosystem fit
- pnpm workspaces + Lefthook: Lightweight, flexible

**Current state**: Single package, not urgent. Revisit if extracting shared libraries.

## Sources

### Research & Best Practices

- [Husky Documentation](https://typicode.github.io/husky/)
- [Lefthook vs Husky Comparison](https://www.edopedia.com/blog/lefthook-vs-husky/)
- [Git Hooks for Automated Code Quality 2025](https://dev.to/arasosman/git-hooks-for-automated-code-quality-checks-guide-2025-372f)
- [Effortless Code Quality: Pre-Commit Guide 2025](https://gatlenculp.medium.com/effortless-code-quality-the-ultimate-pre-commit-hooks-guide-for-2025-57ca501d9835)
- [Pre-commit vs. CI Strategy](https://switowski.com/blog/pre-commit-vs-ci/)
- [Git Hooks Best Practices](https://kinsta.com/blog/git-hooks/)

### Conventional Commits & Commit Automation

- [Conventional Commits Specification](https://www.conventionalcommits.org/en/v1.0.0/)
- [Commitlint Documentation](https://commitlint.js.org/)
- [Setting Up Gitmoji + Commitizen](https://medium.com/@jebarpg/setting-up-gitmoji-in-commitizen-commitlint-conventional-changelog-and-semantic-release-with-ace3ac7cc850)
- [Devmoji: Emojify Conventional Commits](https://github.com/folke/devmoji)
- [How to Use Commitlint](https://www.freecodecamp.org/news/how-to-use-commitlint-to-write-good-commit-messages/)

### Advanced Patterns & Automation

- [Automating NPM with Git Hooks](https://andycarter.dev/blog/automating-npm-and-composer-with-git-hooks/)
- [yarnhook: Automatic Dependency Installation](https://github.com/frontsideair/yarnhook)
- [Git Hooks for Development & Deployment](https://www.digitalocean.com/community/tutorials/how-to-use-git-hooks-to-automate-development-and-deployment-tasks)
- [Git Worktree Hook Management](https://blog.tnez.dev/posts/supercharge-workflow-with-git-worktrees/)
- [lint-staged Configuration Patterns](https://github.com/lint-staged/lint-staged)

### AI & Emerging Trends

- [GitHub AI Updates August 2025](https://talent500.com/blog/github-ai-updates-august-2025/)
- [Best GitHub AI Code Review Tools 2026](https://www.codeant.ai/blogs/best-github-ai-code-review-tools-2025)
- [AI Code Review Action](https://github.com/marketplace/actions/ai-code-review-action)
- [Ruff 0.6 Pre-Commit Configuration](https://johal.in/ruff-0-6-pre-commit-git-hooks-configuration-2025/)

### Implementation References

- Next.js repository: `/Users/nick/src/reference/nextjs-hooks/.husky/` (examined
  pre-commit, pre-push, lint-staged config)
- Carmenta current setup: `/Users/nick/src/carmenta-repo/.husky/` (post-merge,
  post-checkout, pre-commit, pre-push)

---

_Last updated: January 2026_ _Research depth: 10+ sources analyzed, 2 major repositories
examined, current Carmenta implementation reviewed_
