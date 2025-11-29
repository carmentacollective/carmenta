"use client";

import { makeAssistantToolUI } from "@assistant-ui/react";
import {
    BookOpen,
    ExternalLink,
    AlertCircle,
    CheckCircle,
    HelpCircle,
} from "lucide-react";

interface DeepResearchArgs {
    objective: string;
    depth?: "quick" | "standard" | "deep";
    focusAreas?: string[];
}

interface ResearchFinding {
    insight: string;
    sources: string[];
    confidence: "high" | "medium" | "low";
}

interface ResearchSource {
    url: string;
    title: string;
    relevance: string;
}

interface DeepResearchResult {
    error: boolean;
    message?: string;
    summary: string;
    findings: ResearchFinding[];
    sources: ResearchSource[];
}

const ConfidenceIcon = ({ confidence }: { confidence: string }) => {
    switch (confidence) {
        case "high":
            return <CheckCircle className="h-3 w-3 text-green-500" />;
        case "medium":
            return <HelpCircle className="h-3 w-3 text-yellow-500" />;
        default:
            return <HelpCircle className="h-3 w-3 text-muted-foreground" />;
    }
};

/**
 * Tool UI for displaying deep research results.
 *
 * Renders when the AI calls the deepResearch tool, showing:
 * - Research summary
 * - Key findings with confidence levels
 * - Sources with links
 */
export const DeepResearchToolUI = makeAssistantToolUI<
    DeepResearchArgs,
    DeepResearchResult
>({
    toolName: "deepResearch",
    render: ({ args, result, status }) => {
        const depthLabel =
            args.depth === "deep" ? "thorough" : args.depth || "standard";

        // Loading state
        if (status.type === "running") {
            return (
                <div className="glass-card max-w-2xl animate-pulse">
                    <div className="flex items-center gap-2">
                        <BookOpen className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                            Conducting {depthLabel} research...
                        </span>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground/70">
                        &quot;{args.objective}&quot;
                    </p>
                    <div className="mt-4 space-y-2">
                        <div className="h-3 w-full rounded bg-muted" />
                        <div className="h-3 w-5/6 rounded bg-muted" />
                        <div className="h-3 w-4/6 rounded bg-muted" />
                    </div>
                    <p className="mt-4 text-xs text-muted-foreground/50">
                        This may take 30-60 seconds...
                    </p>
                </div>
            );
        }

        // Error/incomplete state
        if (status.type === "incomplete" || !result || result.error) {
            return (
                <div className="glass-card max-w-2xl border-destructive/50 bg-destructive/10">
                    <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-destructive" />
                        <p className="text-sm text-destructive">
                            {result?.message || "Research didn't complete. Try again?"}
                        </p>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                        Objective: &quot;{args.objective}&quot;
                    </p>
                </div>
            );
        }

        // Success state
        return (
            <div className="glass-card max-w-2xl">
                <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-primary" />
                    <span className="font-medium text-foreground">
                        Research Complete
                    </span>
                </div>

                {/* Summary */}
                {result.summary && (
                    <div className="mt-4">
                        <p className="text-sm text-foreground/90">{result.summary}</p>
                    </div>
                )}

                {/* Findings */}
                {result.findings.length > 0 && (
                    <div className="mt-4">
                        <h4 className="text-xs font-medium uppercase text-muted-foreground">
                            Key Findings
                        </h4>
                        <ul className="mt-2 space-y-2">
                            {result.findings.map((finding, index) => (
                                <li key={index} className="flex items-start gap-2">
                                    <ConfidenceIcon confidence={finding.confidence} />
                                    <span className="text-sm text-foreground/80">
                                        {finding.insight}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Sources */}
                {result.sources.length > 0 && (
                    <details className="mt-4">
                        <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                            {result.sources.length} sources
                        </summary>
                        <ul className="mt-2 space-y-1">
                            {result.sources.map((source, index) => (
                                <li key={index}>
                                    <a
                                        href={source.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="group flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
                                    >
                                        <span className="truncate">{source.title}</span>
                                        <ExternalLink className="h-2.5 w-2.5 flex-shrink-0 opacity-0 group-hover:opacity-100" />
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </details>
                )}
            </div>
        );
    },
});
