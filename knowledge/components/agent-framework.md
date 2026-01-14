# AI Team Framework

The common infrastructure, system prompt, and best practices that wrap all AI Team
members. This is the "harness" that ensures every agent runs with consistent quality,
error handling, and observability.

## Design Philosophy

**Agent Notes, Not Just Memory**: Agents take notes for themselves that persist between
runs. These notes are visible to users - a communication channel from the agent to its
future self AND to the human. Separate from user-editable content.

**Infrastructure Handles the Hard Stuff**: Individual job prompts focus on the task. The
framework handles context loading, error recovery, note management, and observability.
Users shouldn't need to prompt-engineer best practices.

**Fail Gracefully, Learn Continuously**: Agents should recognize repeated failures,
distinguish transient from permanent errors, and surface problems rather than silently
retry forever.

## Real-World Use Cases

These five scenarios drive the framework design. Each represents a distinct pattern with
different failure modes and memory needs.

### Use Case 1: Email Steward

**What it does**: Triages inbox daily, flags important messages, drafts responses,
tracks commitments.

**Schedule**: Weekdays at 7am, before user starts work.

**Memory needs**:

- `lastProcessedMessageId`: Don't re-process old emails
- `knownSenders`: VIP list, spam patterns learned over time
- `pendingFollowUps`: Commitments the user made that need tracking
- `draftPatterns`: User's preferred response style for common situations

**Failure scenarios**:

- Gmail API rate limited → transient, retry with backoff
- OAuth token expired → permanent until user re-auths, notify user
- User deleted their Gmail integration → permanent, pause job and notify
- No new emails → success (not an error), just note "0 new messages"

**User vs Agent content**:

- **User controls**: VIP sender list, response templates, priority rules
- **Agent controls**: lastProcessedMessageId, learned patterns, draft statistics

---

### Use Case 2: Competitor Monitor

**What it does**: Watches HackerNews, Twitter, news sites for mentions of competitors.
Weekly digest of what's happening in the space.

**Schedule**: Sundays at 6pm, prep for Monday planning.

**Memory needs**:

- `lastScanTimestamps`: Per-source last check time
- `seenArticleHashes`: Dedup already-surfaced content
- `signalStrengthLearnings`: Which sources yield valuable signals
- `falsePositivePatterns`: Mentions to ignore (e.g., "Competitor X sucks")

**Failure scenarios**:

- HackerNews API down → transient, skip this source, note in summary
- No mentions found → success, report "quiet week"
- Consistent zero results for 4 weeks → surface to user "should we adjust keywords?"

**User vs Agent content**:

- **User controls**: Competitor names, keywords, which sources to monitor
- **Agent controls**: scan timestamps, seen hashes, source quality scores

---

### Use Case 3: Daily Briefing

**What it does**: Morning summary of calendar, priorities from KB, overnight signals,
weather.

**Schedule**: Daily at 6:30am in user's timezone.

**Memory needs**:

- `lastBriefingTopics`: Avoid repeating same news two days in a row
- `userFeedback`: Did user engage with briefing? Which sections?
- `weatherPreferences`: Does user care about weather? Commute info?
- `briefingLength`: User prefers short vs detailed

**Failure scenarios**:

- Calendar API unavailable → include note "couldn't load calendar", continue with rest
- KB empty/no priorities → note "no priorities set", suggest user add some
- All sources fail → minimal briefing with apology, don't send empty notification

**User vs Agent content**:

- **User controls**: Briefing sections enabled, preferred length, timezone
- **Agent controls**: topic history, engagement metrics, source reliability scores

---

### Use Case 4: Meeting Prep Agent

**What it does**: Before each meeting, prepares context on attendees, previous
discussions, relevant materials.

**Schedule**: Event-triggered, 30 minutes before each calendar meeting.

**Memory needs**:

- `attendeeProfiles`: Cached info about frequent contacts
- `previousMeetingNotes`: What was discussed last time with this group
- `preparedMeetings`: Don't re-prep same meeting if triggered twice
- `userPreferences`: How much prep detail does user want?

**Failure scenarios**:

- No attendee info available → note "new contacts, no history"
- Previous meeting notes empty → note "first meeting with this group"
- Meeting cancelled after prep started → complete anyway (might be rescheduled)
- Back-to-back meetings → prioritize, maybe skip prep for internal standups

**User vs Agent content**:

- **User controls**: Meeting types to prep for, detail level, which calendars
- **Agent controls**: attendee cache, meeting history, prep timing optimization

---

### Use Case 5: Research Digest

