---
# prettier-ignore
description: Audit documentation for consistency across docs/, knowledge/ specs, and feature-catalog.ts - find gaps, misleading claims, and sync issues
argument-hint: [focus area or "full"]
version: 1.0.0
model: inherit
---

# Documentation Audit

Systematic review of documentation sources to ensure consistency. Finds misleading
claims, outdated docs, and gaps between what we say and what we ship.

## Focus Area

$ARGUMENTS

If no focus area specified, run full audit. Otherwise, audit just that area:

- `features` - Feature catalog flags and CTA routes
- `integrations` - Service claims vs actual adapters
- `memory` - Memory docs vs knowledge specs
- `philosophy` - Philosophy docs vs internal specs
- `tips` - Homepage carousel and rotating tips accuracy

## Sources Being Audited

1. **docs/** - User-facing documentation → synced to DB via `pnpm docs:sync` → injected
   into LLM context when relevant. Misleading docs = misleading LLM responses.
2. **knowledge/** - Feature specifications (what we're building, source of truth)
3. **lib/features/feature-catalog.ts** - Homepage carousel and tips (what we advertise)

### The Docs Pipeline

```
docs/*.md → pnpm docs:sync → documents table (sourceType: "system_docs")
                           → Full-text search index
                           → Concierge retrieves when relevant
                           → XML injection into system messages
```

Changes to docs/ require `pnpm docs:sync` to propagate. The sync is git-aware (only
updates when docs folder actually changed).

## Audit Process

<context-preservation>
Use sub-agents for investigation work. Your context is for orchestration and synthesis.

Spawn Explore agents in parallel for:

- Route verification (do CTA links work?)
- Feature implementation checks (is available=true accurate?)
- Integration reality checks (are claimed services implemented?)
- Content comparisons (do docs match specs?) </context-preservation>

<audit-steps>

### 1. Feature Catalog Verification

For each feature in `lib/features/feature-catalog.ts`:

- Verify `available: true/false` matches actual implementation
- Confirm CTA links route to real pages
- Check headline/tagline accuracy against what's shipped

### 2. Integration Reality Check

Compare services mentioned in marketing copy vs actual adapters:

- Read `lib/integrations/services.ts` for implemented services
- Compare against feature-catalog.ts claims
- Flag services mentioned but not implemented
- Flag services implemented but not documented

### 3. Docs vs Specs Alignment

For core features (memory, knowledge base, integrations):

- Compare user-facing docs (docs/) against specs (knowledge/)
- Identify aspirational claims vs implemented reality
- Flag terminology inconsistencies
- Note features specified but not documented

### 4. Philosophy Alignment

For heart-centered.md and 100x-framework.md:

- Compare user-facing version to internal specs
- Check for drift between public and internal positioning
- Ensure concrete details make it to user docs

</audit-steps>

## Tracking Document

Update `knowledge/documentation-audit.md` with findings. This is a living document that
tracks:

- Feature catalog status (verified/needs-update/issue-found)
- Integration status table
- Docs vs specs comparison results
- Issues found by severity (critical/high/medium/low)
- Remediation tasks by tier

If the tracking document doesn't exist, create it with the standard structure.

## Severity Levels

**Critical** - Misleading claims (advertising features that don't exist)

**High** - Docs/specs mismatch that could confuse users

**Medium** - Missing documentation for shipped features

**Low** - Copy improvements, terminology cleanup

## Output

After completing the audit:

1. Update `knowledge/documentation-audit.md` with findings
2. Summarize: What's working, what needs attention
3. List remediation tasks by priority tier
4. Offer to fix critical issues immediately

### After Fixing Docs

If docs/ files were modified, remind the user to run:

```bash
pnpm docs:sync
```

This propagates changes to the database so the LLM sees updated content.

## Fixing Issues

For **critical** issues (misleading claims), offer to fix immediately.

For **high** issues (docs/specs mismatch), document the specific changes needed.

For **medium/low** issues, add to the remediation backlog in the tracking doc.
