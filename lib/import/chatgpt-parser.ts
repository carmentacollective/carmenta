/**
 * ChatGPT Export Parser
 *
 * Parses the conversations.json file from ChatGPT data exports.
 * The export format uses a complex nested structure with parent-child
 * message relationships for conversation branching.
 */

import JSZip from "jszip";
import { logger } from "@/lib/logger";

// ChatGPT export types based on actual export format

// All content types found in ChatGPT exports
type ChatGPTContentType =
    | "text"
    | "code"
    | "execution_output"
    | "multimodal_text"
    | "thoughts" // Extended thinking/reasoning
    | "reasoning_recap" // Summary of reasoning
    | "user_editable_context" // Memory/Custom Instructions
    | "tether_browsing_display" // Web browsing results
    | "tether_quote" // Quotes from web pages
    | "system_error";

interface ThoughtChunk {
    summary: string;
    content: string;
    chunks: string[];
    finished: boolean;
}

interface ChatGPTMessage {
    id: string;
    author: {
        role: "system" | "user" | "assistant" | "tool";
        name?: string;
        metadata?: Record<string, unknown>;
    };
    create_time: number | null;
    update_time: number | null;
    content: {
        content_type: ChatGPTContentType;
        parts?: (string | { type: string; [key: string]: unknown })[];
        text?: string;
        // Extended thinking content
        thoughts?: ThoughtChunk[];
        // User Memory/Custom Instructions
        user_profile?: string;
        user_instructions?: string;
    };
    status: string;
    end_turn: boolean | null;
    weight: number;
    metadata: {
        model_slug?: string;
        finish_details?: { type: string };
        is_visually_hidden_from_conversation?: boolean;
        [key: string]: unknown;
    };
    recipient: string;
}

interface ChatGPTNode {
    id: string;
    parent: string | null;
    children: string[];
    message: ChatGPTMessage | null;
}

interface ChatGPTConversation {
    id: string;
    title: string;
    create_time: number;
    update_time: number;
    mapping: Record<string, ChatGPTNode>;
    current_node: string;
    conversation_template_id: string | null;
    gizmo_id: string | null;
    is_archived: boolean;
    safe_urls: string[];
    moderation_results: unknown[];
    plugin_ids: string[] | null;
}

interface ChatGPTExportFile {
    conversations?: ChatGPTConversation[];
}

// Parsed output types

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
 * User's ChatGPT Memory and Custom Instructions
 * Extracted from user_editable_context messages in conversations
 */
export interface UserSettings {
    /** User's "About me" text from Memory */
    userProfile: string | null;
    /** User's "Custom Instructions" for how ChatGPT should respond */
    userInstructions: string | null;
}

export interface ParseResult {
    conversations: ParsedConversation[];
    dateRange: {
        earliest: Date;
        latest: Date;
    };
    totalMessageCount: number;
    errors: string[];
    /** User's Memory/Custom Instructions (personality data) */
    userSettings: UserSettings | null;
}

export interface ImportValidationResult {
    valid: boolean;
    error?: string;
    conversationCount?: number;
    dateRange?: { earliest: Date; latest: Date };
}

/**
 * Extract text content from a ChatGPT message based on content_type
 */
function extractMessageContent(content: ChatGPTMessage["content"]): string {
    const contentType = content.content_type;

    // Handle thoughts (extended thinking)
    if (contentType === "thoughts" && content.thoughts) {
        return content.thoughts
            .map((t) => `**${t.summary}**\n${t.content}`)
            .join("\n\n");
    }

    // Handle execution output (code interpreter results)
    if (contentType === "execution_output" && content.text) {
        return `\`\`\`output\n${content.text}\n\`\`\``;
    }

    // Handle user_editable_context (Memory/Custom Instructions)
    // We skip this content type in messages but extract it separately
    if (contentType === "user_editable_context") {
        return ""; // Handled separately as metadata
    }

    // Handle text content
    if (content.text) {
        return content.text;
    }

    // Handle parts array (text, code, multimodal, etc.)
    if (content.parts) {
        return content.parts
            .map((part) => {
                if (typeof part === "string") {
                    return part;
                }
                // Handle multimodal content (images, code blocks, etc.)
                if (part.type === "image_asset_pointer") {
                    return "[Image]";
                }
                if (part.type === "code") {
                    return `\`\`\`\n${part.text || ""}\n\`\`\``;
                }
                return "";
            })
            .filter(Boolean)
            .join("\n");
    }

    return "";
}

/**
 * Walk the message tree from current_node back to root to get the conversation flow.
 * ChatGPT stores messages in a tree structure where users can edit prompts
 * or regenerate responses, creating branches. We walk backward from current_node
 * to reconstruct the active conversation path.
 */
