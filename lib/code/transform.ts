/**
 * Claude Code Tool State Transformation
 *
 * Transforms streaming tool events into accumulated state that persists
 * through the tool lifecycle. Tools never disappear - they transition
 * through states: streaming → available → complete/error.
 *
 * This solves the race condition where clearing transient messages on
 * tool-result caused tools to vanish before parts were populated.
 */

import { logger } from "@/lib/logger";

/**
 * Tool lifecycle states
 *
 * - input-streaming: Tool announced, arguments arriving
 * - input-available: Arguments complete, tool executing
 * - output-available: Execution succeeded, result available
 * - output-error: Execution failed with error
 */
export type ToolState =
    | "input-streaming"
    | "input-available"
    | "output-available"
    | "output-error";

/**
 * Renderable tool part - what the frontend receives and displays
 */
export interface RenderableToolPart {
    type: `tool-${string}`;
    toolCallId: string;
    toolName: string;
    state: ToolState;
    input: Record<string, unknown>;
    output?: unknown;
    errorText?: string;
    elapsedSeconds?: number;
}

/**
 * Content order entry - tracks chronological order of tools and text segments
 * Used to reconstruct proper interleaving after streaming ends
 */
export interface ContentOrderEntry {
    type: "tool" | "text";
    /** toolCallId for tools, `text-${index}` for text segments */
    id: string;
}

/**
 * Text segment - actual text content for a segment
 * AI SDK concatenates all text into one part, so we track segments separately
 */
export interface TextSegment {
    id: string;
    text: string;
}

/**
 * Tool state accumulator
 *
 * Maintains accumulated state for all tools in a streaming session.
 * State only moves forward - tools never disappear.
 *
 * Also tracks content order to reconstruct proper text/tool interleaving
 * after streaming ends (AI SDK doesn't preserve this order in message.parts).
 */
export class ToolStateAccumulator {
    private tools = new Map<string, RenderableToolPart>();
    private inputBuffers = new Map<string, string>();
    private contentOrder: ContentOrderEntry[] = [];
    private textSegments = new Map<string, string>();
    private lastChunkWasText = false;
    private textSegmentIndex = 0;
    private currentTextSegmentId: string | null = null;

    /**
     * Handle tool-input-start chunk
     * Creates tool in streaming state
     */
    onInputStart(toolCallId: string, toolName: string): RenderableToolPart {
        const tool: RenderableToolPart = {
            type: `tool-${toolName}` as `tool-${string}`,
            toolCallId,
            toolName,
            state: "input-streaming",
            input: {},
        };
        this.tools.set(toolCallId, tool);
        this.inputBuffers.set(toolCallId, "");

        // Track in content order (tools interrupt text flow)
        this.contentOrder.push({ type: "tool", id: toolCallId });
        this.lastChunkWasText = false;
        this.currentTextSegmentId = null; // End current text segment

        logger.debug({ toolName, toolCallId }, "Tool input started");
        return tool;
    }

    /**
     * Handle text-delta chunk
     * Tracks text segments for content ordering and accumulates text content
     * @param delta The text delta content (optional for backwards compatibility)
     */
    onTextDelta(delta?: string): void {
        // Only record when transitioning from non-text to text
        // (consecutive text-delta chunks are one segment)
        if (!this.lastChunkWasText) {
            const id = `text-${this.textSegmentIndex++}`;
            this.contentOrder.push({ type: "text", id });
            this.currentTextSegmentId = id;
            this.textSegments.set(id, "");
            this.lastChunkWasText = true;
        }

        // Accumulate text content if provided
        if (delta && this.currentTextSegmentId) {
            const current = this.textSegments.get(this.currentTextSegmentId) ?? "";
            this.textSegments.set(this.currentTextSegmentId, current + delta);
        }
    }

    /**
     * Handle tool-input-delta chunk
     * Accumulates JSON input as it streams
     */
    onInputDelta(toolCallId: string, partialJson: string): RenderableToolPart | null {
        const tool = this.tools.get(toolCallId);
        if (!tool) return null;

        // Accumulate partial JSON
        const buffer = (this.inputBuffers.get(toolCallId) ?? "") + partialJson;
        this.inputBuffers.set(toolCallId, buffer);

        // Try to parse accumulated JSON
        try {
            tool.input = JSON.parse(buffer);
        } catch {
            // Still incomplete, that's fine
        }

        return tool;
    }