**What it does**: Tracks topics user cares about, produces weekly synthesis of new
developments.

**Schedule**: Fridays at 4pm, end-of-week reading.

**Memory needs**:

- `topicEvolution`: How has each topic developed over time?
- `sourcesSearched`: Which sources were checked, when
- `citedPapers`: Papers/articles already surfaced (dedup)
- `userInterestSignals`: Which topics get engagement, which get ignored?

**Failure scenarios**:

- Academic API down → use cached results, note "using last week's data"
- Topic produces zero results → note "nothing new on X this week"
- User hasn't read last 3 digests → surface "should we pause this digest?"

**User vs Agent content**:

- **User controls**: Topics, sources, digest format, delivery time
- **Agent controls**: search history, citation tracking, engagement metrics

---

## Framework Architecture

### Data Model: Separating Agent Notes from User Config

```sql
-- Extend scheduled_jobs table (backward compatible)
ALTER TABLE scheduled_jobs ADD COLUMN IF NOT EXISTS agent_notes TEXT DEFAULT '';
ALTER TABLE scheduled_jobs ADD COLUMN IF NOT EXISTS user_config JSONB DEFAULT '{}';

-- agent_notes: Markdown text. Agent-controlled, visible to user (read-only in UI)
-- user_config: User-controlled, agent reads but doesn't modify
-- memory: Legacy field, gradually migrate to agent_notes
```

**agent_notes** - A markdown document the agent maintains, like a team member's working
notes:

```markdown
## Status

Last run: Jan 14, 2026 at 7:02am — ✅ Success Total runs: 47 | Successes: 45 Currently:
Active

## What I'm Tracking

- Last processed email: msg_abc123 (Jan 14, 7:00am)
- Pending follow-ups: 3 (see below)
- VIP patterns learned: 12 senders identified as important

## Recent Activity

**Jan 14**: Processed 23 new messages. Flagged 4 as important (2 from VIPs, 2 mentioning
"urgent"). Drafted 2 responses.

**Jan 13**: Quiet day, only 8 messages. No drafts needed.

**Jan 12**: Gmail API was rate limited at 7:05am. Completed partial run (processed 15 of
31 messages). Finished remaining on Jan 13.

## Things I've Learned

- Sarah from Legal always needs responses within 4 hours (noticed Jan 8)
- Emails with "FYI" in subject rarely need action (observed over 20+ instances)
- Monday mornings have 2-3x normal volume

## Pending Items

1. Follow up on contract review (promised response by Jan 15)
2. Schedule call with vendor (mentioned in Jan 12 email)
3. Send quarterly report draft (requested Jan 10)

## Issues to Surface

- Gmail connection was flaky Jan 12. If it happens again, may need re-auth.
```

This format is readable by humans AND LLMs. No parsing required. The agent writes what
matters, the user can read it like any team member's notes.

**user_config** schema:

```typescript
interface UserConfig {
  // User preferences the agent respects
  preferences: Record<string, unknown>;

  // User-defined rules and overrides
  rules: Array<{
    name: string;
    condition: string;
    action: string;
  }>;

  // User's notes to the agent (guidance, context)
  userNotes?: string;
}
```

### Common System Prompt

Every AI Team member receives this wrapper around their specific job prompt:

