/**
 * Eval Regression Check
 *
 * Compares the latest Braintrust experiment results against baseline thresholds
 * and detects quality regressions.
 *
 * Exit codes:
 * - 0: All metrics passing (within acceptable range of baseline)
 * - 1: Regression detected (one or more metrics below alert threshold)
 *
 * Usage: pnpm eval:check-regression
 */

import * as fs from "fs";
import * as path from "path";
import { logger } from "@/lib/logger";

const BASELINE_FILE = path.join(process.cwd(), "knowledge/evals/baseline-benchmark.md");
const BRAINTRUST_API_KEY = process.env.BRAINTRUST_API_KEY;
const PROJECT_NAME = "Carmenta Nightly"; // This is the project name, not experiment

// Regression thresholds from spec
const THRESHOLDS = {
    overall: { warning: -2, alert: -5 },
    category: { warning: -3, alert: -7 },
    routing: { warning: -1, alert: -3 },
    toolInvocation: { warning: -2, alert: -5 },
} as const;

interface BaselineMetrics {
    overall: number | null;
    reasoning: number | null;
    creative: number | null;
    realWorld: number | null;
    routing: number | null;
    toolInvocation: number | null;
    date: string | null;
    commit: string | null;
}

interface ComparisonResult {
    metric: string;
    current: number;
    baseline: number | null;
    delta: number | null;
    status: "pass" | "warning" | "regression" | "no-baseline";
}

/**
 * Parse baseline metrics from markdown file
 */
function parseBaseline(): BaselineMetrics {
    if (!fs.existsSync(BASELINE_FILE)) {
        logger.warn({ file: BASELINE_FILE }, "Baseline file does not exist");
        return {
            overall: null,
            reasoning: null,
            creative: null,
            realWorld: null,
            routing: null,
            toolInvocation: null,
            date: null,
            commit: null,
        };
    }

    const content = fs.readFileSync(BASELINE_FILE, "utf-8");

    // Parse table rows like: | Overall      | 78.4% | 2025-01-15 | abc123 |
    const parseRow = (
        metricName: string
    ): { value: number | null; date: string | null; commit: string | null } => {
        const regex = new RegExp(
            `\\|\\s*${metricName}\\s*\\|\\s*([\\d.]+)%?\\s*\\|\\s*([^|]*)\\s*\\|\\s*([^|]*)\\s*\\|`,
            "i"
        );
        const match = content.match(regex);

        if (!match) {
            return { value: null, date: null, commit: null };
        }

        const valueStr = match[1].trim();
        const value = valueStr === "TBD" ? null : parseFloat(valueStr);

        return {
            value,
            date: match[2].trim() || null,
            commit: match[3].trim() || null,
        };
    };

    const overall = parseRow("Arena-Hard Overall");
    const reasoning = parseRow("Reasoning");
    const creative = parseRow("Creative");
    const realWorld = parseRow("Real-world");

    // For routing and tool invocation, they might be in a different table
    // or not yet defined - handle gracefully
    const routing = parseRow("Routing Accuracy");
    const toolInvocation = parseRow("Tool Invocation");

    return {
        overall: overall.value,
        reasoning: reasoning.value,
        creative: creative.value,
        realWorld: realWorld.value,
        routing: routing.value,
        toolInvocation: toolInvocation.value,
        date: overall.date,
        commit: overall.commit,
    };
}

/**
 * Update baseline file with new metrics
 */
function updateBaseline(metrics: {
    overall: number;
    reasoning?: number;
    creative?: number;
    realWorld?: number;
    routing?: number;
    toolInvocation?: number;
}): void {
    if (!fs.existsSync(BASELINE_FILE)) {
        logger.warn("Baseline file does not exist, creating new baseline");
        const template = `# Baseline Benchmark

| Metric | Score | Last Updated | Commit |
|--------|-------|--------------|--------|
| Arena-Hard Overall | 0.0% | - | - |
| Reasoning | 0.0% | - | - |
| Creative | 0.0% | - | - |
| Real World | 0.0% | - | - |
| Routing Accuracy | 0.0% | - | - |
| Tool Invocation | 0.0% | - | - |
`;
        fs.writeFileSync(BASELINE_FILE, template, "utf-8");
    }

    const content = fs.readFileSync(BASELINE_FILE, "utf-8");
    const now = new Date().toISOString().split("T")[0];
    const commit =
        process.env.COMMIT_SHA ??
        process.env.GITHUB_SHA?.substring(0, 7) ??
        "local-update";

    let updated = content;

    const updateRow = (metricName: string, value: number | undefined): void => {
        if (value === undefined) return;

        const regex = new RegExp(
            `(\\|\\s*${metricName}\\s*\\|\\s*)[^|]*(\\s*\\|\\s*)[^|]*(\\s*\\|\\s*)[^|]*(\\s*\\|)`,
            "i"
        );

        updated = updated.replace(regex, `$1${value.toFixed(1)}%$2${now}$3${commit}$4`);
    };

    updateRow("Arena-Hard Overall", metrics.overall);
    updateRow("Reasoning", metrics.reasoning);
    updateRow("Creative", metrics.creative);
    updateRow("Real-world", metrics.realWorld);
    updateRow("Routing Accuracy", metrics.routing);
    updateRow("Tool Invocation", metrics.toolInvocation);

    fs.writeFileSync(BASELINE_FILE, updated, "utf-8");

    logger.info({ metrics, date: now }, "Updated baseline file with improved metrics");
}

