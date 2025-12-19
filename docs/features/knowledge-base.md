# Knowledge Base

The knowledge base is your personal repository of context that Carmenta uses to
understand you and your work. It's the foundation of the 1x experience: removing
cognitive load by ensuring Carmenta always has the context it needs.

## How It Works

<architecture>
Documents are organized in a hierarchical structure using dot-notation paths:

profile._ — Core information about you. Always available in conversations. knowledge._ —
Your accumulated knowledge. Searchable when relevant. docs.\* — System documentation.
Read-only, searchable.

Each namespace has different behavior:

- Profile documents are always injected into conversation context
- Knowledge documents are searched and retrieved when relevant
- Docs are system documentation (like this page) that help Carmenta answer questions
  </architecture>

## Profile Documents

<profile-namespace>
Your profile tells Carmenta who you are and how to work with you:

Identity: Your name, role, background, and what makes you tick.

Preferences: Communication style, work patterns, what you like and dislike.

Goals: What you're working toward. Current priorities and long-term vision.

People: Key people in your life and work. Relationships, context, what matters about
each person.

Character: How Carmenta should interact with you. Voice, personality, boundaries.
</profile-namespace>

<how-profile-works>
When you start a conversation, Carmenta reads your entire profile and includes it in the system prompt. This means Carmenta always knows:
- How to address you
- What you care about
- Who matters to you
- Your communication preferences
- Your current priorities

No more explaining who you are or what you're working on. The context is always there.
</how-profile-works>

## Knowledge Documents

<knowledge-namespace>
The knowledge namespace stores context that should be searchable but not always present:

Projects: Active initiatives with purpose, status, key decisions. Research: Findings,
analysis, synthesized learnings. Decisions: Choices you've made and why. Reference when
similar decisions arise. Insights: Patterns, realizations, things worth remembering.

When you ask a question, Carmenta searches knowledge documents for relevant context and
includes matching documents in the conversation. </knowledge-namespace>

## Context Compilation

<context-compilation>
Before each conversation, Carmenta compiles your profile into a structured context block:

<about purpose="who you are">
Content from profile.identity
</about>

<how-we-work purpose="preferences and style">
Content from profile.preferences
</how-we-work>

<working-toward purpose="goals and priorities">
Content from profile.goals
</working-toward>

<people purpose="key relationships">
Content from profile.people.*
</people>

This compiled context appears at the start of every system prompt, ensuring Carmenta
always has your essential context. </context-compilation>

## Source Tracking

<source-types>
Every document tracks where it came from:

manual: You or Carmenta created it directly. seed: Initial profile template when you
first signed up. conversation*extraction: Carmenta extracted this from a conversation.
uploaded*\_: Content from uploaded files (PDF, image, audio, document). integration\_\_:
Synced from connected services (Limitless, Fireflies, Notion). system_docs: System
documentation synced from the docs folder.

Source tracking enables:

- Deduplication when re-syncing
- Understanding how knowledge was acquired
- Filtering by source when needed </source-types>

## Editing

Profile and knowledge documents are editable. Click to view, edit to modify, save when
done.

System docs (like this one) are read-only. They're maintained by the Carmenta team and
updated with each deployment.

## The Promise

The knowledge base is the foundation of relationship with Carmenta. What makes this
different from other AI tools:

Other tools: Every conversation starts fresh. You explain who you are, what you're
working on, what you need.

Carmenta: Context persists. Carmenta knows you. The relationship compounds over time.

This is what enables the 100x framework. You can't have a 10x AI team without memory.
You can't have a 100x vision execution partner without context.
