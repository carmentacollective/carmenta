# Onboarding

First-run experience and user profile creation. Collects goals, preferences,
communication style. Sets up initial AI team configuration. The AI Concierge guides
users through setup and demonstrates capabilities.

## Why This Exists

First impressions matter. Users who have a great first five minutes become long-term
users. Users who bounce in confusion never come back.

Onboarding has to accomplish multiple goals: collect enough information to personalize
the experience, demonstrate what Carmenta can do, set expectations, and get users to
value quickly. This is a delicate balance - too long and users abandon, too short and
the AI doesn't have enough context to be useful.

The Concierge approach means onboarding is a conversation, not a form. The AI asks
questions, responds to answers, builds understanding naturally.

## Core Functions

### Profile Collection

Gather information to personalize the experience:
- Professional context (role, industry, company, projects)
- Goals and priorities (what they want to accomplish)
- Communication preferences (tone, verbosity, expertise level)
- Relevant tools and services they use

### Capability Demonstration

Show users what Carmenta can do:
- Interactive examples of key capabilities
- Guided first tasks that deliver immediate value
- Showcase differentiated features (memory, voice, AG-UI)
- Build understanding of the AI team concept

### Service Connection

Set up integrations during onboarding:
- Prioritized OAuth flows for high-value services
- Explain what access enables
- Handle connection failures gracefully
- Make connections optional but encouraged

### AI Team Introduction

Set up the relationship with the AI team:
- Introduce the Digital Chief of Staff
- Explain how the team works together
- Set expectations for autonomy and communication
- Gather preferences for team behavior

## Integration Points

- **Memory**: Initial profile population
- **Concierge**: Onboarding is a conversation through the Concierge
- **Service Connectivity**: OAuth flows during setup
- **Interface**: Onboarding UI surfaces
- **AI Team**: Team introduction and configuration

## Success Criteria

- Users complete onboarding and understand core value
- Enough information collected for meaningful personalization
- Time to first valuable interaction is short
- Users connect at least one high-value service
- Abandonment rate is low

---

## Open Questions

### Architecture

- **Conversation vs. form**: How much is conversational AI vs. structured UI? What's
  the right balance?
- **Progressive disclosure**: Do we collect everything upfront or learn over time? What's
  essential for first session?
- **Skip and return**: Can users skip onboarding and come back? How do we handle
  incomplete profiles?
- **State management**: How do we track onboarding progress? Resume interrupted sessions?

### Product Decisions

- **Required vs. optional**: What information is required to proceed? What can be
  skipped?
- **First task**: What's the ideal first interaction that demonstrates value? Quick win
  that showcases capabilities?
- **Service priority**: Which integrations do we push during onboarding? In what order?
- **Length target**: How long should onboarding take? What's the right depth vs. speed
  tradeoff?

### Technical Specifications Needed

- Onboarding flow definition (steps, branches, completion criteria)
- Profile schema for initial collection
- Integration with Memory for profile storage
- Analytics events for funnel tracking
- A/B testing framework for onboarding optimization

### Research Needed

- Study best-in-class onboarding experiences (Notion, Linear, Duolingo)
- Analyze onboarding patterns for AI products specifically
- Research conversational onboarding vs. traditional forms
- Review progressive profiling techniques
- Benchmark onboarding metrics (completion rate, time, value-to-first-action)