```markdown
<ai-team-framework>
You are an AI Team member executing a scheduled task for {userName}. You run
autonomously but your work is visible - take notes, surface problems, and learn.

## Your Identity

- Job: {jobName}
- Schedule: {scheduleDisplayText}
- Total runs: {totalRuns} | Successes: {totalSuccesses}
- Last run: {lastRunAt} ({lastRunOutcome})

## Your Notes (from previous runs)

<agent-notes>
{agentNotesFormatted}
</agent-notes>

## User's Configuration

<user-config>
{userConfigFormatted}
</user-config>

## User's Notes to You

<user-guidance>
{userNotes || "No specific guidance provided."}
</user-guidance>

## Your Task

<task>
{jobPrompt}
</task>

## Framework Guidelines

### Before You Start

1. Review your notes from previous runs
2. Check if you've seen this exact situation before
3. Load any context you need from the Knowledge Base
4. If this is your first run, note that - you're establishing baselines

### During Execution

1. Focus on the specific task - don't expand scope
2. Use available tools thoughtfully
3. If something seems wrong, investigate briefly before acting
4. Track any new information worth remembering

### When Things Go Wrong

1. **Transient errors** (rate limits, timeouts, service unavailable):
   - Note the error, continue with other work if possible
   - Don't fail the whole run for one unavailable source

2. **Permanent errors** (auth expired, service disconnected, invalid config):
   - Note the specific issue
   - Complete what you can
   - Flag clearly in your summary for user attention

3. **Repeated failures** (same error multiple times):
   - If you've failed for the same reason 3+ times, escalate
   - Don't silently keep trying the same thing
   - Suggest what might fix it

### Finishing Up

Use the `complete` tool with:

- **summary**: What you accomplished (or couldn't)
- **notes**: Your updated notes document—include everything worth keeping
- **notifications**: Anything the user should know NOW (use sparingly)

### Note-Taking Philosophy

You keep notes like any good team member would. They're visible to the user—think of
them as your working document that anyone on the team can read.

**Write for humans first.** Your notes should make sense to someone reading them cold.
Use natural language, dates, and context. No JSON blobs or cryptic IDs without
explanation.

**Structure emerges from content.** You might use sections like:

- Status (how things are going)
- What you're tracking (the state you need to remember)
- Recent activity (what happened in recent runs)
- Things you've learned (patterns that help you do better)
- Issues to surface (things the user should know)

But don't force it. If a section doesn't apply, skip it. If you need a different
section, add it. The structure should serve clarity, not compliance.

**Notes accumulate, then get pruned.** Add new information freely. Periodically clean up
old entries that no longer matter. Keep it to what someone would actually want to read.

Good notes answer: "If a new team member took over this job, what would they need to
know?"

</ai-team-framework>
```

### Complete Tool Schema (Extended)

```typescript
const completeToolSchema = z.object({
  summary: z
    .string()
    .describe("What you accomplished. Be specific about outcomes, not process."),

  notifications: z
    .array(
      z.object({
        title: z.string(),
        body: z.string(),
        priority: z.enum(["low", "normal", "high", "urgent"]),
      })
    )
    .optional()
    .describe("Only for things the user needs to know NOW. Use sparingly."),

  notes: z
    .string()
    .optional()
    .describe(
      "Your updated notes document (markdown). Include everything worth keeping - " +
        "this replaces your previous notes entirely. Write for humans AND your future self."
    ),

  // Legacy field - still supported for backward compatibility
  memoryUpdates: z
    .record(z.string(), z.unknown())
    .optional()
    .describe("DEPRECATED: Use notes field instead"),

  // Explicit status for framework handling
  status: z
    .enum(["success", "partial", "failed", "blocked"])
    .default("success")
    .describe(
      "success=all done, partial=some worked, failed=nothing worked, blocked=need user action"
    ),

  blockedReason: z
    .string()
    .optional()
    .describe("If blocked, what does the user need to do?"),
});
```

The `notes` field is the full markdown document. The agent rewrites it each run, keeping
what matters, updating what changed, and pruning what's stale. This is simpler than
patch-based updates and ensures the notes stay coherent.

### Error Handling Methodology

Not hardcoded thresholds - context-aware escalation based on error patterns.

```typescript
interface ErrorAnalysis {
  errorType: "transient" | "permanent" | "unknown";
  shouldRetry: boolean;
  shouldEscalate: boolean;
  escalationReason?: string;
  suggestedAction?: string;
}

function analyzeErrorPattern(
  currentError: Error,
  recentErrors: AgentNotes["recentErrors"],
  jobContext: { totalRuns: number; consecutiveFailures: number }
): ErrorAnalysis {
  const errorType = classifyError(currentError);
  const sameErrorRecently = recentErrors.filter(
    (e) =>
      e.errorCode === extractErrorCode(currentError) && isWithinHours(e.occurredAt, 24)
  );

  // Pattern 1: New job, first few runs failing
  // Be patient - might be setup issues
  if (jobContext.totalRuns < 5 && jobContext.consecutiveFailures < 3) {
    return {
      errorType,
      shouldRetry: errorType === "transient",
      shouldEscalate: errorType === "permanent",
      suggestedAction:
        errorType === "permanent"
          ? "Check job configuration - this is a new job and may need adjustment"
          : undefined,
    };
  }

  // Pattern 2: Established job, sudden failures
  // Something changed - escalate quickly
  if (
    jobContext.totalRuns > 10 &&
    jobContext.consecutiveFailures >= 2 &&
    wasRecentlySuccessful(recentErrors)
  ) {
    return {
      errorType,
      shouldRetry: false,
      shouldEscalate: true,
      escalationReason:
        "This job was working but started failing. Something may have changed.",
      suggestedAction: "Review recent changes to connected services or configurations",
    };
  }

  // Pattern 3: Same error repeating
  // Don't bang head against wall
  if (sameErrorRecently.length >= 2) {
    return {
      errorType,
      shouldRetry: false,
      shouldEscalate: true,
      escalationReason: `Same error (${extractErrorCode(currentError)}) occurred ${sameErrorRecently.length + 1} times in 24 hours`,
      suggestedAction: suggestFixForError(currentError),
    };
  }

  // Pattern 4: Transient error, first occurrence
  // Normal - just retry
  if (errorType === "transient" && sameErrorRecently.length === 0) {
    return {
      errorType,
      shouldRetry: true,
      shouldEscalate: false,
    };
  }

  // Pattern 5: Unknown error
  // Log it, don't escalate immediately, but track
  return {
    errorType: "unknown",
    shouldRetry: false,
    shouldEscalate: jobContext.consecutiveFailures >= 3,
    escalationReason:
      jobContext.consecutiveFailures >= 3
        ? "Multiple unknown errors - may need investigation"
        : undefined,
  };
}
```

