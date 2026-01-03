/**
 * Types for tool stream integration tests.
 *
 * These types define the scenario structure for testing tool calls
 * as if they were invoked by an LLM.
 */

import type { ToolStatus } from "@/lib/tools/tool-config";

/**
 * A stream chunk that can be sent through the mock model.
 * Based on AI SDK v6 LanguageModelV3StreamPart types.
 */
export type MockStreamChunk =
    | { type: "text-start"; id: string }
    | { type: "text-delta"; id: string; delta: string }
    | { type: "text-end"; id: string }
    | { type: "reasoning"; text: string }
    | {
          type: "tool-call";
          toolCallId: string;
          toolName: string;
          input: Record<string, unknown>;
      }
    | {
          type: "tool-result";
          toolCallId: string;
          toolName: string;
          output: Record<string, unknown>;
      }
    | {
          type: "finish";
          finishReason: "stop" | "tool-calls" | "length" | "content-filter";
          usage: { inputTokens: number; outputTokens: number };
      };

/**
 * Assertions to run against the rendered output.
 */
export interface RenderAssertions {
    /** Text content that should be present */
    hasText?: string[];

    /** Text content that should NOT be present */
    notHasText?: string[];

    /** CSS selectors that should match elements */
    hasElement?: string[];

    /** Test IDs that should be present */
    hasTestId?: string[];

    /** Tool should be in completed status */
    statusCompleted?: boolean;

    /** Tool should be in error status */
    statusError?: boolean;

    /** Custom assertion function for complex checks */
    custom?: (container: HTMLElement) => void;
}

/**
 * A complete test scenario for a tool invocation.
 */
export interface ToolScenario {
    /** Unique name for this scenario */
    name: string;

    /** Human-readable description */
    description: string;

    /** The tool being tested */
    toolName: string;

    /** Stream chunks to send through the mock model */
    chunks: MockStreamChunk[];

    /**
     * Mock tool result to inject.
     * If not provided, the real tool will execute (for pure tools like calculate).
     */
    mockToolResult?: Record<string, unknown>;

    /**
     * Mock tool error to inject (simulates tool failure).
     */
    mockToolError?: string;

    /** Assertions to run on the rendered output */
    assertions: RenderAssertions;

    /**
     * Whether to skip this scenario.
     * Use for WIP scenarios or environment-specific tests.
     */
    skip?: boolean;

    /**
     * Mark as only - run just this scenario (for debugging).
     */
    only?: boolean;
}

/**
 * Props passed to tool renderers during testing.
 */
export interface ToolRenderProps {
    toolCallId: string;
    toolName: string;
    status: ToolStatus;
    input: Record<string, unknown>;
    output?: Record<string, unknown>;
    error?: string;
}
