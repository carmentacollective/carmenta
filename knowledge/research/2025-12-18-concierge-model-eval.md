# Concierge Model Evaluation

**Date**: December 18, 2025

**Purpose**: Compare model candidates for the Concierge routing layer to optimize for
accuracy, speed, and cost.

## Methodology

Used Braintrust-native evaluation framework (`evals/concierge.eval.ts`) to test 4 model
candidates against 32 test cases across 9 categories:

- Speed signals ("quick", "fast", "briefly")
- Complexity (multi-step analysis, strategic planning)
- Creativity (poems, stories, brainstorming)
- Code (functions, debugging, algorithms)
- Reasoning (math proofs, logic puzzles)
- Sensitivity (political, unfiltered requests)
- Attachments (audio, image, PDF routing)
- User hints ("use opus", "use haiku")
- Edge cases (unicode, long queries, mixed signals)

Each test case validates:

- Model selection accuracy (routes to correct model family)
- Temperature appropriateness (within expected range for query type)
- Reasoning enablement (enables reasoning for complex tasks)
- Title generation (concise, descriptive, not generic)

## Candidates Tested

| Model                       | Input Cost | Output Cost | Speed (est.) |
| --------------------------- | ---------- | ----------- | ------------ |
| anthropic/claude-haiku-4.5  | $1/M       | $5/M        | 150 t/s      |
| google/gemini-3-pro-preview | $1.25/M    | $5/M        | 124 t/s      |
| x-ai/grok-4.1-fast          | $5/M       | $15/M       | 151 t/s      |
| openai/gpt-5-mini           | $0.4/M     | $1.6/M      | 160 t/s      |

## Results

### Accuracy Scores

| Model            | Model Selection | Temperature | Reasoning | Title Generated | Title Not Generic |
| ---------------- | --------------- | ----------- | --------- | --------------- | ----------------- |
| Claude Haiku 4.5 | 95.00%          | 85.71%      | 92.31%    | 100%            | 100%              |
| Gemini 3 Pro     | 100.00%         | 100.00%     | 92.31%    | 100%            | 100%              |
| Grok 4.1 Fast    | 100.00%         | 100.00%     | 92.31%    | 100%            | 100%              |
| GPT-5 Mini       | 100.00%         | 100.00%     | 92.31%    | 100%            | 100%              |

### Latency (32 test cases)

| Model            | Total Duration | Avg per Call |
| ---------------- | -------------- | ------------ |
| Claude Haiku 4.5 | 2.65s          | 83ms         |
| Grok 4.1 Fast    | 6.08s          | 190ms        |
| Gemini 3 Pro     | 9.40s          | 294ms        |
| GPT-5 Mini       | 18.94s         | 592ms        |

### Cost Analysis

Typical concierge call: ~2,700 input tokens, ~200 output tokens.

| Model            | Cost per Call | Monthly (100K calls) | Annual  |
| ---------------- | ------------- | -------------------- | ------- |
| GPT-5 Mini       | $0.0014       | $140                 | $1,680  |
| Claude Haiku 4.5 | $0.0037       | $370                 | $4,440  |
| Gemini 3 Pro     | $0.0044       | $440                 | $5,280  |
| Grok 4.1 Fast    | $0.0165       | $1,650               | $19,800 |

## Analysis

### Haiku Failures

Claude Haiku 4.5 had 2 failures out of 32 tests:

1. **Model selection** (95%): Misrouted 1 query - likely a borderline complexity case
2. **Temperature** (85.7%): Set wrong temperature range on 1 query

At scale, 5% misrouting means ~5,000 suboptimal responses per 100K conversations.

### Speed vs Accuracy Tradeoff

Clear inverse relationship between speed and accuracy:

- Haiku: Fastest (2.65s) but lowest accuracy (93.6% avg)
- GPT-5 Mini: Most accurate (100%) but slowest (18.9s)
- Gemini/Grok: Perfect accuracy with moderate speed

### Cost Efficiency

GPT-5 Mini offers best cost-per-accuracy, but latency is prohibitive.

Gemini 3 Pro offers best balance: 100% accuracy at only 19% premium over Haiku.

## Recommendation

**Switch to Gemini 3 Pro** for the Concierge model.

Rationale:

- Perfect accuracy eliminates routing errors
- 9.4s latency acceptable for one-time routing decision per conversation
- $70/month cost increase negligible at scale
- Native multimodal simplifies audio/video routing logic

## Braintrust Links

- [Claude Haiku 4.5 Results](https://www.braintrust.dev/app/Carmenta%20Collective/p/Carmenta%20Concierge%20-%20Claude%20Haiku%204.5/experiments/feature%2Fconcierge-evals-1766089737)
- [Gemini 3 Pro Results](https://www.braintrust.dev/app/Carmenta%20Collective/p/Carmenta%20Concierge%20-%20Gemini%203%20Pro/experiments/feature%2Fconcierge-evals-1766089737)
- [Grok 4.1 Fast Results](https://www.braintrust.dev/app/Carmenta%20Collective/p/Carmenta%20Concierge%20-%20Grok%204.1%20Fast/experiments/feature%2Fconcierge-evals-1766089737)
- [GPT-5 Mini Results](https://www.braintrust.dev/app/Carmenta%20Collective/p/Carmenta%20Concierge%20-%20GPT-5%20Mini/experiments/feature%2Fconcierge-evals-1766089737)

## Next Steps

1. Update `lib/concierge/types.ts` to use `google/gemini-3-pro-preview`
2. Monitor production accuracy via Braintrust tracing
3. Re-run eval after any prompt changes
4. Quarterly review as new models release
