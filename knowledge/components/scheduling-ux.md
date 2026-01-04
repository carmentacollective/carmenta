# Scheduling UX

Human-friendly scheduling for AI team members. Intent over implementation. Natural
language over cron syntax. Complexity hidden from users, accessible to developers.

## The Core Problem

Cron syntax is hostile to humans. `0 9-17 * * 1-5` means nothing to someone who just
wants "business hours, Austin time." We have a translation layer (LLM-generated
schedules) but expose the implementation in the edit form. Users shouldn't need to learn
a 1975 Unix syntax to schedule their AI team.

## Current State

Our hire flow already gets this right:

```typescript
// From hire/page.tsx:30-38
interface Playbook {
  schedule: {
    cron: string; // "0 9 * * 1-5" (internal)
    displayText: string; // "Weekdays at 9am" (user-facing)
  };
}
```

The LLM generates both the cron expression and human-readable text. Users see
`displayText` in the confirmation card. We auto-detect timezone from the browser.

The problem: `edit-form.tsx` shows raw cron in a text input. The timezone uses a
full-width `<select>` dropdown.

## What Leaders Do

### Notion Recurring Tasks

- Visual picker: Daily, Weekly, Monthly, Yearly
- Interval selection: "every N days/weeks/months"
- Anchor options: specific weekdays, "last day of month"
- Never exposes cron syntax
- [Source: Notion Recurring Tasks Guide](https://super.so/blog/notion-recurring-tasks-complete-guide-2023)

### Calendly

- Consolidated day + time selection on one screen
- Familiar monthly calendar view with visual availability
- Preset durations (15min, 30min, 60min)
- Time zone shown inline, not as a separate field
- [Source: Calendly Blog](https://calendly.com/blog/new-scheduling-page-ui)

### ChatGPT Scheduled Tasks

- Pure natural language: "Daily at 7 AM"
- System parses intent and translates to execution
- No configuration UI at all for schedule definition
- [Source: OpenAI Help Center](https://help.openai.com/en/articles/10291617-scheduled-tasks-in-chatgpt)

### Reclaim

- Smart presets: "Every morning", "Business hours", "End of week"
- Automatic rescheduling when conflicts arise
- Buffer and travel time settings
- [Source: HyperWrite AI Scheduling Guide](https://www.hyperwriteai.com/blog/best-ai-scheduling-assistant)

## Key Patterns

### Intent-Based Scheduling (Emerging Standard)

Users express **what** they want, not **how** to encode it:

- "Every weekday morning"
- "Business hours, Austin time"
- "Weekly on Monday"
- "First of each month"

The system translates intent to cron internally. This is exactly what our hire flow
does - the gap is we don't carry this pattern into editing.

### Display Text as Primary, Cron as Implementation

Store both, show only the human version:

```typescript
interface ScheduleConfig {
  // What users see and interact with
  displayText: string; // "Weekdays at 9am CT"

  // What Temporal executes (hidden by default)
  cronExpression: string; // "0 9 * * 1-5"
  timezone: string; // "America/Chicago"
}
```

### Time Zone Handling

**Modern pattern**: Inline, compact, contextual

| Approach             | Example                            | Space         | Clarity                |
| -------------------- | ---------------------------------- | ------------- | ---------------------- |
| Full dropdown        | `<select>America/Chicago</select>` | 🔴 Full width | Clear but heavy        |
| Abbreviated inline   | `9am CT`                           | 🟢 Minimal    | Familiar shorthand     |
| User's local default | `9am (your time)`                  | 🟢 Minimal    | Zero config needed     |
| Expandable detail    | `9am CT ▾` → full picker           | 🟢 Minimal    | Progressive disclosure |

Best practice: Default to user's local timezone (auto-detected), show abbreviated inline
(`CT`, `PT`, `UTC`), allow expansion for explicit selection.

### Presets for Common Patterns

**Table stakes presets:**

- Every morning (9am)
- Every weekday morning (9am Mon-Fri)
- Weekly on Monday (9am Monday)
- Monthly on the 1st
- Hourly / Every N hours

**Differentiating presets:**

- Business hours (9am-5pm Mon-Fri)
- Start of week (Monday 8am)
- End of week (Friday 4pm)
- Overnight (11pm-6am)
- Custom intervals with natural language

### Power User Access

We support `developerMode` in user preferences (`lib/db/schema.ts:177`). When enabled,
show the cron expression as a collapsible detail - but never as the primary interface.

```typescript
// Pseudo-implementation
{developerMode && (
    <details className="text-xs text-foreground/50">
        <summary>Technical details</summary>
        <code>{schedule.cronExpression}</code>
    </details>
)}
```

## Architecture Decisions

### ✅ Decision: LLM for Natural Language → Cron

We already use LLMs to generate cron from user descriptions in the hire flow. Extend
this to editing. When users type "every morning at 7am Austin time", send to LLM:

```json
{
  "intent": "every morning at 7am Austin time",
  "output": {
    "displayText": "Every day at 7am CT",
    "cronExpression": "0 7 * * *",
    "timezone": "America/Chicago"
  }
}
```

### ✅ Decision: chrono-node for Lightweight Parsing

For simple edits (time changes, day selection), use
[chrono-node](https://github.com/wanasit/chrono) for client-side parsing. Falls back to
LLM for complex cases.

Chrono-node capabilities:

- Parses "tomorrow at 3pm", "next Monday", "every Tuesday"
- Timezone aware with configurable defaults
- 2.9.0 current, TypeScript support, no dependencies
- Works in browser and Node.js

### ✅ Decision: Store Both Forms

Database already stores `scheduleCron` and `timezone`. Add `scheduleDisplayText`:

```sql
ALTER TABLE scheduled_jobs ADD COLUMN schedule_display_text TEXT;
```

This is generated on create/update and displayed in UI. Regenerate if cron changes.

## Gap Assessment

### Achievable Now

- Replace cron input with natural language input
- Show displayText instead of raw cron
- Add common schedule presets
- Compact timezone display (abbreviated inline)
- Developer mode toggle for cron visibility

### Emerging (6-12 months)

- LLM-powered schedule suggestions based on job type
- "Business hours" as a first-class concept (working hours per user)
- Conflict detection with calendar integrations
- Smart rescheduling when schedules overlap

### Aspirational

- Predictive scheduling ("this usually takes 10 minutes, should run before your
  standup")
- Cross-timezone coordination for team schedules
- Learning from user behavior to suggest optimal times

## Implementation Path

### Phase 1: Display Layer (Immediate)

1. Add `scheduleDisplayText` column to `scheduled_jobs`
2. Generate display text when creating/updating jobs (LLM already does this)
3. Replace cron input in edit form with displayText display
4. Add "Edit schedule" button that opens natural language input
5. Compact timezone: show abbreviation inline (e.g., "7am CT")

### Phase 2: Smart Input

1. Add preset buttons: "Every morning", "Weekdays", "Weekly", "Monthly"
2. Natural language input with chrono-node for simple cases
3. LLM fallback for complex expressions
4. Preview: "This will run at [next 3 times]"

### Phase 3: Developer Mode

1. Check `developerMode` from user preferences
2. Show collapsible cron expression for power users
3. Allow direct cron editing in developer mode only

## UI Components Needed

### ScheduleDisplay

Shows human-readable schedule with compact timezone:

```
Every weekday at 9am CT
```

### ScheduleEditor

Modal/inline editor with:

- Preset buttons (common patterns)
- Natural language input
- Next run preview
- Timezone selector (abbreviated, expandable)

### SchedulePresets

Quick-select grid:

```
┌─────────────┬─────────────┬─────────────┐
│ Every       │ Weekday     │ Weekly      │
│ morning     │ mornings    │ Monday      │
├─────────────┼─────────────┼─────────────┤
│ Monthly     │ Hourly      │ Custom...   │
│ 1st         │             │             │
└─────────────┴─────────────┴─────────────┘
```

## Integration Points

- **Scheduled Agents**: This spec covers the UX layer; execution infrastructure covered
  in `scheduled-agents.md`
- **User Preferences**: `developerMode` flag controls cron visibility
- **Temporal**: Cron expressions passed to Temporal schedules unchanged
- **Concierge**: Could suggest schedules based on job type

## Success Criteria

- Users can set up and modify schedules without seeing cron syntax
- "Business hours, Austin time" works as expected
- Timezone takes minimal UI space (abbreviated inline)
- Developers can access cron when needed
- Schedule changes feel instant (optimistic UI with LLM parsing)

## Sources

- [Time Picker UX Best Practices 2025](https://www.eleken.co/blog-posts/time-picker-ux)
- [Notion Recurring Tasks Guide](https://super.so/blog/notion-recurring-tasks-complete-guide-2023)
- [Calendly Scheduling Page UI](https://calendly.com/blog/new-scheduling-page-ui)
- [ChatGPT Scheduled Tasks](https://help.openai.com/en/articles/10291617-scheduled-tasks-in-chatgpt)
- [chrono-node NLP Parser](https://github.com/wanasit/chrono)
- [AI Scheduling Assistants Overview](https://www.hyperwriteai.com/blog/best-ai-scheduling-assistant)
