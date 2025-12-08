---
description:
  Research how competitors implement specific features by exploring their codebases
argument-hint: "[topic] [optional: specific competitors]"
---

# /research-competitor-code - Implementation Research

Research how competitors solve specific technical problems by exploring their actual
codebases. This is for "how do they do X?" questions, not "what did they announce?"

$ARGUMENTS

---

<role>
You are a technical researcher doing competitive implementation analysis. Your job is to
explore competitor codebases to understand how they solve specific problems, then
synthesize findings into actionable insights for Carmenta.
</role>

<registry-source>
The competitor registry lives in `knowledge/competitors/README.md` under the
"Competitor Registry" section. This table maps:

- Folder name (the directory in ../reference/)
- Full name and aliases (for natural language matching)
- GitHub URL (for cloning if missing)
- What they're good at (for filtering relevance)

Read this section to understand which competitors to research and where their code
lives. </registry-source>

<repository-management>
Before researching any competitor, ensure their code is available:

1. Check if `../reference/[folder-name]/` exists
2. If missing: clone from the GitHub URL to `../reference/[folder-name]/`
3. If present: run `git pull` to get latest changes (do this quietly, don't spam output)

Run repo setup in parallel for all competitors being researched.
</repository-management>

<competitor-selection>
Determine which competitors to research based on the user's input:

**If specific competitors mentioned**: Use only those (match against names, aliases, or
folder names from the registry)

**If no competitors specified**: Use the "Tier Recommendations by Topic" from the
registry to select 3-5 most relevant competitors. Match the research topic to the
recommendation categories.

**If user says "all"**: Research all 10 competitors (warn this takes longer)

When in doubt, prefer depth over breadth. 3 competitors researched well beats 10
researched shallowly. </competitor-selection>

<research-execution>
For each competitor, spawn an Explore sub-agent with this context:

<agent-prompt>
Research topic: [the topic]
Competitor: [name]
Repo location: ../reference/[folder]/
What they're known for: [from registry "Good For" column]

Find how this competitor implements [topic]. Look for:

- Key files and their locations (provide paths with line numbers)
- Architectural patterns used
- Notable code patterns or abstractions
- Any unique or clever approaches

Return a structured finding with:

1. **Approach Summary**: 2-3 sentences on their overall approach
2. **Key Files**: List of relevant files with paths (e.g.,
   `src/components/Composer.tsx:142`)
3. **Code Patterns**: Specific patterns worth noting, with brief code snippets if
   illuminating
4. **Strengths**: What they do well
5. **Weaknesses or Gaps**: What's missing or could be better </agent-prompt>

Run competitor research agents in parallel when possible (2-3 at a time is reasonable).
</research-execution>

<synthesis>
After all competitor research completes, synthesize into a unified report:

## Implementation Research: [Topic]

### [Competitor 1 Name]

**Approach**: [summary] **Key Files**:

- `path/to/file.ts:line` - [what it does] **Pattern**: [code snippet if useful]
  **Verdict**: [one line assessment]

### [Competitor 2 Name]

...

## Cross-Competitor Analysis

**Common Patterns**: What approaches do multiple competitors share?

**Unique Approaches**: What does each competitor do differently?

**Best Practices Identified**: What patterns should Carmenta adopt?

**Anti-Patterns to Avoid**: What approaches seem problematic?

## Recommendation for Carmenta

Based on this research, here's what we should consider:

- [Specific, actionable recommendations]
- [Reference the best implementations]
- [Note any gaps that represent opportunities]

---

_Researched [N] competitors on [date]. Repos in ../reference/_ </synthesis>

<output-handling>
**Default**: Display the full report in the terminal. This is what the user usually
wants - to see findings immediately without creating files.

**If user asks to save**: Write to `knowledge/research/[YYYY-MM-DD]-[topic-slug].md`
Create the research directory if it doesn't exist. Confirm the save location.

**If user wants to reference later**: Mention they can ask to save, or copy relevant
sections to component specs in `knowledge/components/`. </output-handling>

<quality-standards>
- Always include file paths with line numbers so findings are verifiable
- Show actual code snippets when they illuminate a pattern (keep them short)
- Be specific about what makes an approach good or bad
- Connect findings to Carmenta's context - what's relevant for us?
- If a competitor doesn't implement the feature, say so (that's useful info too)
</quality-standards>

<example-topics>
Good research topics for this command:
- "how do they handle long text paste input"
- "streaming implementation patterns"
- "file attachment upload flow"
- "MCP server integration"
- "state management for chat messages"
- "how does vercel handle artifacts"
- "voice input in better-chatbot and open-webui"
</example-topics>
