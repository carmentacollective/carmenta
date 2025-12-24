/**
 * AI-Driven Gap Analysis Script
 *
 * Analyzes Braintrust evaluation results to identify patterns in failures,
 * coverage gaps, and opportunities for improvement. Uses an LLM to analyze
 * patterns and propose actionable fixes.
 *
 * Usage:
 *   pnpm eval:analyze-gaps                    # Last 7 days
 *   pnpm eval:analyze-gaps --days 14          # Custom time window
 *   pnpm eval:analyze-gaps --create-issue     # Create GitHub issue
 *   pnpm eval:analyze-gaps --experiments 5    # Last N experiments
 *
 * Requirements:
 *   - BRAINTRUST_API_KEY in .env.local
 *   - OPENROUTER_API_KEY for LLM analysis
 *   - GITHUB_TOKEN (optional, for --create-issue)
 */

import "dotenv/config";
import { env, assertEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { openrouter } from "@openrouter/ai-sdk-provider";
import { generateObject } from "ai";
import { z } from "zod";

// Type definitions based on Braintrust REST API
interface BraintrustExperiment {
    id: string;
    name: string;
    project_id: string;
    created: string;
    scores: Record<string, number>;
}

interface BraintrustExperimentEvent {
    id: string;
    input: unknown;
    output: unknown;
    expected?: unknown;
    scores: Record<string, number>;
    metadata?: {
        id?: string;
        category?: string;
        tags?: string[];
    };
    tags?: string[];
    error?: string;
}

// Configuration
const BRAINTRUST_API_URL = "https://api.braintrust.dev/v1";
const DEFAULT_DAYS = 7;
const DEFAULT_EXPERIMENTS = 10;
const MIN_FAILURES_FOR_PATTERN = 3;
const GITHUB_OWNER = "carmentacollective";
const GITHUB_REPO = "carmenta";

// Analysis output schema
const GapAnalysisSchema = z.object({
    priorityIssues: z
        .array(
            z.object({
                title: z.string().describe("Brief title for this issue"),
                severity: z.enum(["high", "medium", "low"]),
                pattern: z
                    .string()
                    .describe("Description of the failure pattern observed"),
                evidence: z.string().describe("Specific examples and metrics"),
                proposedFix: z
                    .string()
                    .describe("Concrete actionable fix to address this issue"),
                confidence: z
                    .enum(["high", "medium", "low"])
                    .describe(
                        "Confidence level based on evidence strength and sample size"
                    ),
                affectedCount: z
                    .number()
                    .describe("Number of failing test cases showing this pattern"),
            })
        )
        .describe("Priority issues ranked by severity and evidence"),
    coverageGaps: z
        .array(
            z.object({
                area: z.string().describe("Area lacking test coverage"),
                examples: z
                    .array(z.string())
                    .describe("Specific untested capabilities or scenarios"),
                priority: z.enum(["high", "medium", "low"]),
            })
        )
        .describe("Identified gaps in test coverage"),
    competitivePosition: z
        .object({
            winning: z
                .array(z.string())
                .describe("Categories where Carmenta performs well"),
            tied: z
                .array(z.string())
                .describe("Categories with comparable performance"),
            losing: z
                .array(z.string())
                .describe("Categories where competitors outperform"),
        })
        .describe("Competitive position analysis"),
    recommendedActions: z
        .array(
            z.object({
                priority: z.enum(["HIGH", "MEDIUM", "LOW"]),
                action: z.string().describe("Specific action to take"),
                rationale: z.string().describe("Why this action matters"),
            })
        )
        .describe("Prioritized list of recommended actions"),
});

type GapAnalysis = z.infer<typeof GapAnalysisSchema>;

/**
 * Parse command line arguments
 */
function parseArgs() {
    const args = process.argv.slice(2);
    const options = {
        days: DEFAULT_DAYS,
        experiments: DEFAULT_EXPERIMENTS,
        createIssue: false,
        useDays: true,
    };

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === "--days") {
            options.days = parseInt(args[++i] ?? String(DEFAULT_DAYS), 10);
            options.useDays = true;
        } else if (arg === "--experiments") {
            options.experiments = parseInt(
                args[++i] ?? String(DEFAULT_EXPERIMENTS),
                10
            );
            options.useDays = false;
        } else if (arg === "--create-issue") {
            options.createIssue = true;
        } else if (arg === "--help" || arg === "-h") {
            console.log(`
Usage: pnpm eval:analyze-gaps [options]

Options:
  --days N            Analyze experiments from last N days (default: ${DEFAULT_DAYS})
  --experiments N     Analyze last N experiments (default: ${DEFAULT_EXPERIMENTS})
  --create-issue      Create a GitHub issue with findings
  --help, -h          Show this help message

Examples:
  pnpm eval:analyze-gaps                    # Last 7 days
  pnpm eval:analyze-gaps --days 14          # Last 14 days
  pnpm eval:analyze-gaps --experiments 5    # Last 5 experiments
  pnpm eval:analyze-gaps --create-issue     # Create GitHub issue
`);
            process.exit(0);
        }
    }

    return options;
}

