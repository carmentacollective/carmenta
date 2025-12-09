# Integration Priorities for Carmenta

Analysis of which mcp-hubby integrations to port to Carmenta, based on vision alignment
and strategic value.

## Executive Summary

Of 24 mcp-hubby integrations, 19 align with Carmenta's vision. Recommend phased
implementation: 8 for MVP, 6 for Phase 2, 5 for Phase 3.

## Available from mcp-hubby

### High Priority - MVP (Phase 1)

These directly support core workflows and appear in vision.md priority list:

1. **gmail.ts** - Communication foundation
   - Status: Priority 1
   - Rationale: Email is universal. Read, search, send capabilities essential for AI
     team.
   - From vision.md: Listed as priority communication integration

2. **google-calendar.ts** - Time management foundation
   - Status: Priority 1
   - Rationale: Schedule awareness enables proactive intelligence, meeting prep.
   - From vision.md: Listed as priority calendar integration

3. **notion.ts** - Knowledge management
   - Status: Priority 1
   - Rationale: Where many builders keep project docs, specs, personal knowledge base.
   - From vision.md: Listed first in productivity integrations

4. **github.ts** - Developer workflow
   - Status: Priority 1
   - Rationale: Issues, PRs, code search. Core for builder audience.
   - From vision.md: Listed in dev/ops integrations

5. **slack.ts** - Team communication
   - Status: Priority 1
   - Rationale: Where work conversations happen. Read channels, send messages.
   - From vision.md: Listed in communication integrations

6. **google-drive.ts** - Document storage
   - Status: Priority 1
   - Rationale: Universal file access. Many docs, sheets, presentations stored here.
   - From vision.md: Listed in storage integrations

7. **exa.ts** - Deep research
   - Status: Priority 1
   - Rationale: AI-powered search API. Differentiator for research quality.
   - From vision.md: Listed in AI/Data integrations
   - Note: Could be Tier 1 (Carmenta API key) instead of Tier 2

8. **clickup.ts** - Task management
   - Status: Priority 1
   - Rationale: Popular with builder audience. Tasks, docs, goals.
   - From vision.md: Listed first after Notion in productivity

### Phase 2 - Core Service Expansion

Strong value but can follow MVP:

9. **linkedin.ts** - Professional networking
   - Status: Priority 2
   - Rationale: Professional context, networking, content publishing.
   - From vision.md: Listed in communication integrations

10. **twitter-x.ts** - Social presence
    - Status: Priority 2
    - Rationale: Builder audience active on X. Reading, posting, engagement.
    - From vision.md: Listed as "X/Twitter" in communication

11. **dropbox.ts** - Alternative storage
    - Status: Priority 2
    - Rationale: Significant user base, different from Google Drive users.
    - From vision.md: Listed in storage integrations

12. **sentry.ts** - Error monitoring
    - Status: Priority 2
    - Rationale: Developer workflow. Error analysis, debugging assistance.
    - From vision.md: Listed in dev/ops integrations

13. **limitless.ts** - AI memory/transcription
    - Status: Priority 2
    - Rationale: Meeting transcripts, personal memory augmentation.
    - From vision.md: Listed first in AI/Data integrations

14. **miro.ts** - Visual collaboration
    - Status: Priority 2
    - Rationale: Design, brainstorming, visual thinking.
    - From vision.md: Listed in productivity integrations

### Phase 3 - Media & Specialized

Nice-to-have, lower urgency:

15. **youtube.ts** - Video platform
    - Status: Priority 3
    - Rationale: Content research, video metadata, channel management.
    - From vision.md: Listed in media integrations

16. **spotify.ts** - Music platform
    - Status: Priority 3
    - Rationale: Playlist management, music discovery. Lower work utility.
    - From vision.md: Listed in media integrations

17. **instagram.ts** - Visual social
    - Status: Priority 3
    - Rationale: Visual content management. Relevant for creators.
    - From vision.md: Listed in media integrations

