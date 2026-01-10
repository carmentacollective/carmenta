/**
 * Anthropic/Claude Export Parser
 *
 * Parses data exports from Claude (claude.ai).
 * The export format provides a ZIP containing:
 * - conversations.json: Linear message structure (no branching)
 * - memories.json: General conversation memory + project-specific memories
 * - users.json: User profile information
 */

import JSZip from "jszip";
import { logger } from "@/lib/logger";

// Types for Anthropic/Claude export format

interface AnthropicMessage {
    uuid: string;
    text: string;
    sender: "human" | "assistant";
    created_at: string;
    updated_at: string;
    content: Array<{
        type: "text";
        text: string;
        start_timestamp: string;
        stop_timestamp: string;
        citations: unknown[];
        flags: unknown;
    }>;
    attachments: unknown[];
    files: unknown[];
}

interface AnthropicConversation {
    uuid: string;
    name: string;
    summary?: string;
    created_at: string;
    updated_at: string;
    account: string;
    chat_messages: AnthropicMessage[];
}

interface AnthropicMemory {
    conversations_memory: string | null;
    project_memories: Record<string, string>;
    account_uuid: string;
}

// Parsed output types (matching ChatGPT parser interface)

export interface ParsedMessage {
    id: string;
    role: "system" | "user" | "assistant" | "tool";
    content: string;
    createdAt: Date | null;
    model: string | null;
    authorName?: string;
}

export interface ParsedConversation {
    id: string;
    title: string;
    createdAt: Date;
    updatedAt: Date;
    messages: ParsedMessage[];
    model: string | null;
    isArchived: boolean;
    customGptId: string | null;
    messageCount: number;
}

/**
 * User's Anthropic Memory (conversation context)
 * This comes from memories.json in the export
 */
export interface UserSettings {
    /** General conversation memory (what Claude knows about you) */
    conversationsMemory: string | null;
    /** Project-specific memory contexts */
    projectMemories: Record<string, string>;
}

export interface ParseResult {
    conversations: ParsedConversation[];
    dateRange: {
        earliest: Date;
        latest: Date;
    };
    totalMessageCount: number;
    errors: string[];
    /** User's Memory data from memories.json */
    userSettings: UserSettings | null;
}

export interface ImportValidationResult {
    valid: boolean;
    error?: string;
    conversationCount?: number;
    dateRange?: { earliest: Date; latest: Date };
}

/**
 * Extract text content from an Anthropic message
 */
function extractMessageContent(message: AnthropicMessage): string {
    // Anthropic stores text in the text field
    // content array has same info but we use text field
    return message.text || "";
}

/**
 * Parse an ISO timestamp to Date
 */
function parseISOTimestamp(timestamp: string): Date | null {
    try {
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) return null;
        return date;
    } catch {
        return null;
    }
}

/**
 * Extract user Memory from Anthropic memories.json
 */
function extractUserSettings(
    rawMemories: AnthropicMemory[] | null
): UserSettings | null {
    if (!rawMemories || rawMemories.length === 0) {
        return null;
    }

    // Use first memory entry (should only be one)
    const memory = rawMemories[0];
    if (
        !memory.conversations_memory &&
        Object.keys(memory.project_memories || {}).length === 0
    ) {
        return null;
    }

    return {
        conversationsMemory: memory.conversations_memory || null,
        projectMemories: memory.project_memories || {},
    };
}

/**
 * Parse a single conversation from Anthropic export
 */
function parseConversation(conv: AnthropicConversation): ParsedConversation | null {
    try {
        // Validate required fields
        if (!conv.chat_messages || !Array.isArray(conv.chat_messages)) {
            logger.warn(
                { conversationId: conv.uuid },
                "Missing or invalid chat_messages"
            );
            return null;
        }

        // Convert messages
        const messages: ParsedMessage[] = conv.chat_messages
            .map((msg): ParsedMessage | null => {
                const content = extractMessageContent(msg);
                if (!content.trim()) return null;

                return {
                    id: msg.uuid,
                    role: msg.sender === "human" ? "user" : "assistant",
                    content,
                    createdAt: parseISOTimestamp(msg.created_at),
                    model: null, // Anthropic export doesn't specify model per message
                };
            })
            .filter((msg): msg is ParsedMessage => msg !== null);

        // Skip conversations with no messages
        if (messages.length === 0) {
            return null;
        }

        // Parse timestamps
        const createdAt = parseISOTimestamp(conv.created_at) ?? new Date();
        const updatedAt = parseISOTimestamp(conv.updated_at) ?? createdAt;

        return {
            id: conv.uuid,
            title: conv.name || "Untitled",
            createdAt,
            updatedAt,
            messages,
            model: null, // Not specified in Anthropic export
            isArchived: false, // Not in export
            customGptId: null, // Anthropic-specific, not applicable
            messageCount: messages.length,
        };
    } catch (error) {
        logger.warn(
            { error, conversationId: conv?.uuid ?? "unknown" },
            "Failed to parse conversation"
        );
        return null;
    }
}

