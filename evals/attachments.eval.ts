#!/usr/bin/env bun
/**
 * Carmenta File Attachments Eval
 *
 * Braintrust-native evaluation for file handling across different models.
 * Tests model routing for different file types and content processing.
 *
 * Usage:
 *   bunx braintrust eval evals/attachments.eval.ts
 *
 * Requires:
 *   - BRAINTRUST_API_KEY in .env.local
 *   - TEST_USER_TOKEN in .env.local (Clerk JWT for API auth)
 *   - Fixture files in evals/fixtures/
 */

import "dotenv/config";
import { Eval } from "braintrust";
import * as fs from "fs";
import * as path from "path";

// Configuration
const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const JWT_TOKEN = process.env.TEST_USER_TOKEN;
const FIXTURES_DIR = path.join(
    path.dirname(new URL(import.meta.url).pathname),
    "fixtures"
);

if (!JWT_TOKEN) {
    console.error("ERROR: TEST_USER_TOKEN not set in environment");
    console.error(
        "Create a long-lived JWT in Clerk Dashboard and add it to .env.local"
    );
    process.exit(1);
}

// Types
interface FileTestInput {
    id: string;
    description: string;
    prompt: string;
    fileType: "image" | "pdf" | "audio" | "text";
    fixturePath: string;
    mimeType: string;
    sendAsInline?: boolean;
}

interface FileTestExpectations {
    model?: string;
    responseIndicates?: string;
    shouldSucceed?: boolean;
}

interface TestCase {
    input: FileTestInput;
    expected: FileTestExpectations;
    tags?: string[];
}

interface FileTestOutput {
    text: string;
    model?: string;
    status: number;
}

/**
 * Build UIMessage format with file attachment
 */
function buildMessageWithFile(
    prompt: string,
    fileUrl: string,
    mimeType: string,
    filename: string
) {
    return {
        id: `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        role: "user",
        content: prompt,
        parts: [
            { type: "text", text: prompt },
            { type: "file", url: fileUrl, mediaType: mimeType, filename },
        ],
    };
}

/**
 * Build UIMessage format with inline text content
 */
function buildMessageWithInlineText(
    prompt: string,
    filename: string,
    fileContent: string
) {
    const fullContent = `${prompt}\n\n---\nFile: ${filename}\n---\n\n${fileContent}`;
    return {
        id: `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        role: "user",
        content: fullContent,
        parts: [{ type: "text", text: fullContent }],
    };
}

/**
 * Parse response headers
 */
function parseHeaders(headers: Headers) {
    return {
        model: headers.get("X-Concierge-Model-Id") ?? undefined,
    };
}

/**
 * Consume streaming response
 */
