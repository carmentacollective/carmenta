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
        content_type: "text" | "code" | "execution_output" | "multimodal_text";
        parts?: (string | { type: string; [key: string]: unknown })[];
        text?: string;
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

export interface ParseResult {
    conversations: ParsedConversation[];
    dateRange: {
        earliest: Date;
        latest: Date;
    };
    totalMessageCount: number;
    errors: string[];
}

export interface ImportValidationResult {
    valid: boolean;
    error?: string;
    conversationCount?: number;
    dateRange?: { earliest: Date; latest: Date };
}

/**
 * Extract text content from a ChatGPT message
 */
function extractMessageContent(content: ChatGPTMessage["content"]): string {
    if (content.text) {
        return content.text;
    }

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
 * Walk the message tree from root to current_node to get the conversation flow.
 * ChatGPT stores messages in a tree structure where users can edit prompts
 * or regenerate responses, creating branches.
 */
function walkMessageTree(
    mapping: Record<string, ChatGPTNode>,
    currentNodeId: string
): ParsedMessage[] {
    const messages: ParsedMessage[] = [];
    const visited = new Set<string>();

    // Find root node (parent is null)
    let rootId: string | null = null;
    for (const [nodeId, node] of Object.entries(mapping)) {
        if (node.parent === null) {
            rootId = nodeId;
            break;
        }
    }

    if (!rootId) {
        return messages;
    }

    // Build path from root to current node
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
 * Parse a single conversation from the export
 */
function parseConversation(conv: ChatGPTConversation): ParsedConversation | null {
    try {
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

        return {
            id: conv.id,
            title: conv.title || "Untitled",
            createdAt: new Date(conv.create_time * 1000),
            updatedAt: new Date(conv.update_time * 1000),
            messages,
            model,
            isArchived: conv.is_archived,
            customGptId: conv.gizmo_id,
            messageCount: messages.length,
        };
    } catch (error) {
        logger.warn({ error, conversationId: conv.id }, "Failed to parse conversation");
        return null;
    }
}

/**
 * Parse the conversations.json content from a ChatGPT export
 */
export function parseConversationsJson(jsonContent: string): ParseResult {
    const errors: string[] = [];
    let data: ChatGPTExportFile;

    try {
        data = JSON.parse(jsonContent);
    } catch {
        return {
            conversations: [],
            dateRange: { earliest: new Date(), latest: new Date() },
            totalMessageCount: 0,
            errors: ["Invalid JSON format in conversations.json"],
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
        };
    }

    const conversations: ParsedConversation[] = [];
    let totalMessageCount = 0;
    let earliest = new Date();
    let latest = new Date(0);

    for (const rawConv of rawConversations) {
        const parsed = parseConversation(rawConv);
        if (parsed) {
            conversations.push(parsed);
            totalMessageCount += parsed.messageCount;

            if (parsed.createdAt < earliest) earliest = parsed.createdAt;
            if (parsed.updatedAt > latest) latest = parsed.updatedAt;
        }
    }

    // Sort by created date, newest first
    conversations.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return {
        conversations,
        dateRange: { earliest, latest },
        totalMessageCount,
        errors,
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
            };
        }

        const jsonContent = await conversationsFile.async("string");
        return parseConversationsJson(jsonContent);
    } catch (error) {
        logger.error({ error }, "Failed to parse export ZIP");
        return {
            conversations: [],
            dateRange: { earliest: new Date(), latest: new Date() },
            totalMessageCount: 0,
            errors: [
                "Failed to read ZIP file. Please ensure it's a valid ChatGPT export.",
            ],
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

        if (result.errors.length > 0) {
            return {
                valid: false,
                error: result.errors[0],
            };
        }

        if (result.conversations.length === 0) {
            return {
                valid: false,
                error: "No conversations found in export.",
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
