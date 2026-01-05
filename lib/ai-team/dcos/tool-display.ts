/**
 * Tool Display Names
 *
 * User-friendly display names for DCOS tools shown during execution.
 * Centralized to avoid duplication across modal and concierge components.
 */

/**
 * Get user-friendly display name for a tool invocation
 *
 * @param toolName - The tool ID (e.g., "librarian", "mcpConfig")
 * @param input - The tool input parameters, used to derive action-specific names
 * @returns A human-readable status message like "Searching knowledge..."
 */
export function getToolDisplayName(
    toolName: string,
    input?: Record<string, unknown>
): string {
    const action = input?.action as string | undefined;

    switch (toolName) {
        case "librarian":
            if (action === "search") return "Searching knowledge...";
            if (action === "extract") return "Analyzing conversation...";
            if (action === "retrieve") return "Retrieving document...";
            if (action === "describe") return "Learning operations...";
            return "Working with Librarian";

        case "searchKnowledge":
            return "Searching knowledge...";

        case "mcpConfig":
            if (action === "list") return "Listing integrations...";
            if (action === "test") return "Testing connection...";
            if (action === "guide") return "Getting setup guide...";
            if (action === "describe") return "Learning operations...";
            return "Configuring integrations...";

        case "researcher":
            return "Researching...";

        default:
            // Integration tools and other tools
            return `Using ${toolName}...`;
    }
}