/**
 * Fetch experiments from Braintrust
 */
async function fetchExperiments(
    projectName: string,
    options: { days?: number; limit?: number }
): Promise<BraintrustExperiment[]> {
    assertEnv(env.BRAINTRUST_API_KEY, "BRAINTRUST_API_KEY");

    const params = new URLSearchParams({
        project_name: projectName,
        limit: String(options.limit ?? 100),
    });

    const response = await fetch(`${BRAINTRUST_API_URL}/experiment?${params}`, {
        headers: {
            Authorization: `Bearer ${env.BRAINTRUST_API_KEY}`,
        },
    });

    if (!response.ok) {
        throw new Error(
            `Failed to fetch experiments: ${response.status} ${response.statusText}`
        );
    }

    const data = (await response.json()) as { objects: BraintrustExperiment[] };
    let experiments = data.objects;

    // Filter by time if days specified
    if (options.days) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - options.days);

        experiments = experiments.filter((exp) => {
            const expDate = new Date(exp.created);
            return expDate >= cutoffDate;
        });
    }

    return experiments;
}

/**
 * Fetch experiment events (individual test results)
 */
async function fetchExperimentEvents(
    experimentId: string
): Promise<BraintrustExperimentEvent[]> {
    assertEnv(env.BRAINTRUST_API_KEY, "BRAINTRUST_API_KEY");

    const response = await fetch(
        `${BRAINTRUST_API_URL}/experiment/${experimentId}/fetch`,
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${env.BRAINTRUST_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                limit: 1000,
            }),
        }
    );

    if (!response.ok) {
        throw new Error(
            `Failed to fetch experiment events: ${response.status} ${response.statusText}`
        );
    }

    const data = (await response.json()) as { events: BraintrustExperimentEvent[] };
    return data.events;
}

/**
 * Aggregate experiment data for analysis
 */
interface AggregatedData {
    totalTests: number;
    totalFailures: number;
    failuresByCategory: Record<string, number>;
    failuresByTag: Record<string, number>;
    failedTests: Array<{
        id?: string;
        category?: string;
        tags?: string[];
        input: unknown;
        output: unknown;
        expected?: unknown;
        scores: Record<string, number>;
        error?: string;
    }>;
    scoreDistribution: Record<string, { avg: number; min: number; max: number }>;
}

