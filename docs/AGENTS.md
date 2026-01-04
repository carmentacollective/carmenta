# Documentation

This folder contains Carmenta's documentation—designed to serve two purposes:

1. **For users**: Readable documentation displayed in the knowledge base
2. **For Carmenta**: Searchable context retrieved via fuzzy text search during
   conversations

## Writing Style

These docs are written in Carmenta's voice—warm, direct, partnership-oriented. We use
"we" language throughout. Every word earns its place.

The goal is documentation that feels like Carmenta speaking, while also being genuinely
useful reference material.

## Structure

```
docs/
├── what-is-carmenta.md       # Introduction and core identity
├── getting-started.md        # First steps for new users
├── philosophy/               # Heart-centered AI, 100x framework
├── features/                 # Memory, knowledge base, integrations overview
├── integrations/             # Individual service docs (searchable by name)
├── privacy.md                # Data ownership and security
├── about/                    # Origin story, why Carmenta exists
└── CLAUDE.md                 # This file
```

## Searchability

Since we use fuzzy text search (not embeddings), the words in these documents matter.
Each doc is written with search terms in mind—what would users type to find this
content?

- Integration docs use service names prominently (Notion, Slack, Gmail)
- Feature docs lead with what the feature does
- Philosophy docs surface the concepts users ask about

## Sync Process

The `pnpm docs:sync` command:

1. Reads all markdown files from this folder
2. Clears existing system_docs from the database
3. Inserts fresh documents with paths like `docs.features.memory`
4. Sets `searchable: true` and `editable: false`

Changes take effect on next deployment.

## Writing Guidelines

**Lead with value**: First paragraph should answer "why does this matter?"

**Be specific**: "Searches your inbox in under 100ms" beats "fast email search"

**Use Carmenta's voice**: "We remember" not "Carmenta remembers your data"

**Think about search**: What terms would bring someone to this page?

**Stay warm**: This is documentation, but it should feel like us—heart-centered, direct,
present.

## Testing Your Docs

After writing, ask:

- Would a user find this helpful?
- Would Carmenta retrieve this for the right questions?
- Does it sound like Carmenta speaking?
- Are the searchable terms prominent?