function walkMessageTree(
    mapping: Record<string, ChatGPTNode>,
    currentNodeId: string
): ParsedMessage[] {
    const messages: ParsedMessage[] = [];
    const visited = new Set<string>();

    // Build path from current node back to root by walking parent chain
    const path: string[] = [];
    let currentId: string | null = currentNodeId;

    while (currentId && !visited.has(currentId)) {
        visited.add(currentId);
        path.unshift(currentId);
        const nodeForParent: ChatGPTNode | undefined = mapping[currentId];
        currentId = nodeForParent?.parent ?? null;
    }

    // Walk the path and extract messages
    for (const nodeId of path) {
        const node = mapping[nodeId];
        if (!node?.message) continue;

        const msg = node.message;

        // Skip hidden messages and empty content
        if (msg.metadata?.is_visually_hidden_from_conversation) continue;

        const content = extractMessageContent(msg.content);
        if (!content.trim()) continue;

        messages.push({
            id: msg.id,
            role: msg.author.role,
            content,
            createdAt: msg.create_time ? new Date(msg.create_time * 1000) : null,
            model: msg.metadata?.model_slug || null,
            authorName: msg.author.name,
        });
    }

    return messages;
}

/**
 * Safely convert a Unix timestamp to a Date, with validation.
 * Returns null for invalid timestamps.
 */
function safeTimestampToDate(timestamp: unknown): Date | null {
    if (typeof timestamp !== "number" || !isFinite(timestamp) || timestamp <= 0) {
        return null;
    }
    // Reasonable bounds: 2015 to 2035
    const minTimestamp = 1420070400; // 2015-01-01
    const maxTimestamp = 2051222400; // 2035-01-01
    if (timestamp < minTimestamp || timestamp > maxTimestamp) {
        return null;
    }
    return new Date(timestamp * 1000);
}

interface ParseConversationError {
    error: string;
    conversationId: string;
}

/**
 * Parse a single conversation from the export.
 * Returns ParsedConversation on success, error info object on failure, or null for empty conversations.
 */
