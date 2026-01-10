/**
 * Anthropic/Claude Import API
 *
 * Handles parsing and importing Claude data exports.
 * POST: Upload and parse ZIP file, return conversation metadata
 */

import { NextRequest } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import * as Sentry from "@sentry/nextjs";

import { logger } from "@/lib/logger";
import { parseExportZip, type ParsedConversation } from "@/lib/import/anthropic-parser";
import {
    unauthorizedResponse,
    validationErrorResponse,
    serverErrorResponse,
} from "@/lib/api/responses";

// Route segment config for large file uploads
export const maxDuration = 300; // 5 minutes for large files
export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB - exports can be very large

/**
 * Conversation metadata for preview display
 */
export interface ConversationPreview {
    id: string;
    title: string;
    createdAt: string;
    messageCount: number;
    model: string | null;
    isArchived: boolean;
}

/**
 * Full conversation data for commit
 */
export interface ConversationForImport {
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    messages: Array<{
        id: string;
        role: "system" | "user" | "assistant" | "tool";
        content: string;
        createdAt: string | null;
        model: string | null;
    }>;
    model: string | null;
    isArchived: boolean;
    messageCount: number;
}

export interface ImportParseResponse {
    success: true;
    importId: string;
    /** Preview data for UI display */
    conversations: ConversationPreview[];
    /** Full data for commit step */
    fullConversations: ConversationForImport[];
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
 * POST /api/import/anthropic
 * Upload and parse a Claude export ZIP file
 */
export async function POST(request: NextRequest): Promise<Response> {
    const user = await currentUser();

    if (!user?.primaryEmailAddress?.emailAddress) {
        return unauthorizedResponse();
    }

    const userEmail = user.primaryEmailAddress.emailAddress;
    const requestLogger = logger.child({ userEmail, route: "import/anthropic" });

    try {
        // Get form data with file
        const formData = await request.formData();
        const file = formData.get("file");

        if (!file || !(file instanceof File)) {
            return validationErrorResponse(
                { file: "No file provided" },
                "Please select a Claude export ZIP file to upload."
            );
        }

        // Validate file type
        if (!file.name.endsWith(".zip")) {
            return validationErrorResponse(
                { file: "Invalid file type" },
                "Please upload a ZIP file. Claude exports are downloaded as .zip files."
            );
        }

        // Validate file size
        if (file.size > MAX_FILE_SIZE) {
            return validationErrorResponse(
                { file: "File too large" },
                `File size exceeds the 500MB limit. Your file is ${Math.round(file.size / 1024 / 1024)}MB.`
            );
        }

        requestLogger.info(
            { fileName: file.name, fileSize: file.size },
            "Parsing Claude export"
        );

        // Parse the ZIP file
        const arrayBuffer = await file.arrayBuffer();
        const result = await parseExportZip(arrayBuffer);

        // Allow partial success - only fail if NO conversations parsed successfully
        if (result.conversations.length === 0) {
            const errorMessage =
                result.errors.length > 0
                    ? result.errors[0]
                    : "No conversations found in the export. Please ensure you uploaded a valid Claude data export.";

            return validationErrorResponse(
                { conversations: "empty", parseErrors: result.errors },
                errorMessage
            );
        }

        // Partial failures are logged but don't block the import
        if (result.errors.length > 0) {
            requestLogger.warn(
                {
                    successCount: result.conversations.length,
                    failureCount: result.errors.length,
                    errors: result.errors,
                },
                "Partial import success - some conversations failed to parse"
            );
        }

        // Generate import ID for tracking
        const importId = `import_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

        requestLogger.info(
            {
                importId,
                conversationCount: result.conversations.length,
                messageCount: result.totalMessageCount,
            },
            "Claude export parsed successfully"
        );

        const response: ImportParseResponse = {
            success: true,
            importId,
            // Preview data for UI
            conversations: result.conversations.map((conv: ParsedConversation) => ({
                id: conv.id,
                title: conv.title,
                createdAt: conv.createdAt.toISOString(),
                messageCount: conv.messageCount,
                model: conv.model,
                isArchived: conv.isArchived,
            })),
            // Full data for commit step
            fullConversations: result.conversations.map((conv: ParsedConversation) => ({
                id: conv.id,
                title: conv.title,
                createdAt: conv.createdAt.toISOString(),
                updatedAt: conv.updatedAt.toISOString(),
                messages: conv.messages.map((msg) => ({
                    id: msg.id,
                    role: msg.role,
                    content: msg.content,
                    createdAt: msg.createdAt?.toISOString() ?? null,
                    model: msg.model,
                })),
                model: conv.model,
                isArchived: conv.isArchived,
                messageCount: conv.messageCount,
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
        requestLogger.error({ error }, "Import request failed");

        Sentry.captureException(error, {
            tags: { component: "import", platform: "anthropic" },
            extra: { userEmail },
        });

        return serverErrorResponse(error, {
            userEmail,
            route: "import/anthropic",
        });
    }
}