async function aggregateExperimentData(
    experiments: BraintrustExperiment[]
): Promise<AggregatedData> {
    const aggregated: AggregatedData = {
        totalTests: 0,
        totalFailures: 0,
        failuresByCategory: {},
        failuresByTag: {},
        failedTests: [],
        scoreDistribution: {},
    };

    // Track score sums and counts for averaging
    const scoreSums: Record<string, { sum: number; count: number }> = {};

    for (const experiment of experiments) {
        logger.info(
            { experimentId: experiment.id, name: experiment.name },
            "Fetching events"
        );
        const events = await fetchExperimentEvents(experiment.id);

        for (const event of events) {
            aggregated.totalTests++;

            // Track score distributions
            for (const [scoreName, scoreValue] of Object.entries(event.scores)) {
                if (!aggregated.scoreDistribution[scoreName]) {
                    aggregated.scoreDistribution[scoreName] = {
                        avg: 0,
                        min: Infinity,
                        max: -Infinity,
                    };
                }
                const dist = aggregated.scoreDistribution[scoreName];
                dist.min = Math.min(dist.min, scoreValue);
                dist.max = Math.max(dist.max, scoreValue);

                // Accumulate for average calculation
                if (!scoreSums[scoreName]) {
                    scoreSums[scoreName] = { sum: 0, count: 0 };
                }
                scoreSums[scoreName].sum += scoreValue;
                scoreSums[scoreName].count++;
            }

            // Identify failures (score < 0.5 or error present)
            const isFailure =
                event.error || Object.values(event.scores).some((score) => score < 0.5);

            if (isFailure) {
                aggregated.totalFailures++;

                const category = event.metadata?.category ?? "unknown";
                aggregated.failuresByCategory[category] =
                    (aggregated.failuresByCategory[category] ?? 0) + 1;

                const tags = event.metadata?.tags ?? event.tags ?? [];
                for (const tag of tags) {
                    aggregated.failuresByTag[tag] =
                        (aggregated.failuresByTag[tag] ?? 0) + 1;
                }

                aggregated.failedTests.push({
                    id: event.metadata?.id,
                    category,
                    tags,
                    input: event.input,
                    output: event.output,
                    expected: event.expected,
                    scores: event.scores,
                    error: event.error,
                });
            }
        }
    }

    // Calculate averages from accumulated sums
    for (const [scoreName, { sum, count }] of Object.entries(scoreSums)) {
        aggregated.scoreDistribution[scoreName].avg = count > 0 ? sum / count : 0;
    }

    return aggregated;
}

/**
 * Use LLM to analyze patterns and generate insights
 */
async function analyzeWithLLM(
    aggregatedData: AggregatedData,
    experiments: BraintrustExperiment[]
): Promise<GapAnalysis> {
    assertEnv(env.OPENROUTER_API_KEY, "OPENROUTER_API_KEY");

    const prompt = `You are analyzing evaluation results from Carmenta, a heart-centered AI interface.

## Experiment Summary

- **Total Experiments:** ${experiments.length}
- **Total Tests:** ${aggregatedData.totalTests}
- **Total Failures:** ${aggregatedData.totalFailures}
- **Failure Rate:** ${((aggregatedData.totalFailures / aggregatedData.totalTests) * 100).toFixed(1)}%

## Failures by Category
${Object.entries(aggregatedData.failuresByCategory)
    .map(([cat, count]) => `- ${cat}: ${count} failures`)
    .join("\n")}

## Failures by Tag
${Object.entries(aggregatedData.failuresByTag)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([tag, count]) => `- ${tag}: ${count} failures`)
    .join("\n")}

## Score Distributions
${Object.entries(aggregatedData.scoreDistribution)
    .map(
        ([name, dist]) =>
            `- ${name}: avg=${dist.avg.toFixed(2)}, min=${dist.min.toFixed(2)}, max=${dist.max.toFixed(2)}`
    )
    .join("\n")}

## Sample Failed Tests
${aggregatedData.failedTests
    .slice(0, 20)
    .map(
        (test, i) => `
### Failure ${i + 1}
- **ID:** ${test.id ?? "unknown"}
- **Category:** ${test.category}
- **Tags:** ${test.tags?.join(", ") ?? "none"}
- **Scores:** ${JSON.stringify(test.scores)}
- **Input:** ${JSON.stringify(test.input).slice(0, 200)}
- **Output:** ${JSON.stringify(test.output).slice(0, 200)}
- **Expected:** ${JSON.stringify(test.expected).slice(0, 200)}
${test.error ? `- **Error:** ${test.error}` : ""}
`
    )
    .join("\n")}

---

## Your Task

Analyze these evaluation results and identify:

1. **Priority Issues** - Patterns in failures that represent regressions or significant problems
   - Look for categories with high failure rates
   - Identify specific query patterns that consistently fail
   - Rank by severity (how many tests affected, how critical the capability)
   - Propose concrete, actionable fixes

2. **Coverage Gaps** - Areas that are untested or undertested
   - Which capabilities appear to have no test coverage?
   - Which tools or features are never exercised in tests?
   - What types of queries are missing from the test suite?

3. **Competitive Position** - Based on the test categories and results
   - Which categories show strong performance (high scores)?
   - Which categories show weak performance?
   - What capabilities need improvement to be competitive?

4. **Recommended Actions** - Prioritized list of what to do next
   - HIGH priority: Critical regressions or gaps blocking users
   - MEDIUM priority: Important improvements with clear value
   - LOW priority: Nice-to-haves or minor enhancements

Be specific. Instead of "improve reasoning", say "increase reasoning budget for multi-step math proofs (3+ steps)".
Include confidence levels based on sample size and pattern consistency.`;

    logger.info("Analyzing patterns with LLM");

    const result = await generateObject({
        model: openrouter("deepseek/deepseek-r1:free"),
        schema: GapAnalysisSchema,
        prompt,
    });

    return result.object;
}