### Escalation Actions

When escalation is needed:

```typescript
async function handleEscalation(
  job: ScheduledJob,
  analysis: ErrorAnalysis,
  run: JobRun
): Promise<void> {
  // 1. Pause the job (don't keep failing)
  await pauseJob(job.id, {
    reason: analysis.escalationReason,
    pausedAt: new Date(),
    canAutoResume: analysis.errorType === "transient",
  });

  // 2. Create high-priority notification
  await createJobNotification({
    userId: job.userId,
    jobId: job.id,
    runId: run.id,
    title: `${job.name} needs attention`,
    body:
      analysis.escalationReason +
      (analysis.suggestedAction
        ? `\n\nSuggested action: ${analysis.suggestedAction}`
        : ""),
    priority: "high",
  });

  // 3. Log for observability
  logger.warn("Job escalated", {
    jobId: job.id,
    jobName: job.name,
    reason: analysis.escalationReason,
    errorType: analysis.errorType,
    consecutiveFailures: job.consecutiveFailures,
  });
}
```

### Auto-Resume Logic

For transient errors that resolve themselves:

```typescript
async function checkAutoResume(job: ScheduledJob): Promise<boolean> {
  if (!job.pausedAt || !job.canAutoResume) return false;

  // Try a health check based on error type
  const lastError = job.recentErrors[0];

  switch (lastError?.errorCode) {
    case "RATE_LIMITED":
      // Wait at least 1 hour before auto-resume
      if (hoursSince(job.pausedAt) < 1) return false;
      break;

    case "SERVICE_UNAVAILABLE":
      // Check if service is back
      const isAvailable = await checkServiceHealth(lastError.service);
      if (!isAvailable) return false;
      break;

    case "OAUTH_EXPIRED":
      // Check if user re-authenticated
      const hasValidAuth = await checkIntegrationAuth(job.userId, lastError.service);
      if (!hasValidAuth) return false;
      break;

    default:
      return false; // Unknown errors don't auto-resume
  }

  // Service looks healthy, resume the job
  await resumeJob(job.id);
  return true;
}
```

## Lifecycle Scenarios

### Scenario A: First Run (Cold Start)

```
1. Job created by user
2. Framework initializes agent_notes as empty string
3. System prompt tells agent: "This is your first run. No previous notes."
4. Agent executes task, writes initial notes:
   "## Status
    First run: Jan 14, 2026 — ✅ Success

    ## What I'm Tracking
    - Last processed: [whatever applies to this job]

    ## Notes
    Getting started. Established baseline for [task specifics]."
5. Framework saves notes regardless of success/failure
```

### Scenario B: Steady State (Normal Operation)

```
1. Cron triggers job
2. Framework loads agent_notes and user_config
3. Agent sees its history: "Run 47, last success 6 hours ago"
4. Agent executes task, updates notes
5. Framework merges note updates, records run in job_runs
6. Next run in {schedule}
```

### Scenario C: Transient Failure Recovery

```
1. Run fails: Gmail API rate limited
2. Framework classifies: transient error, first occurrence
3. Agent notes: "Gmail rate limited at 7:02am"
4. Run marked as failed, but job stays active
5. Next scheduled run succeeds
6. Framework notes recovery in learnings
```

### Scenario D: Repeated Failure Escalation

```
1. Run 1 fails: Gmail OAuth expired
2. Run 2 fails: Same error
3. Run 3 fails: Same error - triggers escalation
4. Framework:
   - Pauses job
   - Creates high-priority notification
   - Notes: "Paused due to OAuth expiration"
5. User re-authenticates Gmail
6. Framework detects valid auth, auto-resumes job
7. Run 4 succeeds, framework notes recovery
```