    /**
     * Handle tool-call chunk
     * Transitions to input-available with complete args
     */
    onToolCall(
        toolCallId: string,
        toolName: string,
        input: Record<string, unknown>
    ): RenderableToolPart {
        let tool = this.tools.get(toolCallId);

        if (!tool) {
            // Handle late arrival - create tool if we missed input-start
            tool = {
                type: `tool-${toolName}` as `tool-${string}`,
                toolCallId,
                toolName,
                state: "input-available",
                input,
            };
            this.tools.set(toolCallId, tool);

            // Add to content order so late-arrival tools appear in correct position
            this.contentOrder.push({ type: "tool", id: toolCallId });
            this.lastChunkWasText = false;
        } else {
            tool.state = "input-available";
            tool.input = input;
        }

        logger.debug({ toolName, toolCallId }, "Tool call complete");
        return tool;
    }

    /**
     * Handle tool_progress event
     * Updates elapsed time while tool executes
     */
    onProgress(toolCallId: string, elapsedSeconds: number): RenderableToolPart | null {
        const tool = this.tools.get(toolCallId);
        if (!tool) return null;

        tool.elapsedSeconds = elapsedSeconds;
        return tool;
    }

    /**
     * Handle tool-result chunk
     * Transitions to output-available or output-error
     */
    onResult(
        toolCallId: string,
        output: unknown,
        isError: boolean,
        errorText?: string
    ): RenderableToolPart | null {
        const tool = this.tools.get(toolCallId);
        if (!tool) {
            logger.warn({ toolCallId }, "Tool result for unknown tool");
            return null;
        }

        if (isError) {
            tool.state = "output-error";
            tool.errorText = errorText ?? String(output);
        } else {
            tool.state = "output-available";
            tool.output = output;
        }

        // Clear elapsed time on completion
        tool.elapsedSeconds = undefined;

        logger.debug(
            { toolCallId, state: tool.state, isError },
            "Tool result received"
        );
        return tool;
    }

    /**
     * Get current tool state
     */
    getTool(toolCallId: string): RenderableToolPart | undefined {
        return this.tools.get(toolCallId);
    }

    /**
     * Get all tools as array (for rendering)
     */
    getAllTools(): RenderableToolPart[] {
        return Array.from(this.tools.values());
    }

    /**
     * Get content order (sequence of tools and text segments)
     */
    getContentOrder(): ContentOrderEntry[] {
        return [...this.contentOrder];
    }

    /**
     * Get text segments as array
     * Returns actual text content for each segment (AI SDK concatenates all text,
     * so we need to track segments separately for proper interleaving)
     */
    getTextSegments(): TextSegment[] {
        return Array.from(this.textSegments.entries()).map(([id, text]) => ({
            id,
            text,
        }));
    }

    /**
     * Serialize all tools for data stream emission
     */
    toDataPart(): { type: "tool-state"; tools: RenderableToolPart[] } {
        return {
            type: "tool-state",
            tools: this.getAllTools(),
        };
    }
}

/**
 * Create human-readable status message for tool
 */