/**
 * Format analysis as a readable report
 */
function formatReport(
    analysis: GapAnalysis,
    experiments: BraintrustExperiment[],
    aggregatedData: AggregatedData
): string {
    const date = new Date().toISOString().split("T")[0];

    const report = `Weekly Gap Analysis - ${date}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## Summary

- **Experiments Analyzed:** ${experiments.length}
- **Total Tests:** ${aggregatedData.totalTests}
- **Total Failures:** ${aggregatedData.totalFailures}
- **Failure Rate:** ${((aggregatedData.totalFailures / aggregatedData.totalTests) * 100).toFixed(1)}%

## Priority Issues
───────────────
${
    analysis.priorityIssues.length > 0
        ? analysis.priorityIssues
              .map(
                  (issue, i) => `
${i + 1}. ${issue.title} [${issue.severity.toUpperCase()}]
   Pattern: ${issue.pattern}
   Evidence: ${issue.evidence}
   Proposed fix: ${issue.proposedFix}
   Confidence: ${issue.confidence} (${issue.affectedCount} failing examples)
`
              )
              .join("\n")
        : "No significant issues detected"
}

## Coverage Gaps
─────────────
${
    analysis.coverageGaps.length > 0
        ? analysis.coverageGaps
              .map(
                  (gap) => `
- **${gap.area}** [${gap.priority.toUpperCase()}]
  ${gap.examples.map((ex) => `  - ${ex}`).join("\n  ")}
`
              )
              .join("\n")
        : "No significant coverage gaps identified"
}

## Competitive Position
────────────────────
${
    analysis.competitivePosition.winning.length > 0
        ? `**Winning:** ${analysis.competitivePosition.winning.join(", ")}`
        : ""
}
${analysis.competitivePosition.tied.length > 0 ? `**Tied:** ${analysis.competitivePosition.tied.join(", ")}` : ""}
${
    analysis.competitivePosition.losing.length > 0
        ? `**Losing:** ${analysis.competitivePosition.losing.join(", ")}`
        : ""
}

## Recommended Actions
───────────────────
${analysis.recommendedActions
    .map(
        (action) =>
            `${action.priority === "HIGH" ? "🔴" : action.priority === "MEDIUM" ? "🟡" : "🟢"} [${action.priority}] ${action.action}\n   ${action.rationale}`
    )
    .join("\n\n")}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Generated by Carmenta Gap Analyzer
Report date: ${new Date().toISOString()}
`;

    return report;
}

