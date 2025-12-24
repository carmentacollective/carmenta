# Carmenta Scripts

Utility scripts for evaluation analysis and continuous improvement.

## Gap Analysis

**Script:** `analyze-gaps.ts` **Command:** `pnpm eval:analyze-gaps`

AI-driven analysis of Braintrust evaluation results to identify failure patterns,
coverage gaps, and improvement opportunities.

### What It Does

The gap analyzer:

1. Fetches recent Braintrust experiments (configurable time window or count)
2. Aggregates test results and identifies failures
3. Uses an LLM to analyze patterns across failures
4. Generates a structured report with:
   - Priority issues (regressions, systematic failures)
   - Coverage gaps (untested capabilities)
   - Competitive position analysis
   - Recommended actions with priority levels

### Usage

```bash
# Analyze last 7 days (default)
pnpm eval:analyze-gaps

# Analyze last 14 days
pnpm eval:analyze-gaps --days 14

# Analyze last 5 experiments (ignoring time)
pnpm eval:analyze-gaps --experiments 5

# Create a GitHub issue with findings
pnpm eval:analyze-gaps --create-issue

# Show help
pnpm eval:analyze-gaps --help
```

### Requirements

**Environment Variables:**

- `BRAINTRUST_API_KEY` - Required. Your Braintrust API key for accessing experiment data
- `OPENROUTER_API_KEY` - Required. OpenRouter API key for LLM analysis
- `GITHUB_TOKEN` - Optional. Required only for `--create-issue` flag

**Dependencies:**

- Uses DeepSeek R1 (free tier) via OpenRouter for pattern analysis
- Fetches data from Braintrust REST API
- Creates GitHub issues via GitHub REST API

### How It Works

1. **Data Collection**
   - Fetches experiments from Braintrust project "Carmenta Routing"
   - Retrieves individual test events for each experiment
   - Filters by time window or experiment count

2. **Aggregation**
   - Identifies failures (score < 0.5 or error present)
   - Groups failures by category and tags
   - Calculates score distributions

3. **LLM Analysis**
   - Constructs a detailed prompt with failure patterns
   - Uses DeepSeek R1 to analyze patterns and propose fixes
   - Generates structured output following a predefined schema

4. **Reporting**
   - Formats analysis as a readable markdown report
   - Optionally creates a GitHub issue with findings
   - Outputs to console for immediate review

### Output Format

```
Weekly Gap Analysis - 2025-12-24
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Summary
- Experiments Analyzed: 5
- Total Tests: 247
- Total Failures: 12
- Failure Rate: 4.9%

Priority Issues
───────────────
1. Reasoning regression: -8% from baseline [HIGH]
   Pattern: Multi-step math proofs failing at step 3+
   Evidence: 12 failing examples consistently fail at step 3
   Proposed fix: Increase reasoning budget for math queries
   Confidence: high (12 failing examples)

Coverage Gaps
─────────────
- Audio transcription accuracy [HIGH]
  - No tests for multi-speaker scenarios
  - No tests for accented speech

Competitive Position
────────────────────
Winning: reasoning, tool integration
Tied: creative writing
Losing: current events (vs Perplexity)

Recommended Actions
───────────────────
🔴 [HIGH] Investigate reasoning regression - likely routing change
   Reasoning: 12 consistent failures indicate systematic issue

🟡 [MEDIUM] Add freshness check to web search results
   Reasoning: Current events queries returning stale data
```

### When to Run

**Weekly** - Regular health check of evaluation performance

**After major changes** - Routing updates, new tools, model changes

**On regression** - When automated checks detect performance drops

**Before releases** - Validate no critical regressions before deploy

### Integration with Workflow

The gap analyzer closes the continuous improvement loop:

```
Nightly Evals → Braintrust → Gap Analyzer → GitHub Issues → Fixes → Next Eval
```

1. Nightly evals run and store results in Braintrust
2. Gap analyzer identifies patterns in failures
3. Creates GitHub issues for proposed fixes
4. Team reviews and implements fixes
5. Next eval cycle validates improvements

### Configuration

Key constants in `analyze-gaps.ts`:

- `DEFAULT_DAYS = 7` - Default time window for analysis
- `DEFAULT_EXPERIMENTS = 10` - Default number of experiments to analyze
- `MIN_FAILURES_FOR_PATTERN = 3` - Minimum failures required for pattern analysis
- `GITHUB_OWNER = "carmentacollective"` - GitHub repository owner
- `GITHUB_REPO = "carmenta"` - GitHub repository name

### Example GitHub Issue

When using `--create-issue`, the analyzer creates an issue with:

- **Title:** `[Gap Analysis] 2025-12-24 - 3 issues identified`
- **Labels:** `gap-analysis`, `evaluation`, `automated`
- **Body:** Full analysis report with priority issues as checkboxes

### Limitations

- Requires at least 3 failures to identify patterns (configurable)
- Analysis quality depends on LLM performance
- GitHub issue creation requires `GITHUB_TOKEN` with repo write access
- Fetches up to 1000 events per experiment (Braintrust API limit)

### Future Enhancements

- Track fix implementation rate over time
- Compare gap analysis across time periods
- Auto-detect regression patterns without manual review
- Integration with incident management systems
- Baseline tracking for score distributions
