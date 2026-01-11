/**
 * Document Extraction API
 *
 * POST /api/documents/extract - Extract content from PDF/DOCX via Docling
 *
 * This endpoint is called by the upload flow for documents that benefit
 * from Docling extraction (PDFs, DOCX, PPTX). Returns markdown content
 * that can be injected into the conversation context.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import * as Sentry from "@sentry/nextjs";

import { logger } from "@/lib/logger";
import { DOCLING_CONFIG, extractDocument } from "@/lib/document-intelligence";

/** Maximum file size for extraction (50MB) */
const MAX_FILE_SIZE = 50 * 1024 * 1024;

/**
 * Map internal errors to user-friendly messages
 * Prevents leaking infrastructure details while keeping helpful error info
 */
function getUserFriendlyError(error: unknown): string {
    if (!(error instanceof Error)) {
        return "Document extraction failed. Please try again.";
    }

    const message = error.message.toLowerCase();

    // Known user-actionable errors - pass through
    if (
        message.includes("empty") ||
        message.includes("timeout") ||
        message.includes("too large") ||
        message.includes("invalid format")
    ) {
        return error.message;
    }

    // Network/infrastructure errors - generic message
    if (
        message.includes("fetch") ||
        message.includes("network") ||
        message.includes("econnrefused")
    ) {
        return "Document extraction service is temporarily unavailable. Please try again.";
    }

    // Generic fallback for unexpected errors
    return "Document extraction failed. Please try again.";
}

export async function POST(request: NextRequest) {
    const { userId } = await auth();
    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!DOCLING_CONFIG.isEnabled) {
        return NextResponse.json(
            { error: "Document extraction is not enabled" },
            { status: 503 }
        );
    }

    try {
        // Early check: reject oversized requests before reading body
        const contentLength = request.headers.get("content-length");
        if (contentLength && parseInt(contentLength) > MAX_FILE_SIZE) {
            return NextResponse.json(
                {
                    error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`,
                },
                { status: 413 }
            );
        }

        const formData = await request.formData();
        const fileField = formData.get("file");

        if (!fileField) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        if (!(fileField instanceof File)) {
            return NextResponse.json(
                { error: "Invalid request: 'file' must be a file upload" },
                { status: 400 }
            );
        }

        const file = fileField;

        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json(
                {
                    error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`,
                },
                { status: 413 }
            );
        }

        if (!DOCLING_CONFIG.shouldExtract(file.type)) {
            return NextResponse.json(
                {
                    error: `Unsupported file type: ${file.type}. Supported: PDF, DOCX, PPTX`,
                },
                { status: 400 }
            );
        }

        logger.info(
            { userId, filename: file.name, type: file.type, size: file.size },
            "Starting document extraction"
        );

        const arrayBuffer = await file.arrayBuffer();
        const result = await extractDocument(arrayBuffer, file.name);

        logger.info(
            {
                userId,
                filename: file.name,
                processingTimeMs: result.processingTimeMs,
                contentLength: result.markdown.length,
            },
            "Document extraction complete"
        );

        return NextResponse.json({
            markdown: result.markdown,
            processingTimeMs: result.processingTimeMs,
        });
    } catch (error) {
        logger.error({ error, userId }, "Document extraction failed");
        Sentry.captureException(error, {
            tags: { route: "/api/documents/extract" },
            extra: { userId },
        });

        return NextResponse.json(
            {
                error: getUserFriendlyError(error),
            },
            { status: 500 }
        );
    }
}
