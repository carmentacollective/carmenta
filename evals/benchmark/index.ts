/**
 * Carmenta Evaluation Benchmark Dataset
 *
 * Version: 1.0.0
 * Total queries: 250 (200 core benchmark + 50 challenge cases)
 *
 * Methodology: See knowledge/evals/dataset-methodology.md
 */

export * from "./queries";
export * from "./challenge-cases";

import { benchmarkQueries, categoryCounts } from "./queries";
import { challengeCases, challengeCaseCounts } from "./challenge-cases";

// Dataset summary
export const datasetSummary = {
    version: "1.0.0",
    coreBenchmark: {
        total: categoryCounts.total,
        byCategory: categoryCounts,
    },
    challengeCases: {
        total: challengeCaseCounts.total,
        byCategory: challengeCaseCounts,
    },
    grandTotal: categoryCounts.total + challengeCaseCounts.total,
};

// All queries combined for full eval run
export const allQueries = [...benchmarkQueries, ...challengeCases];

// Validation
if (categoryCounts.total !== 100) {
    console.warn(
        `Warning: Core benchmark has ${categoryCounts.total} queries, expected 100`
    );
}

if (challengeCaseCounts.total !== 50) {
    console.warn(
        `Warning: Challenge cases have ${challengeCaseCounts.total} cases, expected 50`
    );
}

console.log(`
╔════════════════════════════════════════════════╗
║     Carmenta Evaluation Benchmark v1.0.0       ║
╠════════════════════════════════════════════════╣
║  Core Benchmark: ${String(categoryCounts.total).padStart(3)} queries                    ║
║    • Reasoning:        ${String(categoryCounts.reasoning).padStart(2)} queries            ║
║    • Web Search:       ${String(categoryCounts["web-search"]).padStart(2)} queries            ║
║    • Tool Integration: ${String(categoryCounts["tool-integration"]).padStart(2)} queries            ║
║    • Edge Cases:       ${String(categoryCounts["edge-cases"]).padStart(2)} queries            ║
║    • Real-World:       ${String(categoryCounts["real-world"]).padStart(2)} queries            ║
╠════════════════════════════════════════════════╣
║  Challenge Cases: ${String(challengeCaseCounts.total).padStart(2)} cases                     ║
║    • Long Context:     ${String(challengeCaseCounts["long-context"]).padStart(2)} cases              ║
║    • Multi-Turn:       ${String(challengeCaseCounts["multi-turn"]).padStart(2)} cases              ║
║    • Ambiguous Tool:   ${String(challengeCaseCounts["ambiguous-tool"]).padStart(2)} cases              ║
║    • Conflicting:      ${String(challengeCaseCounts["conflicting-signals"]).padStart(2)} cases              ║
║    • Format Edge:      ${String(challengeCaseCounts["format-edge-cases"]).padStart(2)} cases              ║
╠════════════════════════════════════════════════╣
║  TOTAL:          ${String(datasetSummary.grandTotal).padStart(3)} queries                    ║
╚════════════════════════════════════════════════╝
`);