18. **google-photos.ts** - Photo storage
    - Status: Priority 3
    - Rationale: Image access, organization. Moderate work utility.
    - From vision.md: Listed in media integrations

19. **coinmarketcap.ts** - Crypto data
    - Status: Priority 3
    - Rationale: Market data for crypto. Niche but relevant to some builders.
    - From vision.md: Listed in finance integrations as alternative to Monarch

### Not Recommended

Integrations available in mcp-hubby but not aligned with Carmenta vision:

20. **fireflies.ts** - Meeting transcription
    - Rationale: Overlaps with Limitless. Choose one, not both. Limitless broader.
    - From vision.md: Listed in AI/Data, but Limitless preferred

21. **giphy.ts** - GIF search
    - Rationale: Fun but low utility. Not in vision.md priorities.
    - Recommendation: Skip

22. **math.ts** - Mathematical computation
    - Rationale: LLMs handle math. Dedicated tool rarely needed per tools.md.
    - Recommendation: Skip (called out as cargo cult in tools.md)

23. **memory.ts** - MCP Hubby's memory system
    - Rationale: Carmenta building its own memory architecture.
    - Recommendation: Don't port, build native

24. **context7.ts** - Unknown service
    - Rationale: Not in vision.md. Need to research what this is.
    - Recommendation: Defer pending research

## Missing from mcp-hubby

Services in vision.md not yet built in mcp-hubby:

1. **Linear** - Issue tracking (productivity)
   - Need to build from scratch
   - High priority for dev teams

2. **Google Contacts** - Contact management (calendar/contacts)
   - Need to build from scratch
   - Enables relationship context

3. **Monarch Money** - Personal finance (finance)
   - Need to build from scratch
   - Listed as primary finance integration

## Implementation Sequence

### MVP Launch (8 integrations)

Priority order:

1. Gmail
2. Google Calendar
3. Notion
4. GitHub
5. Slack
6. Google Drive
7. Exa (evaluate Tier 1 vs Tier 2)
8. ClickUp

### Post-MVP Phase 2 (6 integrations)

9. LinkedIn
10. Twitter/X
11. Dropbox
12. Sentry
13. Limitless
14. Miro

### Phase 3 & Beyond (5 integrations)

15. YouTube
16. Spotify
17. Instagram
18. Google Photos
19. CoinMarketCap

### Custom Development Needed

- Linear (high priority, post-MVP)
- Google Contacts (medium priority)
- Monarch Money (lower priority, niche)

## Architecture Notes

### Direct Reuse

The ServiceAdapter base class and gateway pattern transfer directly. Each integration is
self-contained with:

- Tool schema definition
- Action routing
- Response formatting
- Error handling
- Help documentation

### Transport Adaptation

Change: MCP protocol → Vercel AI SDK tool calling Unchanged: Everything else (adapter
logic, Nango integration, response formatting)

### Exa Special Case

Exa could be Tier 1 (Carmenta provides API key) rather than Tier 2 (user provides). This
would make deep research available to all users without setup.

Decision needed: Universal research capability (Tier 1) or user-specific API limits
(Tier 2)?

## Success Criteria

MVP success requires:

- Communication (Gmail, Slack)
- Calendar (Google Calendar)
- Knowledge (Notion)
- Development (GitHub)
- Storage (Google Drive)
- Tasks (ClickUp)
- Research (Exa)

These seven enable the digital chief of staff vision and core AI team capabilities.

## Next Steps

1. Port ServiceAdapter base class and utilities
2. Start with Gmail integration (highest value, well-tested)
3. Add Google Calendar (time awareness critical)
4. Follow with Notion, GitHub, Slack, Google Drive, ClickUp
5. Evaluate Exa as Tier 1 vs Tier 2
6. Build connection management UI
7. Implement dynamic tool registration based on user connections

---

**Decision Date**: 2024-12-09 **Status**: Proposed - awaiting approval
