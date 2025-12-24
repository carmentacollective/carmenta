# Gap Analyzer

## What This Is

An AI-driven continuous improvement system. Analyzes accumulated Braintrust data,
identifies weaknesses, and proposes actionable fixes.

## The Closed Loop

```
Nightly Evals
      ↓
Braintrust stores results
      ↓
Gap Analyzer reviews data (weekly or on-demand)
      ↓
Identifies patterns: "We lose on X type of queries"
      ↓
Proposes fixes: "Add tool Y" or "Adjust routing for Z"
      ↓
Human reviews proposals
      ↓
Implement changes
      ↓
Next eval cycle validates improvement
```

## Analysis Dimensions

### Category Weaknesses

Identify categories where Carmenta underperforms:

- Reasoning: Are complex logic queries failing?
- Web search: Are current events queries stale?
- Tools: Are comparison tasks incomplete?
- Creative: Are open-ended responses generic?

### Query Pattern Analysis

Find specific query patterns that fail:

- "Queries containing 'compare X to Y' have 40% lower scores"
- "Multi-step reasoning queries regressed 12% this week"
- "Current events queries from past 24 hours fail 60%"

### Competitor Gaps

From competitive benchmarks:

- "ChatGPT wins on coding queries 70% of the time"
- "Perplexity wins on current events with citation quality"
- "Claude wins on nuanced ethical discussions"

### Coverage Gaps

Identify missing capabilities:

- "No test coverage for multi-language queries"
- "Tool X never invoked in benchmarks despite availability"
- "No tests exercise the new reasoning mode"

## Output Format

Gap analysis produces structured reports:

```
Weekly Gap Analysis - 2025-01-15
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Priority Issues
───────────────
1. Reasoning regression: -8% from baseline
   Pattern: Multi-step math proofs failing at step 3+
   Proposed fix: Increase reasoning budget for math queries
   Confidence: High (12 failing examples)

2. Web search staleness: Current events 48+ hours stale
   Pattern: Queries about "latest" or "today" return old data
   Proposed fix: Add freshness check to web search tool
   Confidence: Medium (5 examples, but consistent pattern)

Coverage Gaps
─────────────
- No tests for: Audio transcription accuracy, PDF table extraction
- Tools untested: compareOptions with 4+ items

Competitive Position
────────────────────
- Winning: Reasoning (except regression above), tool integration
- Tied: Creative writing, general knowledge
- Losing: Current events (vs Perplexity), code execution (vs ChatGPT)

Recommended Actions
───────────────────
1. [HIGH] Investigate reasoning regression - likely routing change
2. [MED] Add freshness scoring to web search results
3. [LOW] Add test coverage for audio transcription
```

## Trigger Options

### Scheduled

- **Weekly**: Full analysis of accumulated data
- **Post-nightly**: Quick check for critical regressions

### On-Demand

- After major changes (routing updates, new tools)
- Before product launches
- When investigating user complaints

### Automated

- Triggered by regression detection in nightly runs
- Triggered when competitive position changes significantly

## Integration with GitHub

Gap analyzer can create GitHub issues for proposed fixes:

```
Title: [Gap Analysis] Reasoning regression detected

Body:
Analysis Date: 2025-01-15
Severity: High
Pattern: Multi-step math proofs failing at step 3+

Evidence:
- Baseline: 78% accuracy on reasoning category
- Current: 70% accuracy (-8%)
- 12 specific failing examples in Braintrust

Proposed Fix:
Increase reasoning budget for queries containing math/proof patterns

Labels: gap-analysis, regression, reasoning
```

## Data Requirements

For effective gap analysis, ensure Braintrust captures:

- All benchmark scores with category tags
- Response text for failure analysis
- Tool invocation logs
- Routing decisions and explanations
- Latency and cost metrics

## Human-in-the-Loop

Gap analyzer proposes, humans decide:

- Proposals tagged with confidence level
- Evidence linked for verification
- No automatic changes without review
- Feedback loop: mark proposals as "implemented" or "rejected with reason"

## Success Metrics

The gap analyzer is working when:

- Regressions detected before user complaints
- Proposed fixes have >60% implementation rate
- Categories that receive fixes show improvement in next cycle
- Time from gap detection to fix deployment decreases