async function consumeStream(response: Response): Promise<string> {
    const reader = response.body?.getReader();
    if (!reader) return "";

    const decoder = new TextDecoder();
    let extractedText = "";
    let buffer = "";

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
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
 * Execute a file attachment test
 */
async function executeFileTest(input: FileTestInput): Promise<FileTestOutput> {
    const fixturePath = path.join(FIXTURES_DIR, input.fixturePath);

    // Check if fixture exists
    if (!fs.existsSync(fixturePath)) {
        return {
            text: `Fixture not found: ${input.fixturePath}`,
            status: 404,
        };
    }

    let message;

    if (input.sendAsInline) {
        // Text files: send content inline
        const fileContent = fs.readFileSync(fixturePath, "utf-8");
        message = buildMessageWithInlineText(
            input.prompt,
            input.fixturePath,
            fileContent
        );
    } else {
        // Binary files: send as base64 data URL
        const fileBuffer = fs.readFileSync(fixturePath);
        const base64 = fileBuffer.toString("base64");
        const dataUrl = `data:${input.mimeType};base64,${base64}`;
        message = buildMessageWithFile(
            input.prompt,
            dataUrl,
            input.mimeType,
            input.fixturePath
        );
    }

    const response = await fetch(`${BASE_URL}/api/connection`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${JWT_TOKEN}`,
        },
        body: JSON.stringify({ messages: [message] }),
    });

    const headers = parseHeaders(response.headers);
    const text = await consumeStream(response);

    return {
        text,
        model: headers.model,
        status: response.status,
    };
}

/**
 * Attachment scorer - validates model routing and response content
 */
function AttachmentScorer({
    output,
    expected,
}: {
    input: FileTestInput;
    output: FileTestOutput;
    expected: FileTestExpectations;
}) {
    const scores = [];

    // Model routing score
    if (expected.model) {
        const modelMatch = output.model
            ?.toLowerCase()
            .includes(expected.model.toLowerCase());
        scores.push({
            name: "Model Routing",
            score: modelMatch ? 1 : 0,
            metadata: { expected: expected.model, actual: output.model },
        });
    }

    // Response content score
    if (expected.responseIndicates) {
        const contentMatch = output.text
            .toLowerCase()
            .includes(expected.responseIndicates.toLowerCase());
        scores.push({
            name: "Response Content",
            score: contentMatch ? 1 : 0,
            metadata: {
                expected: `contains "${expected.responseIndicates}"`,
                found: contentMatch,
            },
        });
    }

    // Success score
    if (expected.shouldSucceed !== undefined) {
        const successMatch = expected.shouldSucceed
            ? output.status >= 200 && output.status < 300
            : output.status >= 400;
        scores.push({
            name: "HTTP Success",
            score: successMatch ? 1 : 0,
            metadata: {
                expected: expected.shouldSucceed ? "2xx" : "4xx/5xx",
                actual: output.status,
            },
        });
    }

    return scores;
}

/**
 * Test dataset - converted from file-attachment-queries.ts
 */
const testData: TestCase[] = [
    // IMAGE TESTS
    {
        input: {
            id: "image-png-describe",
            description: "PNG image should be processed and described",
            prompt: "What do you see in this image? Be specific about colors and shapes.",
            fileType: "image",
            fixturePath: "sample.png",
            mimeType: "image/png",
        },
        expected: {
            model: "claude",
            shouldSucceed: true,
        },
        tags: ["image", "png"],
    },
    {
        input: {
            id: "image-jpeg-describe",
            description: "JPEG image should be processed and described",
            prompt: "Describe this image in one sentence.",
            fileType: "image",
            fixturePath: "sample.jpg",
            mimeType: "image/jpeg",
        },
        expected: {
            model: "claude",
            shouldSucceed: true,
        },
        tags: ["image", "jpeg"],
    },

    // PDF TESTS
    {
        input: {
            id: "pdf-extract-text",
            description: "PDF should have text content extracted",
            prompt: "What is the main topic or title of this document?",
            fileType: "pdf",
            fixturePath: "sample.pdf",
            mimeType: "application/pdf",
        },
        expected: {
            model: "claude",
            shouldSucceed: true,
        },
        tags: ["pdf"],
    },

    // AUDIO TESTS
    {
        input: {
            id: "audio-mp3-transcribe",
            description: "MP3 audio should route to Gemini and be transcribed",
            prompt: "What is said in this audio file? Transcribe or summarize it.",
            fileType: "audio",
            fixturePath: "sample.mp3",
            mimeType: "audio/mp3",
        },
        expected: {
            model: "gemini",
            shouldSucceed: true,
        },
        tags: ["audio", "mp3"],
    },

    // TEXT FILE TESTS (sent inline)
    {
        input: {
            id: "text-plain-read",
            description: "Plain text file content should be read inline",
            prompt: "I'm sharing a text file with you. What does it say?",
            fileType: "text",
            fixturePath: "sample.txt",
            mimeType: "text/plain",
            sendAsInline: true,
        },
        expected: {
            model: "claude",
            shouldSucceed: true,
            responseIndicates: "bullet",
        },
        tags: ["text", "plain"],
    },
    {
        input: {
            id: "text-markdown-read",
            description: "Markdown file content should be read inline",
            prompt: "I'm sharing a markdown document with you. What's in it?",
            fileType: "text",
            fixturePath: "sample.md",
            mimeType: "text/markdown",
            sendAsInline: true,
        },
        expected: {
            model: "claude",
            shouldSucceed: true,
            responseIndicates: "markdown",
        },
        tags: ["text", "markdown"],
    },
];

/**
 * Run the Braintrust eval
 */
Eval("Carmenta Attachments", {
    data: () =>
        testData.map((t) => ({
            input: t.input,
            expected: t.expected,
            tags: t.tags,
            metadata: { id: t.input.id, fileType: t.input.fileType },
        })),

    task: async (input: FileTestInput): Promise<FileTestOutput> => {
        return executeFileTest(input);
    },

    scores: [AttachmentScorer],

    metadata: {
        baseUrl: BASE_URL,
        commit: process.env.COMMIT_SHA ?? "local",
        environment: process.env.NODE_ENV ?? "development",
    },
});
