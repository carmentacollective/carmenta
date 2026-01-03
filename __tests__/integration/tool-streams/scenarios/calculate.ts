/**
 * Calculate tool scenarios.
 *
 * The calculate tool is a pure function (no external deps),
 * so we can run the real tool and verify output.
 */

import type { ToolScenario } from "../helpers/types";
import { buildToolCallChunks } from "../helpers/mock-stream";

export const scenarios: ToolScenario[] = [
    {
        name: "calculate-simple-arithmetic",
        description: "Model calls calculate with basic arithmetic",
        toolName: "calculate",
        chunks: buildToolCallChunks({
            toolName: "calculate",
            input: { expression: "(25 * 4) + 17" },
            output: { expression: "(25 * 4) + 17", result: "117", numeric: 117 },
        }),
        mockToolResult: {
            expression: "(25 * 4) + 17",
            result: "117",
            numeric: 117,
        },
        assertions: {
            hasText: ["117"],
            hasTestId: ["tool-calculate"],
            statusCompleted: true,
        },
    },

    {
        name: "calculate-trigonometry",
        description: "Model calls calculate with trig functions",
        toolName: "calculate",
        chunks: buildToolCallChunks({
            toolName: "calculate",
            input: { expression: "sin(45 deg)" },
            output: {
                expression: "sin(45 deg)",
                result: "0.7071067811865476",
                numeric: 0.7071067811865476,
            },
        }),
        mockToolResult: {
            expression: "sin(45 deg)",
            result: "0.7071067811865476",
            numeric: 0.7071067811865476,
        },
        assertions: {
            hasText: ["0.707"],
            statusCompleted: true,
        },
    },

    {
        name: "calculate-combinations",
        description: "Model calls calculate with combination notation",
        toolName: "calculate",
        chunks: buildToolCallChunks({
            toolName: "calculate",
            input: { expression: "C(10, 3)" },
            output: { expression: "C(10, 3)", result: "120", numeric: 120 },
        }),
        mockToolResult: {
            expression: "C(10, 3)",
            result: "120",
            numeric: 120,
        },
        assertions: {
            hasText: ["120"],
            statusCompleted: true,
        },
    },

    {
        name: "calculate-unit-conversion",
        description: "Model calls calculate for unit conversion",
        toolName: "calculate",
        chunks: buildToolCallChunks({
            toolName: "calculate",
            input: { expression: "10 km to miles" },
            output: {
                expression: "10 km to miles",
                result: "6.2137119223733395 miles",
                numeric: null,
            },
        }),
        mockToolResult: {
            expression: "10 km to miles",
            result: "6.2137119223733395 miles",
            numeric: null,
        },
        assertions: {
            hasText: ["6.21", "miles"],
            statusCompleted: true,
        },
    },

    {
        name: "calculate-error-invalid-expression",
        description: "Model calls calculate with invalid expression",
        toolName: "calculate",
        chunks: buildToolCallChunks({
            toolName: "calculate",
            input: { expression: "2 ++ 2" },
            output: {
                expression: "2 ++ 2",
                error: true,
                message: "Unexpected operator +",
            },
        }),
        mockToolResult: {
            expression: "2 ++ 2",
            error: true,
            message: "Unexpected operator +",
        },
        assertions: {
            hasText: ["error", "Unexpected"],
            statusError: true,
        },
    },
];
