/**
 * Discovery System Prompt
 *
 * Provides the system prompt layer that instructs Carmenta on handling
 * discovery mode - gathering profile information, introducing features,
 * and surfacing new capabilities conversationally.
 */

import type { DiscoveryItem } from "@/lib/discovery/config";

/**
 * Build the discovery prompt layer for Carmenta
 *
 * This layer is inserted into the system messages when the user has
 * pending discovery items. It instructs Carmenta on what to gather
 * and how to handle the conversation.
 */
export function buildDiscoveryPrompt(pendingItems: DiscoveryItem[]): string {
    if (pendingItems.length === 0) {
        return "";
    }

    const currentItem = pendingItems[0];
    const hasMoreItems = pendingItems.length > 1;
    const hasRequiredItems = pendingItems.some((item) => item.required);

    // Build the items description
    const itemsDescription = pendingItems
        .map((item, idx) => {
            const required = item.required ? " (required)" : " (optional)";
            return `${idx + 1}. ${item.name}${required}: ${item.prompt}`;
        })
        .join("\n");

    return `
## Discovery Mode

We are getting to know this person. There are things we need to learn from them or share with them.

### Pending Items
${itemsDescription}

### Current Focus
Start with: "${currentItem.name}"
Prompt: ${currentItem.prompt}

### Conversation Approach
- Weave the current item naturally into conversation
- Extract information from their responses without interrogating
- When you learn something relevant, use the updateDiscovery tool to save it
- Move through items at a natural pace - don't rush, but keep momentum

### Tools Available
- \`updateDiscovery\`: Save extracted information for a discovery item
- \`skipDiscovery\`: Mark an optional item as skipped (user explicitly wants to skip)
- \`completeDiscovery\`: Mark an item complete when you have what you need

### Handling Their Requests
${
    hasRequiredItems
        ? `Required items are pending. If they ask about something else:
- Acknowledge their request warmly
- Offer to help after: "Great question! Let me make a note of that. First though—${currentItem.prompt.toLowerCase()}"
- Stay flexible—if they really need something, help briefly and return`
        : `Only optional items are pending. Feel free to help with their requests and return to discovery naturally when appropriate.`
}

### Completing Items
- For conversation items: Call completeDiscovery when you have meaningful information
- For theme selection: The theme picker UI will handle completion
- For service connections: The OAuth flow will handle completion
${hasMoreItems ? "\nAfter completing an item, the next item will surface naturally in the next interaction." : "\nThis is the last pending item. Once complete, normal mode resumes."}
`.trim();
}

/**
 * Build a simpler discovery context for cases where we just need
 * to indicate discovery mode without full prompt details
 */
export function buildDiscoveryContext(pendingItems: DiscoveryItem[]): {
    isDiscoveryMode: boolean;
    hasRequiredItems: boolean;
    currentItem: DiscoveryItem | null;
    itemCount: number;
} {
    return {
        isDiscoveryMode: pendingItems.length > 0,
        hasRequiredItems: pendingItems.some((item) => item.required),
        currentItem: pendingItems[0] ?? null,
        itemCount: pendingItems.length,
    };
}