export function getToolStatusMessage(
    toolName: string,
    args?: Record<string, unknown>
): string {
    const getFilename = (path?: string) => {
        if (!path) return "file";
        const parts = path.split("/");
        return parts[parts.length - 1] || "file";
    };

    const truncate = (str: string | undefined, maxLen: number) => {
        if (!str) return "";
        return str.length > maxLen ? str.slice(0, maxLen) + "…" : str;
    };

    switch (toolName) {
        case "Read":
            return `Reading ${getFilename(args?.file_path as string)}`;
        case "Write":
            return `Writing ${getFilename(args?.file_path as string)}`;
        case "Edit":
            return `Editing ${getFilename(args?.file_path as string)}`;
        case "Bash": {
            const cmd = args?.command as string | undefined;
            const desc = args?.description as string | undefined;
            if (desc) return truncate(desc, 50);
            if (cmd) return `Running: ${truncate(cmd, 40)}`;
            return "Running command";
        }
        case "Glob":
            return `Finding ${(args?.pattern as string) || "files"}`;
        case "Grep": {
            const pattern = args?.pattern as string | undefined;
            return pattern ? `Searching: ${truncate(pattern, 35)}` : "Searching";
        }
        case "Task": {
            const agentType = args?.subagent_type as string | undefined;
            const desc = args?.description as string | undefined;
            if (agentType && desc) {
                return `${agentType}: ${truncate(desc, 40)}`;
            }
            return agentType ? `Spawning ${agentType}` : "Spawning agent";
        }
        case "WebFetch": {
            const url = args?.url as string | undefined;
            if (url) {
                try {
                    return `Fetching ${new URL(url).hostname}`;
                } catch {
                    return `Fetching ${truncate(url, 40)}`;
                }
            }
            return "Fetching web page";
        }
        case "WebSearch":
            return `Searching: ${truncate(args?.query as string, 35) || "web"}`;
        case "TodoWrite":
            return "Updating task list";
        case "LSP": {
            const op = args?.operation as string | undefined;
            const file = getFilename(args?.filePath as string);
            if (op && file !== "file") return `${op} in ${file}`;
            return op ? `Code: ${op}` : "Analyzing code";
        }
        case "NotebookEdit":
            return `Editing ${getFilename(args?.notebook_path as string)}`;
        case "AskUserQuestion":
            return "Waiting for your input";
        default:
            return toolName;
    }
}

/**
 * Get icon for tool type
 */
export function getToolIcon(toolName: string): string {
    const icons: Record<string, string> = {
        Read: "📖",
        Write: "✍️",
        Edit: "✏️",
        Bash: "💻",
        Glob: "📁",
        Grep: "🔎",
        Task: "🤖",
        WebFetch: "🌐",
        WebSearch: "🔍",
        TodoWrite: "📋",
        LSP: "🧠",
        NotebookEdit: "📓",
        AskUserQuestion: "❓",
        EnterPlanMode: "📐",
        ExitPlanMode: "✅",
        KillShell: "🛑",
    };
    return icons[toolName] ?? "⚙️";
}

/**
 * Format terminal output for web display
 *
 * Claude Code outputs are designed for terminal display with:
 * - ANSI escape codes for colors
 * - Line number prefixes like "     1→"
 * - Tab characters and terminal formatting
 *
 * This cleans them up for readable web display.
 */
export function formatTerminalOutput(output: string, toolName?: string): string {
    if (!output) return "";

    let result = output;

    // Strip ANSI escape codes (color codes, cursor movement, etc.)

    result = result.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "");

    result = result.replace(/\x1b\][^\x07]*\x07/g, ""); // OSC sequences

    // For Read/Write/Edit tools, clean up line number prefixes
    // Format: "     1→content" or "    12→content" (right-aligned numbers with arrow)
    if (toolName === "Read" || toolName === "Write" || toolName === "Edit") {
        // Match line numbers with arrow separator
        result = result.replace(/^\s*\d+→/gm, "");
    }

    // Clean up excessive blank lines (more than 2 in a row)
    result = result.replace(/\n{4,}/g, "\n\n\n");

    // Trim leading/trailing whitespace from the whole output
    result = result.trim();

    return result;
}

/**
 * Parse Bash tool output which may have complex structure
 */
export function parseBashOutput(output: unknown): {
    stdout: string;
    stderr?: string;
    exitCode?: number;
} {
    if (typeof output === "string") {
        return { stdout: output };
    }

    if (typeof output === "object" && output !== null) {
        const obj = output as Record<string, unknown>;
        return {
            stdout: String(obj.stdout ?? obj.output ?? ""),
            stderr: obj.stderr ? String(obj.stderr) : undefined,
            exitCode: typeof obj.exitCode === "number" ? obj.exitCode : undefined,
        };
    }

    return { stdout: String(output ?? "") };
}
