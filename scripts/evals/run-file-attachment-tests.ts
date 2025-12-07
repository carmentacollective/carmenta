#!/usr/bin/env bun
/**
 * File Attachment Tests
 *
 * Smoke tests for file handling across models. Validates:
 * - Model routing based on file type (audio → Gemini, images/PDF → Claude)
 * - LLM can process file content
 * - Response indicates file was understood
 *
 * Usage:
 *   bun scripts/evals/run-file-attachment-tests.ts [options]
 *
 * Options:
 *   --type=X       Run only tests for file type (image, pdf, audio, text)
 *   --test=ID      Run a single test by ID
 *   --verbose      Show full response content
 *   --base-url=X   Override API base URL (default: http://localhost:3000)
 */

import { readFile } from "fs/promises";
import { join, basename, dirname } from "path";
import { fileURLToPath } from "url";
import {
    getAllFileTests,
    getTestsByFileType,
    getFileTestById,
    type FileAttachmentTest,
} from "./file-attachment-queries";

// Parse CLI args
const args = process.argv.slice(2);
const flags = {
    verbose: args.includes("--verbose"),
    fileType: args.find((a) => a.startsWith("--type="))?.substring("--type=".length) as
        | FileAttachmentTest["fileType"]
        | undefined,
    testId: args.find((a) => a.startsWith("--test="))?.substring("--test=".length),
    baseUrl:
        args
            .find((a) => a.startsWith("--base-url="))
            ?.substring("--base-url=".length) ?? "http://localhost:3000",
};

// Load JWT from environment
const JWT_TOKEN = process.env.TEST_USER_TOKEN;
if (!JWT_TOKEN) {
    console.error("ERROR: TEST_USER_TOKEN not set in environment");
    console.error(
        "Create a long-lived JWT in Clerk Dashboard and add it to .env.local"
    );
    process.exit(1);
}

// Fixtures directory (works in both Node.js and Bun)
const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, "fixtures");

interface TestResult {
    test: FileAttachmentTest;
    success: boolean;
    duration: number;
    response: {
        status: number;
        model?: string;
        responseText: string;
        error?: string;
    };
    validations: {
        name: string;
        passed: boolean;
        expected: string;
        actual: string;
    }[];
}

/**
 * Read a fixture file and convert to base64 data URL
 */
async function readFixtureAsDataUrl(
    fixturePath: string,
    mimeType: string
): Promise<string> {
    const fullPath = join(FIXTURES_DIR, fixturePath);
    const buffer = await readFile(fullPath);
    const base64 = buffer.toString("base64");
    return `data:${mimeType};base64,${base64}`;
}

/**
 * Read a text fixture file as UTF-8 string
 */
async function readFixtureAsText(fixturePath: string): Promise<string> {
    const fullPath = join(FIXTURES_DIR, fixturePath);
    return await readFile(fullPath, "utf-8");
}

/**
 * Build UIMessage format with file attachment
 *
 * Uses AI SDK v5 FileUIPart format:
 * - type: "file"
 * - mediaType: IANA media type (e.g., "image/png")
 * - url: Data URL or hosted URL
 * - filename: Optional filename
 */
function buildMessageWithFile(
    content: string,
    fileUrl: string,
    mediaType: string,
    filename: string
) {
    return {
        id: `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        role: "user",
        content,
        parts: [
            { type: "text", text: content },
            {
                type: "file",
                url: fileUrl,
                mediaType,
                filename,
            },
        ],
    };
}

/**
 * Build UIMessage with inline text content (no file attachment)
 *
 * For text/markdown files, send content inline rather than as attachment.
 * Claude's API only accepts PDFs for document attachments.
 */
function buildMessageWithInlineText(
    prompt: string,
    textContent: string,
    filename: string
) {
    const content = `${prompt}\n\n---\nFile: ${filename}\n---\n\n${textContent}`;
    return {
        id: `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        role: "user",
        content,
        parts: [{ type: "text", text: content }],
    };
}

/**
 * Parse concierge headers from response
 */
function parseHeaders(headers: Headers) {
    const modelId = headers.get("X-Concierge-Model-Id");
    return {
        model: modelId ?? undefined,
    };
}

/**
 * Consume streaming response and extract content
 */
async function consumeStream(response: Response): Promise<string> {
    const reader = response.body?.getReader();
    if (!reader) {
        return "";
    }

    const decoder = new TextDecoder();
    let extractedText = "";
    let buffer = "";

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            buffer += chunk;
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
                if (line.startsWith("data: ")) {
                    try {
                        const data = JSON.parse(line.slice(6));
                        if (data.type === "text-delta" && data.delta) {
                            extractedText += data.delta;
                        }
                    } catch {
                        // Ignore parse errors
                    }
                }
            }
        }
    } catch {
        // Stream read error
    }

    return extractedText;
}