/**
 * Serialize error for logging (Error objects don't JSON.stringify well)
 */
function serializeError(error: unknown): Record<string, unknown> {
    if (error instanceof Error) {
        return {
            name: error.name,
            message: error.message,
            stack: error.stack?.split("\n").slice(0, 5).join("\n"),
        };
    }
    return { value: String(error) };
}

/**
 * Fetch latest experiment from Braintrust using REST API
 */
async function fetchLatestExperiment(): Promise<{
    overall: number;
    reasoning?: number;
    creative?: number;
    realWorld?: number;
    routing?: number;
    toolInvocation?: number;
} | null> {
    if (!BRAINTRUST_API_KEY) {
        logger.error("BRAINTRUST_API_KEY environment variable is required");
        throw new Error("Missing BRAINTRUST_API_KEY");
    }

    try {
        // First, get the project ID
        const projectsResponse = await fetch(
            `https://api.braintrust.dev/v1/project?project_name=${encodeURIComponent(PROJECT_NAME)}`,
            {
                headers: {
                    Authorization: `Bearer ${BRAINTRUST_API_KEY}`,
                    "Content-Type": "application/json",
                },
                signal: AbortSignal.timeout(30000),
            }
        );

        if (!projectsResponse.ok) {
            const errorText = await projectsResponse.text();
            throw new Error(
                `Braintrust API error fetching project: ${projectsResponse.status} ${projectsResponse.statusText} - ${errorText}`
            );
        }

        const projectsData = (await projectsResponse.json()) as {
            objects?: Array<{ id: string; name: string }>;
        };

        if (!projectsData.objects || projectsData.objects.length === 0) {
            logger.warn({ project: PROJECT_NAME }, "Project not found in Braintrust");
            return null;
        }

        const projectId = projectsData.objects[0].id;
        logger.info({ projectId, projectName: PROJECT_NAME }, "Found project");

        // Now list experiments for this project, sorted by creation time (most recent first)
        const experimentsResponse = await fetch(
            `https://api.braintrust.dev/v1/experiment?project_id=${projectId}&limit=1`,
            {
                headers: {
                    Authorization: `Bearer ${BRAINTRUST_API_KEY}`,
                    "Content-Type": "application/json",
                },
                signal: AbortSignal.timeout(30000),
            }
        );

        if (!experimentsResponse.ok) {
            const errorText = await experimentsResponse.text();
            throw new Error(
                `Braintrust API error fetching experiments: ${experimentsResponse.status} ${experimentsResponse.statusText} - ${errorText}`
            );
        }

        const experimentsData = (await experimentsResponse.json()) as {
            objects?: Array<{
                id: string;
                name: string;
                scores?: Record<string, number>;
                metadata?: Record<string, unknown>;
            }>;
        };

        if (!experimentsData.objects || experimentsData.objects.length === 0) {
            logger.warn({ project: PROJECT_NAME }, "No experiments found for project");
            return null;
        }

        const latest = experimentsData.objects[0];
        const scores = latest.scores || {};

        logger.info(
            { experimentId: latest.id, experimentName: latest.name, scores },
            "Fetched latest experiment"
        );

        // Check if scores is empty - indicates experiment with no results yet
        if (Object.keys(scores).length === 0) {
            logger.warn(
                { experimentId: latest.id, experimentName: latest.name },
                "Experiment has no aggregated scores yet"
            );
            return null;
        }

        return {
            overall: scores.overall ?? scores.score ?? 0,
            reasoning: scores.reasoning,
            creative: scores.creative,
            realWorld: scores.realWorld ?? scores.real_world,
            routing: scores.routing ?? scores.routing_accuracy,
            toolInvocation: scores.toolInvocation ?? scores.tool_invocation,
        };
    } catch (error) {
        logger.error(
            { error: serializeError(error) },
            "Failed to fetch experiment from Braintrust"
        );
        throw error;
    }
}

/**
 * Compare current metrics against baseline
 */
