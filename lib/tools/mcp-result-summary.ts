/**
 * MCP Result Summary Extraction
 *
 * Extracts human-readable summaries from MCP tool outputs.
 * Shows counts, previews, or status indicators in collapsed view.
 */

export interface ResultSummary {
    /** Short summary for collapsed view (e.g., "12 results", "3 files", "Success") */
    text: string;
    /** Count if applicable (for rendering badges) */
    count?: number;
    /** Preview text if available */
    preview?: string;
}

/**
 * Extract a summary from MCP tool output.
 *
 * @param output - Raw output from MCP tool
 * @param action - The action that was performed (e.g., "search_code", "list_issues")
 * @returns Summary object with text and optional count
 */
export function getResultSummary(
    output: unknown,
    action?: string
): ResultSummary | undefined {
    if (output === undefined || output === null) {
        return undefined;
    }

    // Handle arrays - most common case for list/search operations
    if (Array.isArray(output)) {
        const count = output.length;
        const noun = inferNoun(action, count);
        return {
            text: `${count} ${noun}`,
            count,
            preview: getArrayPreview(output),
        };
    }

    // Handle objects with common response shapes
    if (typeof output === "object") {
        const obj = output as Record<string, unknown>;

        // Check for nested arrays (e.g., { results: [...], items: [...] })
        // Must match extractArray() key list in mcp-tool-result.tsx
        for (const key of [
            "results",
            "items",
            "data",
            "files",
            "issues",
            "messages",
            "events",
            "channels",
            "contacts",
        ]) {
            if (Array.isArray(obj[key])) {
                const arr = obj[key] as unknown[];
                const count = arr.length;
                const noun =
                    key === "results"
                        ? inferNoun(action, count)
                        : pluralize(key, count);
                return {
                    text: `${count} ${noun}`,
                    count,
                    preview: getArrayPreview(arr),
                };
            }
        }

        // Check for count properties
        for (const key of ["total", "count", "totalCount", "length"]) {
            if (typeof obj[key] === "number") {
                const count = obj[key] as number;
                const noun = inferNoun(action, count);
                return {
                    text: `${count} ${noun}`,
                    count,
                };
            }
        }

        // Check for success/status indicators
        if (obj.success === true || obj.status === "success" || obj.ok === true) {
            return { text: "Success" };
        }

        // Check for common single-item responses
        if (obj.id || obj.name || obj.title) {
            const identifier = (obj.title || obj.name || obj.id) as string;
            return {
                text: truncate(String(identifier), 30),
                preview: String(identifier),
            };
        }

        // For objects without clear structure, show key count
        const keys = Object.keys(obj);
        if (keys.length > 0 && keys.length <= 10) {
            return { text: `${keys.length} field${keys.length === 1 ? "" : "s"}` };
        }
    }

    // Handle strings
    if (typeof output === "string") {
        if (output.length > 0) {
            return {
                text: truncate(output, 40),
                preview: output,
            };
        }
        return { text: "Empty response" };
    }

    // Handle booleans
    if (typeof output === "boolean") {
        return { text: output ? "Success" : "Failed" };
    }

    // Handle numbers
    if (typeof output === "number") {
        return { text: String(output) };
    }

    return undefined;
}

/**
 * Infer the noun to use based on action name.
 */
function inferNoun(action: string | undefined, count: number): string {
    if (!action) return count === 1 ? "result" : "results";

    const actionLower = action.toLowerCase();

    // Search operations
    if (actionLower.includes("search") || actionLower.includes("find")) {
        return count === 1 ? "result" : "results";
    }

    // File operations
    if (actionLower.includes("file")) {
        return count === 1 ? "file" : "files";
    }

    // Issue/PR operations
    if (actionLower.includes("issue")) {
        return count === 1 ? "issue" : "issues";
    }
    if (actionLower.includes("pull") || actionLower.includes("pr")) {
        return count === 1 ? "PR" : "PRs";
    }

    // Message operations
    if (actionLower.includes("message")) {
        return count === 1 ? "message" : "messages";
    }

    // Event operations
    if (actionLower.includes("event") || actionLower.includes("calendar")) {
        return count === 1 ? "event" : "events";
    }

    // Channel operations
    if (actionLower.includes("channel")) {
        return count === 1 ? "channel" : "channels";
    }

    // Contact operations
    if (actionLower.includes("contact")) {
        return count === 1 ? "contact" : "contacts";
    }

    // List operations
    if (actionLower.startsWith("list_") || actionLower.startsWith("get_")) {
        const resource = actionLower.replace(/^(list_|get_)/, "");
        return pluralize(resource, count);
    }

    return count === 1 ? "item" : "items";
}

/**
 * Simple pluralization - handles common cases.
 */
function pluralize(word: string, count: number): string {
    if (count === 1) {
        // Return singular
        if (word.endsWith("ies")) return word.slice(0, -3) + "y";
        // Only strip "es" for words ending in consonant + "es" (boxes→box)
        // NOT for words naturally ending in "e" + "s" (files→file, issues→issue)
        if (word.endsWith("es") && !word.endsWith("ies")) {
            const withoutEs = word.slice(0, -2);
            // If word ends in "e" before the "s", just remove "s" (files→file)
            if (withoutEs.endsWith("e")) {
                return word.slice(0, -1);
            }
            // Otherwise remove "es" (boxes→box)
            return withoutEs;
        }
        if (word.endsWith("s")) return word.slice(0, -1);
        return word;
    }
    // Return as-is if already plural, or add 's'
    if (word.endsWith("s")) return word;
    if (word.endsWith("y")) return word.slice(0, -1) + "ies";
    return word + "s";
}

/**
 * Get a preview from an array of items.
 */
function getArrayPreview(arr: unknown[]): string | undefined {
    if (arr.length === 0) return undefined;

    const first = arr[0];
    if (typeof first === "string") {
        return truncate(first, 50);
    }
    if (typeof first === "object" && first !== null) {
        const obj = first as Record<string, unknown>;
        // Try common identifier fields
        for (const key of ["title", "name", "path", "filename", "message", "text"]) {
            if (typeof obj[key] === "string") {
                return truncate(obj[key] as string, 50);
            }
        }
    }
    return undefined;
}

function truncate(str: string, maxLength: number): string {
    if (str.length <= maxLength) return str;
    return str.slice(0, maxLength - 1) + "…";
}

/**
 * Format action name for display.
 * Converts snake_case to readable form.
 *
 * @param action - Raw action name (e.g., "search_code", "list_issues")
 * @returns Formatted action (e.g., "search code", "list issues")
 */
export function formatActionName(action: string): string {
    return action.replace(/_/g, " ").toLowerCase();
}
