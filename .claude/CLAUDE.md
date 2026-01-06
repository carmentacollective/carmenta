# Carmenta Claude Code Configuration

This document covers conventions for agents, skills, and commands in Carmenta's .claude
directory.

@.cursor/rules/prompt-engineering.mdc

## Directory Structure

- `commands/` - User-invoked workflows (slash commands like `/build-next`)
- `agents/` - Specialized AI assistants with focused expertise
- `skills/` - Claude-invoked capabilities (activated autonomously when relevant)

## YAML Frontmatter Conventions

### Prettier-Ignore for Long Descriptions

Add `# prettier-ignore` before description fields to prevent line wrapping:

```yaml
---
name: robustness-reviewer
# prettier-ignore
description: Use when reviewing for production readiness, fragile code, error handling, resilience, reliability, or catching bugs before deployment
version: 1.0.0
model: opus
---
```

This allows richer, more comprehensive descriptions that help Claude Code understand
exactly when to trigger each agent or skill.

### Description Format by Type

**Agents & Skills (LLM-triggered):**

Use "Use when..." format for semantic matching. Think about what users will say:

```yaml
# prettier-ignore
description: Use when testing in browser, verifying UI works, checking end-user functionality, visual verification, cross-browser checks, or need automated browser testing
```

Match user language variations:

- Action verbs: "testing", "verifying", "checking", "finding", "debugging"
- Problem statements: "UI not working", "feature is broken", "need to verify"
- Tool names: "Playwright", "Sentry", "browser automation"
- Synonyms: "UX/user experience", "resilience/reliability"

**Commands (user-invoked):**

Explain what the command does from the user's perspective:

```yaml
# prettier-ignore
description: Verify functionality works from an end-user perspective - find issues, fix them, re-verify until working or stuck
```

Commands are invoked directly by users (`/command-name`), so descriptions should clearly
explain what outcome the user gets.

## Agent Color Scheme

Colors are semantic, grouped by category:

| Color      | Category          | Examples                                   |
| ---------- | ----------------- | ------------------------------------------ |
| **purple** | Design/UX         | browser-verifier, empathy-reviewer         |
| **pink**   | Special tasks     | logo-fetcher (brand assets)                |
| **cyan**   | Observability     | Site reliability, monitoring (if we add)   |
| **orange** | Bugs/correctness  | robustness-reviewer (finding fragile code) |
| **blue**   | Style/conventions | Code review, formatting (if we add)        |
| **green**  | Testing/quality   | Test runners, QA automation (if we add)    |

When adding new agents, choose colors that match their primary domain. Purple is our
default for user-facing/UX work.

## Model Tier Assignments

Choose models based on task complexity and judgment requirements:

| Tier       | Use For                                           | Examples                       |
| ---------- | ------------------------------------------------- | ------------------------------ |
| **opus**   | Deep analysis, nuanced judgment, security reviews | empathy-reviewer, robustness   |
| **sonnet** | Capable automation, production-ready tasks        | browser-verifier, logo-fetcher |
| **haiku**  | Simple scripts, speed-critical tasks              | dev-server                     |

### When to Use Each Tier

**Opus (claude-opus-4-5):**

- Requires emotional intelligence or empathy
- Security-critical analysis
- Architectural decisions
- Complex multi-step reasoning

**Sonnet (claude-sonnet-4-5):**

- Standard automation and verification
- Code generation and editing
- Research and information gathering
- Most production agents

**Haiku (claude-haiku-4-5):**

- Port detection and process management
- Simple file operations
- Quick status checks
- Tasks where speed > depth

**Inherit (for commands):** Most commands use `model: inherit` to use the main
conversation's model. Override only when the command requires a specific capability
tier.

## Versioning Methodology

We use semantic versioning (X.Y.Z) for commands, agents, and skills:

### Version Format

- **0.x.x** - Experimental/evolving, API may change
- **1.x.x** - Stable, production-ready
- **2.x.x+** - Has had breaking changes

### When to Increment

- **Major (X.0.0)** - Breaking changes to interface or behavior
  - Example: Agent → Command conversion, removed required parameters