function compareMetrics(
    current: {
        overall: number;
        reasoning?: number;
        creative?: number;
        realWorld?: number;
        routing?: number;
        toolInvocation?: number;
    },
    baseline: BaselineMetrics
): ComparisonResult[] {
    const results: ComparisonResult[] = [];

    const compare = (
        metric: string,
        currentValue: number | undefined,
        baselineValue: number | null,
        threshold: { warning: number; alert: number }
    ): void => {
        if (currentValue === undefined) return;

        if (baselineValue === null) {
            results.push({
                metric,
                current: currentValue,
                baseline: null,
                delta: null,
                status: "no-baseline",
            });
            return;
        }

        const delta = currentValue - baselineValue;
        let status: ComparisonResult["status"] = "pass";

        if (delta <= threshold.alert) {
            status = "regression";
        } else if (delta <= threshold.warning) {
            status = "warning";
        }

        results.push({
            metric,
            current: currentValue,
            baseline: baselineValue,
            delta,
            status,
        });
    };

    compare("Overall", current.overall, baseline.overall, THRESHOLDS.overall);
    compare("Reasoning", current.reasoning, baseline.reasoning, THRESHOLDS.category);
    compare("Creative", current.creative, baseline.creative, THRESHOLDS.category);
    compare("Real-world", current.realWorld, baseline.realWorld, THRESHOLDS.category);
    compare("Routing", current.routing, baseline.routing, THRESHOLDS.routing);
    compare(
        "Tool Invocation",
        current.toolInvocation,
        baseline.toolInvocation,
        THRESHOLDS.toolInvocation
    );

    return results;
}

/**
 * Format output for console
 */
function formatOutput(results: ComparisonResult[]): void {
    console.log("\nNightly Eval Regression Check");
    console.log("━".repeat(50));

    for (const result of results) {
        const statusSymbol =
            result.status === "pass"
                ? "✓"
                : result.status === "warning"
                  ? "⚠"
                  : result.status === "regression"
                    ? "✗"
                    : "○";

        const statusLabel =
            result.status === "warning"
                ? " warning"
                : result.status === "regression"
                  ? " REGRESSION"
                  : "";

        if (result.baseline === null) {
            console.log(
                `${result.metric}: ${result.current.toFixed(1)}% (no baseline) ${statusSymbol}`
            );
        } else {
            const deltaStr =
                result.delta !== null
                    ? ` ${result.delta >= 0 ? "+" : ""}${result.delta.toFixed(1)}%`
                    : "";

            console.log(
                `${result.metric}: ${result.current.toFixed(1)}% (baseline: ${result.baseline.toFixed(1)}%${deltaStr}) ${statusSymbol}${statusLabel}`
            );
        }
    }

    console.log("");

    const regressions = results.filter((r) => r.status === "regression");
    const warnings = results.filter((r) => r.status === "warning");
    const noBaseline = results.filter((r) => r.status === "no-baseline");

    if (noBaseline.length === results.length) {
        console.log("Status: NO BASELINE - storing current results as baseline");
    } else if (regressions.length > 0) {
        console.log(`Status: FAILED - ${regressions.length} regression(s) detected`);
    } else if (warnings.length > 0) {
        console.log(`Status: WARNING - ${warnings.length} metric(s) below baseline`);
    } else {
        console.log("Status: PASSED - all metrics within acceptable range");
    }
}

/**
 * Main execution
 */
async function main(): Promise<void> {
    logger.info("Starting regression check...");

    // Step 1: Parse baseline
    const baseline = parseBaseline();
    logger.info({ baseline }, "Loaded baseline metrics");

    // Step 2: Fetch latest experiment
    const current = await fetchLatestExperiment();

    if (!current) {
        logger.error("No experiment data available");
        process.exit(1);
    }

    // Step 3: Compare metrics
    const results = compareMetrics(current, baseline);

    // Step 4: Format output
    formatOutput(results);

    // Step 5: Handle first-run case
    const noBaseline = results.filter((r) => r.status === "no-baseline");
    if (noBaseline.length === results.length) {
        updateBaseline(current);
        process.exit(0);
    }

    // Step 6: Auto-update baseline if improvement > 1%
    const overallResult = results.find((r) => r.metric === "Overall");
    if (overallResult && overallResult.delta && overallResult.delta > 1) {
        logger.info(
            { improvement: overallResult.delta },
            "Overall score improved by >1%, auto-updating baseline"
        );
        updateBaseline(current);
    }

    // Step 7: Exit with appropriate code
    const hasRegression = results.some((r) => r.status === "regression");
    process.exit(hasRegression ? 1 : 0);
}

// Run the script
main().catch((error) => {
    logger.error({ error: serializeError(error) }, "Regression check failed");
    process.exit(1);
});