/**
 * Detect if JSON looks like an OpenAI/ChatGPT export instead of Anthropic
 * ChatGPT exports have: mapping, current_node, create_time (Unix timestamp)
 * Anthropic exports have: chat_messages, uuid, created_at (ISO timestamp)
 */
function looksLikeOpenAIFormat(data: unknown[]): boolean {
    if (!data || data.length === 0) return false;
    const first = data[0] as Record<string, unknown>;
    // ChatGPT format has mapping object and current_node
    return (
        typeof first?.mapping === "object" && typeof first?.current_node === "string"
    );
}

/**
 * Parse the conversations JSON content from an Anthropic export
 */
export function parseConversationsJson(jsonContent: string): ParseResult {
    const errors: string[] = [];
    let data: AnthropicConversation[];

    try {
        const parsed = JSON.parse(jsonContent);
        // Handle both array format and object format like {conversations: [...]}
        if (Array.isArray(parsed)) {
            data = parsed;
        } else if (parsed && typeof parsed === "object") {
            if (Array.isArray(parsed.conversations)) {
                data = parsed.conversations;
            } else {
                // Object format but no conversations array - check for common mistakes
                const keys = Object.keys(parsed);
                return {
                    conversations: [],
                    dateRange: { earliest: new Date(), latest: new Date() },
                    totalMessageCount: 0,
                    errors: [
                        `Expected array or object with "conversations" key, got object with keys: ${keys.slice(0, 5).join(", ")}${keys.length > 5 ? "..." : ""}`,
                    ],
                    userSettings: null,
                };
            }
        } else {
            data = [];
        }
    } catch (error) {
        const detail = error instanceof SyntaxError ? `: ${error.message}` : "";
        return {
            conversations: [],
            dateRange: { earliest: new Date(), latest: new Date() },
            totalMessageCount: 0,
            errors: [`Invalid JSON format in conversations.json${detail}`],
            userSettings: null,
        };
    }

    if (!Array.isArray(data)) {
        return {
            conversations: [],
            dateRange: { earliest: new Date(), latest: new Date() },
            totalMessageCount: 0,
            errors: ["Expected conversations array in export"],
            userSettings: null,
        };
    }

    // Detect wrong format - user uploaded OpenAI export to Anthropic tab
    if (looksLikeOpenAIFormat(data)) {
        return {
            conversations: [],
            dateRange: { earliest: new Date(), latest: new Date() },
            totalMessageCount: 0,
            errors: [
                "This looks like an OpenAI/ChatGPT export. Switch to the ChatGPT tab to import it.",
            ],
            userSettings: null,
        };
    }

    const conversations: ParsedConversation[] = [];
    let totalMessageCount = 0;
    let earliest: Date | null = null;
    let latest: Date | null = null;
    let parseFailures = 0;
    let emptyConversations = 0;

    for (const rawConv of data) {
        // Guard against null entries in the array
        if (!rawConv) continue;

        const result = parseConversation(rawConv);

        if (result) {
            conversations.push(result);
            totalMessageCount += result.messageCount;

            if (!earliest || result.createdAt < earliest) earliest = result.createdAt;
            if (!latest || result.updatedAt > latest) latest = result.updatedAt;
        } else if (
            rawConv.chat_messages &&
            Array.isArray(rawConv.chat_messages) &&
            rawConv.chat_messages.length === 0
        ) {
            // Empty conversations are valid, just skip them silently
            emptyConversations++;
        } else {
            // Actual parse failures get logged
            parseFailures++;
            if (parseFailures <= 5) {
                errors.push(
                    `Failed to parse "${rawConv.name || rawConv.uuid || "unknown"}"`
                );
            }
        }
    }

    if (parseFailures > 5) {
        errors.push(`...and ${parseFailures - 5} more conversations failed to parse`);
    }

    if (emptyConversations > 0) {
        logger.debug({ emptyConversations }, "Skipped empty conversations");
    }

    // Sort by created date, newest first
    conversations.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const now = new Date();
    return {
        conversations,
        dateRange: {
            earliest: earliest ?? now,
            latest: latest ?? now,
        },
        totalMessageCount,
        errors,
        userSettings: null, // Will be populated separately from memories.json
    };
}