### Scenario E: Partial Success

```
1. Daily briefing runs
2. Calendar loads successfully
3. Weather API fails (transient)
4. KB priorities load successfully
5. Agent completes with status: "partial"
6. Summary: "Briefing ready. Note: Weather unavailable due to service issue."
7. Framework marks partial success, no escalation (transient, first time)
```

### Scenario F: User Configuration Change

```
1. User updates user_config: adds new VIP sender
2. Next run loads new config
3. Agent sees change, notes: "Config updated - added VIP: boss@company.com"
4. Agent applies new rule immediately
5. Future runs reflect the change
```

## Integration with Existing Systems

### Knowledge Base Access

Agents can read from KB during execution:

```typescript
// In agent execution context
const tools = {
  ...standardTools,
  readKnowledge: tool({
    description: "Read from user's Knowledge Base",
    parameters: z.object({
      path: z.string().describe("Document path, e.g., 'profile.priorities'"),
    }),
    execute: async ({ path }) => {
      return await getDocument(context.userId, path);
    },
  }),
  searchKnowledge: tool({
    description: "Search user's Knowledge Base",
    parameters: z.object({
      query: z.string().describe("Search query"),
      limit: z.number().default(5),
    }),
    execute: async ({ query, limit }) => {
      return await searchDocuments(context.userId, query, limit);
    },
  }),
};
```

### Service Integrations

Agents use MCP Hubby for service access:

```typescript
// Available integrations injected into context
const availableServices = await getUserIntegrations(context.userId);

// Agent sees: "You have access to: Gmail, Google Calendar, Notion, Slack"
// Framework handles auth, agent just calls tools
```

### Notifications

Multi-channel delivery based on user preferences:

```typescript
async function deliverNotification(
  notification: JobNotification,
  user: User
): Promise<void> {
  const channels = await getNotificationPreferences(user.id);

  await Promise.all([
    channels.push && sendPushNotification(notification),
    channels.email &&
      notification.priority !== "low" &&
      sendEmailNotification(notification),
    // Always create in-app notification
    createInAppNotification(notification),
  ]);
}
```

## Success Metrics

### Framework Health

- **Escalation rate**: % of runs that escalate (target: <5%)
- **Auto-resume success**: % of paused jobs that auto-resume (target: >70%)
- **False escalation rate**: Escalations that didn't need user action (target: <10%)

### Agent Quality

- **Task completion rate**: Success + partial / total runs (target: >95%)
- **Note usefulness**: Do agents reference their notes? (qualitative)
- **Learning accumulation**: Are learnings growing appropriately? (not too fast, not
  stale)

### User Experience

- **Notification fatigue**: Notifications per week per user (target: <20)
- **Action-to-notification ratio**: % of notifications that lead to user action
- **Job churn**: Jobs created then quickly disabled (indicates poor setup)

## Open Questions

### Note Visibility UX

How do users view and interact with agent notes?

- Read-only view in job detail page?
- Ability to "clear" notes and let agent restart fresh?
- Export notes for debugging?

### Learning Persistence

How long do learnings persist?

- Forever? (could accumulate noise)
- Decay over time? (might lose valuable patterns)
- User-triggered cleanup?

### Cross-Job Learning

Should agents learn from each other?

- Email Steward learns sender reputation → share with Meeting Prep?
- Global patterns vs job-specific patterns?

### User Config Validation

How do we validate user_config changes?

- Immediate validation on save?
- Dry-run on next execution?
- Schema enforcement vs flexible?

## References

### Industry Research

- [Temporal for Agentic AI](https://temporal.io/blog/build-resilient-agentic-ai-with-temporal) -
  Durable execution for long-running agents (our chosen approach)
- [ChatGPT Tasks](https://help.openai.com/en/articles/10291617-scheduled-tasks-in-chatgpt) -
  OpenAI's scheduled agent approach
- [A-MEM Framework](https://arxiv.org/abs/2512.13564) - Self-organizing memory notes for
  agents
- [Memory in AI Agents Survey](https://github.com/Shichun-Liu/Agent-Memory-Paper-List) -
  Academic survey of agent memory approaches

### Carmenta Context

- [AI Team Architecture](ai-team/spec.md) - Execution infrastructure
- [Scheduled Agents](scheduled-agents.md) - Use cases and patterns
- [Agent Robustness](agent-robustness.md) - Error handling and observability
