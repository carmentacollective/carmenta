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
                { status: 400 }
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
                error:
                    error instanceof Error
                        ? error.message
                        : "Document extraction failed. Please try again.",
            },
            { status: 500 }
        );
    }
}
