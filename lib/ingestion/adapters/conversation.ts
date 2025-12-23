/**
 * Conversation adapter - extracts knowledge from chat messages
 * Primary ingestion source, triggered by follow-up engine
 */

import type { IngestionAdapter } from "./base";
import type { RawContent, IngestableItem } from "../types";
import { logger } from "@/lib/logger";

export class ConversationAdapter implements IngestionAdapter {
    readonly serviceId = "conversation";

    /**
     * Conversations are processed in real-time via follow-up engine
     * This method is not used for conversations
     */
    async fetchNewContent(_userEmail: string, _since?: Date): Promise<RawContent[]> {
        logger.warn("fetchNewContent called on ConversationAdapter - not supported");
        return [];
    }

    /**
     * Transform chat messages into raw content for ingestion
     * This is called by the follow-up engine with conversation context
     */
    async transformContent(raw: RawContent): Promise<IngestableItem[]> {
        // The transformation happens in the main evaluation step
        // This adapter just passes through the content
        // The actual extraction is done by the evaluate() function
        return [];
    }

    async getLastSyncTime(_userEmail: string): Promise<Date | null> {
        // Not applicable for conversations
        return null;
    }

    async updateSyncTime(_userEmail: string, _time: Date): Promise<void> {
        // Not applicable for conversations
    }

    /**
     * Create raw content from conversation messages
     * This is what the follow-up engine will call
     */
    static createRawContent(
        userMessages: string[],
        assistantMessages: string[],
        conversationId: string
    ): RawContent {
        // Combine user and assistant messages into conversation format
        const messages = [];
        for (
            let i = 0;
            i < Math.max(userMessages.length, assistantMessages.length);
            i++
        ) {
            if (i < userMessages.length) {
                messages.push(`User: ${userMessages[i]}`);
            }
            if (i < assistantMessages.length) {
                messages.push(`Assistant: ${assistantMessages[i]}`);
            }
        }

        return {
            content: messages.join("\n\n"),
            sourceType: "conversation",
            sourceId: conversationId,
            timestamp: new Date(),
            metadata: {
                messageCount: userMessages.length + assistantMessages.length,
            },
        };
    }
}