/**
 * Parse memories.json from Anthropic export
 */
export function parseMemoriesJson(jsonContent: string): UserSettings | null {
    try {
        const data = JSON.parse(jsonContent) as AnthropicMemory[];
        return extractUserSettings(data);
    } catch (error) {
        logger.warn({ error }, "Failed to parse memories.json");
        return null;
    }
}

/**
 * Extract and parse Anthropic export files from ZIP
 */
export async function parseExportZip(zipBuffer: ArrayBuffer): Promise<ParseResult> {
    try {
        const zip = await JSZip.loadAsync(zipBuffer);

        // Find conversations.json and memories.json
        let conversationsFile: JSZip.JSZipObject | null = null;
        let memoriesFile: JSZip.JSZipObject | null = null;

        for (const [path, file] of Object.entries(zip.files)) {
            if (path.endsWith("conversations.json") && !file.dir) {
                conversationsFile = file;
            }
            if (path.endsWith("memories.json") && !file.dir) {
                memoriesFile = file;
            }
        }

        if (!conversationsFile) {
            return {
                conversations: [],
                dateRange: { earliest: new Date(), latest: new Date() },
                totalMessageCount: 0,
                errors: [
                    "No conversations.json found in ZIP. Please ensure you uploaded an Anthropic data export.",
                ],
                userSettings: null,
            };
        }

        // Parse conversations
        const conversationsContent = await conversationsFile.async("string");
        const result = parseConversationsJson(conversationsContent);

        // Parse memories if available
        if (memoriesFile) {
            const memoriesContent = await memoriesFile.async("string");
            const userSettings = parseMemoriesJson(memoriesContent);
            result.userSettings = userSettings;
        }

        return result;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error({ error, errorMessage }, "Failed to parse export ZIP");
        return {
            conversations: [],
            dateRange: { earliest: new Date(), latest: new Date() },
            totalMessageCount: 0,
            errors: [`Failed to read ZIP file: ${errorMessage}`],
            userSettings: null,
        };
    }
}

/**
 * Validate a ZIP file contains a valid Anthropic export
 */
export async function validateExportZip(
    zipBuffer: ArrayBuffer
): Promise<ImportValidationResult> {
    try {
        const zip = await JSZip.loadAsync(zipBuffer);

        // Check for conversations.json
        let conversationsFile: JSZip.JSZipObject | null = null;
        for (const [path, file] of Object.entries(zip.files)) {
            if (path.endsWith("conversations.json") && !file.dir) {
                conversationsFile = file;
                break;
            }
        }

        if (!conversationsFile) {
            return {
                valid: false,
                error: "No conversations.json found. Please upload an Anthropic data export ZIP.",
            };
        }

        // Quick parse to get stats
        const jsonContent = await conversationsFile.async("string");
        const result = parseConversationsJson(jsonContent);

        // Allow partial success - errors don't invalidate the entire export
        // Only fail if we got zero conversations AND there were errors
        if (result.conversations.length === 0 && result.errors.length > 0) {
            return {
                valid: false,
                error: result.errors[0],
            };
        }

        // Empty exports (no conversations) are valid
        if (result.conversations.length === 0) {
            return {
                valid: true,
                conversationCount: 0,
                dateRange: result.dateRange,
            };
        }

        return {
            valid: true,
            conversationCount: result.conversations.length,
            dateRange: result.dateRange,
        };
    } catch {
        return {
            valid: false,
            error: "Invalid ZIP file. Please ensure you uploaded a valid Anthropic export.",
        };
    }
}

/**
 * Format a conversation as plain text for storage
 */
export function conversationToText(conv: ParsedConversation): string {
    const lines: string[] = [];

    lines.push(`# ${conv.title}`);
    lines.push(`Date: ${conv.createdAt.toISOString()}`);
    if (conv.model) {
        lines.push(`Model: ${conv.model}`);
    }
    lines.push("");

    for (const msg of conv.messages) {
        const roleLabel = msg.role === "user" ? "User" : "Assistant";
        lines.push(`## ${roleLabel}`);
        lines.push(msg.content);
        lines.push("");
    }

    return lines.join("\n");
}
