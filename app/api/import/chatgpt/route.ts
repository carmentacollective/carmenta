/**
 * ChatGPT Import API
 *
 * Handles parsing and importing ChatGPT data exports.
 * POST: Upload and parse ZIP file, return conversation metadata
 */

import { NextRequest } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import * as Sentry from "@sentry/nextjs";

import { logger } from "@/lib/logger";
import { parseExportZip, type ParsedConversation } from "@/lib/import/chatgpt-parser";
import {
    unauthorizedResponse,
    validationErrorResponse,
    serverErrorResponse,
} from "@/lib/api/responses";

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

export interface ImportParseResponse {
    success: true;
    importId: string;
    conversations: Array<{
        id: string;
        title: string;
        createdAt: string;
        messageCount: number;
        model: string | null;
        isArchived: boolean;
    }>;
    stats: {
        conversationCount: number;
        totalMessageCount: number;
        dateRange: {
            earliest: string;
            latest: string;
        };
    };
}

export interface ImportErrorResponse {
    success: false;
    error: string;
}

/**
 * POST /api/import/chatgpt
 * Upload and parse a ChatGPT export ZIP file
 */
export async function POST(request: NextRequest): Promise<Response> {
    const user = await currentUser();

    if (!user?.primaryEmailAddress?.emailAddress) {
        return unauthorizedResponse();
    }

    const userEmail = user.primaryEmailAddress.emailAddress;
    const requestLogger = logger.child({ userEmail, route: "import/chatgpt" });

    try {
        // Get form data with file
        const formData = await request.formData();
        const file = formData.get("file");

        if (!file || !(file instanceof File)) {
            return validationErrorResponse(
                { file: "No file provided" },
                "Please select a ChatGPT export ZIP file to upload."
            );
        }

        // Validate file type
        if (!file.name.endsWith(".zip")) {
            return validationErrorResponse(
                { file: "Invalid file type" },
                "Please upload a ZIP file. ChatGPT exports are downloaded as .zip files."
            );
        }

        // Validate file size
        if (file.size > MAX_FILE_SIZE) {
            return validationErrorResponse(
                { file: "File too large" },
                `File size exceeds the 100MB limit. Your file is ${Math.round(file.size / 1024 / 1024)}MB.`
            );
        }

        requestLogger.info(
            { fileName: file.name, fileSize: file.size },
            "Parsing ChatGPT export"
        );

        // Parse the ZIP file
        const arrayBuffer = await file.arrayBuffer();
        const result = await parseExportZip(arrayBuffer);

        if (result.errors.length > 0) {
            return validationErrorResponse(
                { parseErrors: result.errors },
                result.errors[0]
            );
        }

        if (result.conversations.length === 0) {
            return validationErrorResponse(
                { conversations: "empty" },
                "No conversations found in the export. Please ensure you uploaded a valid ChatGPT data export."
            );
        }

        // Generate import ID for tracking
        const importId = `import_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

        // Store parsed data in memory/cache for commit step
        // For now, we'll include full data in response
        // Production should use Redis or similar for large exports

        requestLogger.info(
            {
                importId,
                conversationCount: result.conversations.length,
                messageCount: result.totalMessageCount,
            },
            "ChatGPT export parsed successfully"
        );

        const response: ImportParseResponse = {
            success: true,
            importId,
            conversations: result.conversations.map((conv: ParsedConversation) => ({
                id: conv.id,
                title: conv.title,
                createdAt: conv.createdAt.toISOString(),
                messageCount: conv.messageCount,
                model: conv.model,
                isArchived: conv.isArchived,
            })),
            stats: {
                conversationCount: result.conversations.length,
                totalMessageCount: result.totalMessageCount,
                dateRange: {
                    earliest: result.dateRange.earliest.toISOString(),
                    latest: result.dateRange.latest.toISOString(),
                },
            },
        };

        return new Response(JSON.stringify(response), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    } catch (error) {
        Sentry.captureException(error, {
            tags: { component: "import", platform: "chatgpt" },
            extra: { userEmail },
        });

        return serverErrorResponse(error, {
            userEmail,
            route: "import/chatgpt",
        });
    }
}
