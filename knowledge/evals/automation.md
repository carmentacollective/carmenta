# Automation & CI Pipeline

## What This Is

Automated quality monitoring that runs nightly against production, detects regressions,
and notifies when action is needed.

## Nightly Pipeline

```
Schedule: Daily at 2am UTC
Target: Production (carmenta.ai)
Duration: ~30 minutes
Cost: ~$15-25 per run

┌─────────────────────────────────────────┐
│ Nightly Eval Pipeline                   │
├─────────────────────────────────────────┤
│ 1. Run routing tests (existing)         │
│ 2. Run competitive benchmark (subset)   │
│ 3. Run bug monitors                     │
│ 4. Compare to baseline                  │
│ 5. Report results to Braintrust         │
│ 6. Check regression thresholds          │
│ 7. Create GitHub issue if regression    │
│ 8. Update baseline if improvement       │
└─────────────────────────────────────────┘
```

## Test Suites

### Routing Tests

Existing tests from `evals/routing.eval.ts`:

- Model selection validation
- Tool invocation checks
- Reasoning mode triggers
- User preference handling

### Competitive Subset

50 representative queries from Arena-Hard for nightly monitoring:

| Category   | Questions |
| ---------- | --------- |
| Reasoning  | 15        |
| Creative   | 10        |
| Real-world | 20        |
| Edge cases | 5         |

Full 750-question benchmark runs weekly.

### Bug Monitors

Tests that detect when upstream bugs are fixed, so workarounds can be removed.

Example: Anthropic thinking blocks + multi-turn + tools issue

```
Test pattern:
1. Run the exact failing case (bypass workaround)
2. If it succeeds → bug is fixed → notify
3. If it fails → bug persists → continue monitoring
```

On success: Create celebratory GitHub issue with:

- What bug was fixed
- Which workaround can now be removed
- Link to original issue

## Regression Detection

### Thresholds

| Metric           | Warning | Alert |
| ---------------- | ------- | ----- |
| Overall score    | -2%     | -5%   |
| Any category     | -3%     | -7%   |
| Routing accuracy | -1%     | -3%   |
| Tool invocation  | -2%     | -5%   |

### Response

**Warning**: Post to #engineering Slack, add to gap analysis queue

**Alert**: Create GitHub issue, tag on-call, block deploys if in CI

## GitHub Actions Integration

### Nightly Workflow

```yaml
name: Nightly Evals
on:
  schedule:
    - cron: "0 2 * * *" # 2am UTC daily
  workflow_dispatch: # Manual trigger

jobs:
  eval:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run eval suite
        run: pnpm dlx braintrust eval evals/nightly.eval.ts
        env:
          BRAINTRUST_API_KEY: ${{ secrets.BRAINTRUST_API_KEY }}
          TEST_USER_TOKEN: ${{ secrets.TEST_USER_TOKEN }}
          BASE_URL: https://carmenta.ai

      - name: Check regressions
        run: pnpm run eval:check-regression

      - name: Create issue if regression
        if: failure()
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.create({
              owner: context.repo.owner,
              repo: context.repo.repo,
              title: '[Eval Regression] Nightly eval detected quality drop',
              body: 'See Braintrust for details: ...',
              labels: ['eval-regression', 'urgent']
            })
```

### PR Integration

Run subset on every PR:

```yaml
name: PR Evals
on: pull_request

jobs:
  eval:
    runs-on: ubuntu-latest
    steps:
      - name: Run quick eval
        run: pnpm dlx braintrust eval evals/pr-quick.eval.ts

      - name: Post results as comment
        uses: braintrust-dev/github-action@v1
        with:
          api-key: ${{ secrets.BRAINTRUST_API_KEY }}
```

## Baseline Management

### Storage

Baselines stored in `knowledge/evals/baseline-benchmark.md` as a table:

| Metric    | Value | Date       | Commit |
| --------- | ----- | ---------- | ------ |
| Overall   | 78.4% | 2025-01-15 | abc123 |
| Reasoning | 82.1% | 2025-01-15 | abc123 |

### Update Policy

**Auto-update with notification**:

1. If nightly improves baseline by >1%, update automatically
2. Post notification to #engineering with improvement summary
3. Commit change via GitHub Actions bot
4. Human reviews in next standup

**Manual override**:

- Can set baseline manually if auto-update is wrong
- All baseline changes tracked in git history

## Notifications

### Slack Integration

```
Channel: #engineering

Nightly Success:
  ✅ Nightly evals passed
  Overall: 78.4% (baseline: 78.4%)
  Full report: [Braintrust link]

Regression Alert:
  🚨 Eval Regression Detected
  Overall: 75.1% (baseline: 78.4%, -3.3%)
  Failing category: Reasoning (-7%)
  GitHub issue: #123
  Braintrust: [link]

Bug Fixed:
  🎉 Upstream Bug Fixed!
  Anthropic thinking blocks now work in multi-turn!
  Workaround removal instructions: [link]
```

## Cost Management

| Run Type                  | Frequency | Est. Cost |
| ------------------------- | --------- | --------- |
| Nightly (50 queries)      | Daily     | ~$15      |
| Weekly full (750 queries) | Weekly    | ~$25      |
| PR quick (20 queries)     | Per PR    | ~$5       |
| Monthly                   | ~$500     |

Monitor costs in OpenRouter dashboard. Alert if monthly exceeds $750.

## Environment Variables

Required secrets in GitHub:

| Secret             | Purpose                |
| ------------------ | ---------------------- |
| BRAINTRUST_API_KEY | Experiment tracking    |
| TEST_USER_TOKEN    | Clerk JWT for API auth |
| OPENROUTER_API_KEY | Model access           |
| SLACK_WEBHOOK_URL  | Notifications          |