/**
 * Create a GitHub issue with the gap analysis
 */
async function createGitHubIssue(
    analysis: GapAnalysis,
    report: string
): Promise<string | null> {
    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
        logger.warn(
            "GITHUB_TOKEN not set, skipping issue creation. Set GITHUB_TOKEN to enable this feature."
        );
        return null;
    }

    const date = new Date().toISOString().split("T")[0];
    const title = `[Gap Analysis] ${date} - ${analysis.priorityIssues.length} issues identified`;

    const body = `${report}

## Details

This issue was automatically generated by the gap analyzer.

${
    analysis.priorityIssues.length > 0
        ? `
### High Priority Items

${analysis.priorityIssues
    .filter((issue) => issue.severity === "high")
    .map((issue) => `- [ ] ${issue.title}: ${issue.proposedFix}`)
    .join("\n")}
`
        : ""
}
`;

    try {
        const response = await fetch(
            `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/issues`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${githubToken}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    title,
                    body,
                    labels: ["gap-analysis", "evaluation", "automated"],
                }),
            }
        );

        if (!response.ok) {
            throw new Error(
                `Failed to create GitHub issue: ${response.status} ${response.statusText}`
            );
        }

        const issue = (await response.json()) as { html_url: string };
        logger.info({ url: issue.html_url }, "Created GitHub issue");
        return issue.html_url;
    } catch (error) {
        logger.error({ error }, "Failed to create GitHub issue");
        return null;
    }
}

/**
 * Main execution
 */
async function main() {
    const options = parseArgs();

    logger.info(
        {
            days: options.useDays ? options.days : undefined,
            experiments: !options.useDays ? options.experiments : undefined,
            createIssue: options.createIssue,
        },
        "Starting gap analysis"
    );

    // Fetch experiments
    const experiments = await fetchExperiments("Carmenta Routing", {
        days: options.useDays ? options.days : undefined,
        limit: !options.useDays ? options.experiments : undefined,
    });

    if (experiments.length === 0) {
        logger.warn("No experiments found in the specified time range");
        process.exit(0);
    }

    logger.info({ count: experiments.length }, "Fetched experiments");

    // Aggregate data
    const aggregatedData = await aggregateExperimentData(experiments);

    logger.info(
        {
            totalTests: aggregatedData.totalTests,
            totalFailures: aggregatedData.totalFailures,
            failureRate: (
                (aggregatedData.totalFailures / aggregatedData.totalTests) *
                100
            ).toFixed(1),
        },
        "Aggregated experiment data"
    );

    // Only analyze if we have enough failures to identify patterns
    if (aggregatedData.totalFailures < MIN_FAILURES_FOR_PATTERN) {
        logger.info(
            { failures: aggregatedData.totalFailures },
            `Not enough failures for pattern analysis (minimum ${MIN_FAILURES_FOR_PATTERN})`
        );
        console.log("\n✅ All tests passing - no gap analysis needed");
        process.exit(0);
    }

    // Analyze with LLM
    const analysis = await analyzeWithLLM(aggregatedData, experiments);

    // Format report
    const report = formatReport(analysis, experiments, aggregatedData);

    // Output report
    console.log("\n" + report);

    // Create GitHub issue if requested
    if (options.createIssue) {
        const issueUrl = await createGitHubIssue(analysis, report);
        if (issueUrl) {
            console.log(`\n✅ Created GitHub issue: ${issueUrl}`);
        }
    }
}

// Run the analysis
main()
    .then(() => {
        logger.info("Gap analysis completed successfully");
        process.exit(0);
    })
    .catch((error) => {
        logger.error({ error }, "Gap analysis failed");
        console.error("\n❌ Error:", error instanceof Error ? error.message : error);
        process.exit(1);
    });