/**
 * Run a single file attachment test
 */
async function runTest(test: FileAttachmentTest): Promise<TestResult> {
    const startTime = Date.now();
    const validations: TestResult["validations"] = [];

    try {
        // Build message based on whether content should be inline or attached
        let message;

        if (test.sendAsInline) {
            // Read text content and send inline
            try {
                const textContent = await readFixtureAsText(test.fixturePath);
                message = buildMessageWithInlineText(
                    test.prompt,
                    textContent,
                    basename(test.fixturePath)
                );
            } catch (error) {
                return {
                    test,
                    success: false,
                    duration: Date.now() - startTime,
                    response: {
                        status: 0,
                        responseText: "",
                        error: `Fixture file not found: ${test.fixturePath}`,
                    },
                    validations: [
                        {
                            name: "Fixture exists",
                            passed: false,
                            expected: test.fixturePath,
                            actual: "file not found",
                        },
                    ],
                };
            }
        } else {
            // Read as binary and send as file attachment
            try {
                const fileUrl = await readFixtureAsDataUrl(
                    test.fixturePath,
                    test.mimeType
                );
                message = buildMessageWithFile(
                    test.prompt,
                    fileUrl,
                    test.mimeType,
                    basename(test.fixturePath)
                );
            } catch (error) {
                return {
                    test,
                    success: false,
                    duration: Date.now() - startTime,
                    response: {
                        status: 0,
                        responseText: "",
                        error: `Fixture file not found: ${test.fixturePath}`,
                    },
                    validations: [
                        {
                            name: "Fixture exists",
                            passed: false,
                            expected: test.fixturePath,
                            actual: "file not found",
                        },
                    ],
                };
            }
        }

        const response = await fetch(`${flags.baseUrl}/api/connection`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${JWT_TOKEN}`,
            },
            body: JSON.stringify({
                messages: [message],
            }),
        });

        const duration = Date.now() - startTime;
        const headers = parseHeaders(response.headers);

        // Handle error responses
        if (!response.ok) {
            let errorText = "";
            const clonedResponse = response.clone();
            try {
                const errorBody = await response.json();
                errorText = errorBody.error || JSON.stringify(errorBody);
            } catch {
                errorText = await clonedResponse.text();
            }

            validations.push({
                name: "HTTP Status",
                passed: test.expectations.shouldSucceed === false,
                expected: test.expectations.shouldSucceed ? "200" : "non-200",
                actual: String(response.status),
            });

            return {
                test,
                success: test.expectations.shouldSucceed === false,
                duration,
                response: {
                    status: response.status,
                    ...headers,
                    responseText: "",
                    error: errorText,
                },
                validations,
            };
        }

        // Consume streaming response
        const text = await consumeStream(response);

        // Validate expectations
        const exp = test.expectations;

        // Status check
        if (exp.shouldSucceed !== undefined) {
            validations.push({
                name: "HTTP Status",
                passed: exp.shouldSucceed === (response.status === 200),
                expected: exp.shouldSucceed ? "200" : "non-200",
                actual: String(response.status),
            });
        }

        // Model check
        if (exp.model) {
            const modelMatches = headers.model
                ?.toLowerCase()
                .includes(exp.model.toLowerCase());
            validations.push({
                name: "Model",
                passed: !!modelMatches,
                expected: exp.model,
                actual: headers.model ?? "unknown",
            });
        }

        // Response indicates file was processed (basic check: we got a non-empty response)
        if (text.length > 0) {
            validations.push({
                name: "Response received",
                passed: true,
                expected: "non-empty response",
                actual: `${text.length} chars`,
            });
        } else {
            validations.push({
                name: "Response received",
                passed: false,
                expected: "non-empty response",
                actual: "empty response",
            });
        }

        // If we have a specific content check
        if (exp.responseIndicates) {
            const contains = text
                .toLowerCase()
                .includes(exp.responseIndicates.toLowerCase());
            validations.push({
                name: "Response indicates",
                passed: contains,
                expected: `contains "${exp.responseIndicates}"`,
                actual: contains ? "yes" : "no",
            });
        }

        const allPassed = validations.every((v) => v.passed);

        return {
            test,
            success: allPassed,
            duration,
            response: {
                status: response.status,
                ...headers,
                responseText: text,
            },
            validations,
        };
    } catch (error) {
        const duration = Date.now() - startTime;
        return {
            test,
            success: false,
            duration,
            response: {
                status: 0,
                responseText: "",
                error: error instanceof Error ? error.message : String(error),
            },
            validations: [
                {
                    name: "Request",
                    passed: false,
                    expected: "no error",
                    actual: error instanceof Error ? error.message : String(error),
                },
            ],
        };
    }
}

/**
 * Format duration for display
 */
function formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
}

/**
 * Print test result
 */
function printResult(result: TestResult, index: number, total: number) {
    const status = result.success ? "\x1b[32m PASS \x1b[0m" : "\x1b[31m FAIL \x1b[0m";
    const duration = formatDuration(result.duration);

    console.log(`\n[${index + 1}/${total}] ${status} ${result.test.id} (${duration})`);
    console.log(`   ${result.test.description}`);
    console.log(`   File: ${result.test.fixturePath} (${result.test.mimeType})`);

    if (result.response.model) {
        console.log(`   Model: ${result.response.model}`);
    }

    // Show validation results
    for (const v of result.validations) {
        const icon = v.passed ? "\x1b[32m\u2713\x1b[0m" : "\x1b[31m\u2717\x1b[0m";
        if (!v.passed) {
            console.log(
                `   ${icon} ${v.name}: expected ${v.expected}, got ${v.actual}`
            );
        } else if (flags.verbose) {
            console.log(`   ${icon} ${v.name}: ${v.actual}`);
        }
    }

    if (result.response.error) {
        console.log(`   \x1b[31mError: ${result.response.error}\x1b[0m`);
    }

    if (flags.verbose && result.response.responseText) {
        const preview = result.response.responseText.slice(0, 300);
        console.log(
            `   Response: ${preview}${result.response.responseText.length > 300 ? "..." : ""}`
        );
    }
}

/**
 * Print summary
 */
function printSummary(results: TestResult[]) {
    const passed = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;
    const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

    console.log("\n" + "=".repeat(60));
    console.log("SUMMARY");
    console.log("=".repeat(60));
    console.log(
        `Total: ${results.length} | \x1b[32mPassed: ${passed}\x1b[0m | \x1b[31mFailed: ${failed}\x1b[0m`
    );
    console.log(`Duration: ${formatDuration(totalDuration)}`);

    // Group by file type
    const byType = new Map<string, TestResult[]>();
    for (const r of results) {
        const type = r.test.fileType;
        if (!byType.has(type)) byType.set(type, []);
        byType.get(type)!.push(r);
    }

    console.log("\nBy File Type:");
    for (const [type, typeResults] of byType) {
        const typePassed = typeResults.filter((r) => r.success).length;
        const status =
            typePassed === typeResults.length
                ? "\x1b[32m\u2713\x1b[0m"
                : "\x1b[31m\u2717\x1b[0m";
        console.log(`  ${status} ${type}: ${typePassed}/${typeResults.length}`);
    }

    if (failed > 0) {
        console.log("\nFailed Tests:");
        for (const r of results.filter((r) => !r.success)) {
            console.log(`  - ${r.test.id}: ${r.test.description}`);
        }
    }
}

/**
 * Main entry point
 */
async function main() {
    console.log("=".repeat(60));
    console.log("CARMENTA FILE ATTACHMENT TESTS");
    console.log("=".repeat(60));
    console.log(`Base URL: ${flags.baseUrl}`);
    console.log(`Fixtures: ${FIXTURES_DIR}`);
    console.log(`JWT Token: ${JWT_TOKEN!.slice(0, 20)}...`);

    // Select tests to run
    let tests: FileAttachmentTest[];
    if (flags.testId) {
        const test = getFileTestById(flags.testId);
        if (!test) {
            console.error(`Test not found: ${flags.testId}`);
            process.exit(1);
        }
        tests = [test];
    } else if (flags.fileType) {
        tests = getTestsByFileType(flags.fileType);
        if (tests.length === 0) {
            console.error(`No tests found for file type: ${flags.fileType}`);
            process.exit(1);
        }
    } else {
        tests = getAllFileTests();
    }

    console.log(`Running ${tests.length} tests...\n`);

    // Run tests sequentially
    const results: TestResult[] = [];
    for (let i = 0; i < tests.length; i++) {
        const test = tests[i];
        const result = await runTest(test);
        results.push(result);
        printResult(result, i, tests.length);
    }

    printSummary(results);

    // Exit with error code if any tests failed
    const failed = results.filter((r) => !r.success).length;
    process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
});