function parseConversation(
    conv: ChatGPTConversation
): ParsedConversation | ParseConversationError | null {
    try {
        // Validate required fields
        if (!conv.mapping || typeof conv.mapping !== "object") {
            logger.warn({ conversationId: conv.id }, "Missing or invalid mapping");
            return null;
        }
        if (!conv.current_node || !conv.mapping[conv.current_node]) {
            logger.warn({ conversationId: conv.id }, "Missing or invalid current_node");
            return null;
        }

        const messages = walkMessageTree(conv.mapping, conv.current_node);

        // Skip conversations with no meaningful messages
        if (messages.length === 0) {
            return null;
        }

        // Find the model used (from assistant messages)
        const assistantMessages = messages.filter((m) => m.role === "assistant");
        const model =
            assistantMessages.find((m) => m.model)?.model ||
            (assistantMessages.length > 0 ? "unknown" : null);

        // Validate timestamps with fallbacks
        const createdAt = safeTimestampToDate(conv.create_time) ?? new Date();
        const updatedAt = safeTimestampToDate(conv.update_time) ?? createdAt;

        return {
            id: conv.id,
            title: conv.title || "Untitled",
            createdAt,
            updatedAt,
            messages,
            model,
            isArchived: conv.is_archived,
            customGptId: conv.gizmo_id,
            messageCount: messages.length,
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        logger.warn(
            { error, conversationId: conv?.id ?? "unknown" },
            "Failed to parse conversation"
        );
        // Return error info instead of null so caller can track failures
        return { error: errorMessage, conversationId: conv?.id ?? "unknown" };
    }
}

/**
 * Extract user settings (Memory/Custom Instructions) from conversations
 * These are stored in user_editable_context messages
 */
function extractUserSettings(
    rawConversations: ChatGPTConversation[]
): UserSettings | null {
    for (const conv of rawConversations) {
        if (!conv.mapping) continue;

        for (const node of Object.values(conv.mapping)) {
            const msg = node.message;
            if (!msg) continue;

            if (msg.content?.content_type === "user_editable_context") {
                const userProfile = msg.content.user_profile || null;
                const userInstructions = msg.content.user_instructions || null;

                if (userProfile || userInstructions) {
                    return { userProfile, userInstructions };
                }
            }
        }
    }

    return null;
}

/**
 * Detect if JSON looks like an Anthropic/Claude export instead of OpenAI
 * Anthropic exports have: chat_messages array, uuid, created_at (ISO timestamp)
 * OpenAI exports have: mapping object, current_node, create_time (Unix timestamp)
 */
function looksLikeAnthropicFormat(data: unknown[]): boolean {
    if (!data || data.length === 0) return false;
    const first = data[0] as Record<string, unknown>;
    // Anthropic format has chat_messages array and uuid
    return (
        Array.isArray(first?.chat_messages) &&
        typeof first?.uuid === "string" &&
        typeof first?.created_at === "string"
    );
}

/**
 * Parse the conversations.json content from a ChatGPT export
 */
export function parseConversationsJson(jsonContent: string): ParseResult {
    const errors: string[] = [];
    let data: ChatGPTExportFile;

    try {
        data = JSON.parse(jsonContent);
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

    // Handle both array format and object format
    const rawConversations = Array.isArray(data) ? data : (data.conversations ?? []);

    if (!Array.isArray(rawConversations)) {
        return {
            conversations: [],
            dateRange: { earliest: new Date(), latest: new Date() },
            totalMessageCount: 0,
            errors: ["Expected conversations array in export"],
            userSettings: null,
        };
    }

    // Detect wrong format - user uploaded Anthropic export to OpenAI tab
    if (looksLikeAnthropicFormat(rawConversations)) {
        return {
            conversations: [],
            dateRange: { earliest: new Date(), latest: new Date() },
            totalMessageCount: 0,
            errors: [
                "This looks like a Claude/Anthropic export. Switch to the Claude tab to import it.",
            ],
            userSettings: null,
        };
    }

    // Extract user settings (Memory/Custom Instructions) from any conversation
    const userSettings = extractUserSettings(rawConversations);

    const conversations: ParsedConversation[] = [];
    let totalMessageCount = 0;
    let earliest: Date | null = null;
    let latest: Date | null = null;
    let parseFailures = 0;

    for (const rawConv of rawConversations) {
        const result = parseConversation(rawConv);

        // Handle parse errors
        if (result && "error" in result) {
            parseFailures++;
            // Only add to errors array if we have significant failures
            if (parseFailures <= 5) {
                errors.push(
                    `Failed to parse "${rawConv.title || rawConv.id}": ${result.error}`
                );
            }
            continue;
        }

        // Handle successful parse
        if (result) {
            conversations.push(result);
            totalMessageCount += result.messageCount;

            if (!earliest || result.createdAt < earliest) earliest = result.createdAt;
            if (!latest || result.updatedAt > latest) latest = result.updatedAt;
        }
    }

    // Add summary error if many failures occurred
    if (parseFailures > 5) {
        errors.push(`...and ${parseFailures - 5} more conversations failed to parse`);
    }

    // Sort by created date, newest first
    conversations.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // Default to current date if no valid conversations found
    const now = new Date();
    return {
        conversations,
        dateRange: {
            earliest: earliest ?? now,
            latest: latest ?? now,
        },
        totalMessageCount,
        errors,
        userSettings,
    };
}

/**
 * Extract and parse conversations.json from a ChatGPT export ZIP file
 */
export async function parseExportZip(zipBuffer: ArrayBuffer): Promise<ParseResult> {
    try {
        const zip = await JSZip.loadAsync(zipBuffer);

        // Find conversations.json (could be at root or in a subdirectory)
        let conversationsFile: JSZip.JSZipObject | null = null;

        for (const [path, file] of Object.entries(zip.files)) {
            if (path.endsWith("conversations.json") && !file.dir) {
                conversationsFile = file;
                break;
            }
        }

        if (!conversationsFile) {
            return {
                conversations: [],
                dateRange: { earliest: new Date(), latest: new Date() },
                totalMessageCount: 0,
                errors: [
                    "No conversations.json found in ZIP. Please ensure you uploaded a ChatGPT data export.",
                ],
                userSettings: null,
            };
        }

        const jsonContent = await conversationsFile.async("string");
        return parseConversationsJson(jsonContent);
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
 * Validate a ZIP file contains a valid ChatGPT export without fully parsing it
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
                error: "No conversations.json found. Please upload a ChatGPT data export ZIP.",
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
            error: "Invalid ZIP file. Please ensure you uploaded a valid ChatGPT export.",
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
        const roleLabel =
            msg.role === "user"
                ? "User"
                : msg.role === "assistant"
                  ? "Assistant"
                  : msg.role;
        lines.push(`## ${roleLabel}`);
        lines.push(msg.content);
        lines.push("");
    }

    return lines.join("\n");
}

/**
 * Generate a unique hash for deduplication
 */
export function hashConversation(conv: ParsedConversation): string {
    // Simple hash based on conversation ID and content
    const content = conv.messages.map((m) => `${m.role}:${m.content}`).join("|");
    const str = `${conv.id}|${conv.title}|${content}`;

    // Basic hash function
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
}
