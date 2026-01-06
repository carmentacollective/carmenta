"use client";

/**
 * Agent Task Renderer
 *
 * Displays Claude Code Task tool calls - when Claude spawns sub-agents
 * to handle complex work. Shows agent type, description, and result.
 */

import {
    RobotIcon,
    CheckCircleIcon,
    WarningCircleIcon,
    CircleNotchIcon,
} from "@phosphor-icons/react";
import { useState } from "react";

import type { ToolStatus } from "@/lib/tools/tool-config";
import { cn } from "@/lib/utils";

interface AgentTaskProps {
    toolCallId: string;
    status: ToolStatus;
    agentType?: string;
    description?: string;
    output?: string;
    error?: string;
}

/**
 * Get a friendly display name for agent types
 */
function getAgentDisplayName(agentType: string | undefined): string {
    if (!agentType) return "Agent";

    // Map known agent types to friendly names
    const agentNames: Record<string, string> = {
        Explore: "Explorer",
        Plan: "Planner",
        "general-purpose": "General Purpose",
        "code-reviewer": "Code Reviewer",
        "autonomous-developer": "Developer",
        debugger: "Debugger",
        "ux-designer": "UX Designer",
        "prompt-engineer": "Prompt Engineer",
        "test-engineer": "Test Engineer",
        "security-reviewer": "Security Reviewer",
    };

    return agentNames[agentType] || agentType;
}

export function AgentTask({
    toolCallId,
    status,
    agentType,
    description,
    output,
    error,
}: AgentTaskProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const displayName = getAgentDisplayName(agentType);
    const hasOutput = output && output.length > 0;
    const isRunning = status === "running";

    // Truncate long output for collapsed view
    const truncatedOutput =
        output && output.length > 200 ? output.slice(0, 200) + "…" : output;

    return (
        <div
            className={cn(
                "overflow-hidden rounded-lg border",
                "bg-gradient-to-br from-purple-500/5 to-blue-500/5",
                "border-purple-500/20",
                status === "error" && "border-red-500/30 from-red-500/5 to-red-500/5"
            )}
        >
            {/* Header */}
            <div
                className={cn(
                    "flex items-center gap-2 px-3 py-2",
                    "bg-gradient-to-r from-purple-500/10 to-transparent",
                    "border-b border-purple-500/10",
                    hasOutput && "cursor-pointer hover:bg-purple-500/5"
                )}
                onClick={() => hasOutput && setIsExpanded(!isExpanded)}
            >
                {/* Status icon */}
                {isRunning ? (
                    <CircleNotchIcon className="h-4 w-4 animate-spin text-purple-400" />
                ) : status === "error" ? (
                    <WarningCircleIcon className="h-4 w-4 text-red-400" />
                ) : (
                    <RobotIcon className="h-4 w-4 text-purple-400" />
                )}

                {/* Agent info */}
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <span className="text-foreground/90 text-sm font-medium">
                            {displayName}
                        </span>
                        {status === "completed" && (
                            <CheckCircleIcon className="h-3.5 w-3.5 text-green-400" />
                        )}
                    </div>
                    {description && (
                        <p className="text-muted-foreground truncate text-xs">
                            {description}
                        </p>
                    )}
                </div>

                {/* Expand indicator */}
                {hasOutput && (
                    <span className="text-muted-foreground text-xs">
                        {isExpanded ? "▼" : "▶"}
                    </span>
                )}
            </div>

            {/* Error message */}
            {error && (
                <div className="border-t border-red-500/20 bg-red-500/10 px-3 py-2">
                    <p className="text-sm text-red-400">{error}</p>
                </div>
            )}

            {/* Output - collapsed preview or expanded full */}
            {hasOutput && !error && (
                <div className="bg-black/20 px-3 py-2">
                    {isExpanded ? (
                        <div className="text-foreground/80 max-h-96 overflow-y-auto font-mono text-sm text-xs whitespace-pre-wrap">
                            {output}
                        </div>
                    ) : (
                        <p className="text-muted-foreground line-clamp-2 text-xs">
                            {truncatedOutput}
                        </p>
                    )}
                </div>
            )}

            {/* Running indicator */}
            {isRunning && !hasOutput && (
                <div className="text-muted-foreground flex items-center gap-2 px-3 py-2 text-xs">
                    <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-purple-400" />
                    Working...
                </div>
            )}
        </div>
    );
}