- **Minor (X.Y.0)** - New features, enhanced capabilities
  - Example: Added OAuth support, new analysis modes
- **Patch (X.Y.Z)** - Bug fixes, documentation improvements
  - Example: Fixed edge case, clarified description

### Deriving Initial Versions

For existing files without versions:

1. Check git history for major rewrites (→ 2.x.x+)
2. Count feature additions since creation (→ 1.Y.0)
3. Default to 1.0.0 for stable, documented features
4. Use 0.1.0 for new experimental work

New files start at:

- **1.0.0** - If production-ready and documented
- **0.1.0** - If experimental or evolving

## Skill References

Skills can reference other skills or commands from plugins:

```yaml
skills: carmenta-copy, ai-coding-config:research
```

The `:` syntax references plugin-provided skills:

- `carmenta-copy` - Local skill in `.claude/skills/carmenta-copy/`
- `ai-coding-config:research` - Skill from ai-coding-config plugin

Check `.claude/plugins/` or plugin documentation for available skills.

## Writing Agent Prompts

Agents operate in isolated context with only specified tools. Follow these patterns:

**Goal-focused instructions:**

```markdown
Find all instances of the pattern and report locations. For each match, extract
surrounding context to understand usage.
```

**Not step-by-step prescriptions:**

```markdown
1. First run grep to search
2. Then read each file
3. Next analyze the context
4. Finally write a report
```

**Trust the model's capabilities** - It knows how to use its tools. Focus on what
success looks like, not how to achieve it.

**Use XML tags for complex multi-section prompts:**

```markdown
<objective>
Find fragile code patterns that could break in production.
</objective>

<what-to-look-for>
- Unhandled promise rejections
- Silent error swallowing
- Missing null checks in critical paths
</what-to-look-for>

<output-format>
For each issue: file, line, severity, explanation, suggested fix.
</output-format>
```

## Command Documentation

Commands should include:

1. **Clear description** - What outcome the user gets
2. **Argument hints** - `[what-to-verify]`, `[issue-number]`, etc.
3. **Usage examples** - Show invocation patterns
4. **Context awareness** - Document git, dev server, worktree requirements

Example frontmatter:

```yaml
---
# prettier-ignore
description: Verify functionality works from an end-user perspective - find issues, fix them, re-verify until working or stuck
argument-hint: [what to verify]
version: 1.0.0
model: inherit
---
```

## Quality Standards

Before committing configuration changes:

### ✅ Descriptions Are Discoverable

- Agent/skill descriptions include natural language variations users might say
- Command descriptions explain outcomes, not just features
- Include tool names, synonyms, problem statements

### ✅ YAML Frontmatter Is Complete

- All files have required fields (name, description)
- Version numbers follow semantic versioning
- Model tier matches task complexity
- Colors (for agents) are semantically meaningful

### ✅ Code Examples Are Formatted

- Use proper fenced code blocks with language tags
- Multi-line code is not collapsed
- Examples follow project coding standards

### ✅ Prompts Follow Engineering Standards

- Goal-focused, not step-by-step
- XML tags for complex structure
- Trust the executing model
- Clarity over brevity

## Adding New Agents

When creating a new agent:

1. Choose appropriate **color** from scheme above
2. Select **model tier** based on task complexity
3. Write **semantic description** matching user language
4. List **minimal tools** needed (don't give access to everything)
5. Start with **version 0.1.0** if experimental, **1.0.0** if production-ready
6. Reference relevant **skills** if needed

## Adding New Skills

When creating a new skill:

1. Create directory: `.claude/skills/skill-name/`
2. Add `SKILL.md` with semantic description
3. Include version number (start at 1.0.0 for production-ready)
4. Document auto-trigger conditions in `<when-to-use>` section
5. Use XML tags for structured content
6. Provide concrete patterns and examples

## Maintenance

When updating existing files:

- **Increment version** appropriately (patch for fixes, minor for features, major for
  breaking changes)
- **Update descriptions** if trigger conditions change
- **Test semantic matching** - Does Claude Code activate this when expected?
- **Document changes** in commit messages with version bump rationale
