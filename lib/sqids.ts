/**
 * Sqids Utilities
 *
 * Sqids-based ID generation for URL-safe, SEO-friendly identifiers.
 * Uses lowercase alphanumeric alphabet for clean URLs without special characters.
 *
 * Sqids encodes numbers into short unique IDs that are URL-safe and can be
 * decoded back to the original number if needed.
 */

import Sqids from "sqids";

/**
 * URL-safe alphabet: lowercase letters and numbers only.
 * No special characters, no uppercase - clean URLs that work everywhere.
 * Shuffled to prevent sequential patterns in generated IDs.
 */
const URL_SAFE_ALPHABET = "k6wm9zdx0yc8rnvuqeltsaghj4fo2ip5b713";

/**
 * Minimum ID length: 8 characters provides sufficient entropy for uniqueness.
 * Shorter URLs are cleaner and more shareable.
 */
const MIN_LENGTH = 8;

/**
 * Sqids instance configured for URL-safe connection IDs.
 */
const sqids = new Sqids({
    alphabet: URL_SAFE_ALPHABET,
    minLength: MIN_LENGTH,
});

/**
 * Generate a URL-safe Sqid for connections.
 *
 * Uses crypto.getRandomValues for secure random number generation,
 * then encodes via Sqids for a clean, URL-safe ID.
 *
 * @returns 8+ character lowercase alphanumeric ID
 * @example "k6wm9zdx"
 */
export function generateConnectionId(): string {
    // Generate two 32-bit random numbers for high entropy
    const randomBytes = new Uint32Array(2);
    crypto.getRandomValues(randomBytes);

    // Encode both numbers for maximum entropy in the output
    return sqids.encode([randomBytes[0], randomBytes[1]]);
}

/**
 * Default slug prefix when title is empty or contains only special characters.
 */
const DEFAULT_SLUG_PREFIX = "connection";

/**
 * Generate a URL-safe slug from a title and ID.
 *
 * @param title - The connection title (can be null/undefined)
 * @param id - The connection Sqid
 * @returns SEO-friendly slug: "title-slug-id" or "connection-id"
 *
 * @example
 * generateSlug("Fix authentication bug", "k6wm9zdx")
 * // => "fix-authentication-bug-k6wm9zdx"
 *
 * generateSlug(null, "k6wm9zdx")
 * // => "connection-k6wm9zdx"
 *
 * generateSlug("✨ Add dark mode", "xyz789ab")
 * // => "add-dark-mode-xyz789ab"
 *
 * generateSlug("✨🎉🔥", "xyz789ab")
 * // => "connection-xyz789ab" (fallback for emoji-only titles)
 */
export function generateSlug(title: string | null | undefined, id: string): string {
    const baseSlug = slugify(title ?? "");

    // Fallback if title was empty or contained only special characters
    if (!baseSlug) {
        return `${DEFAULT_SLUG_PREFIX}-${id}`;
    }

    return `${baseSlug}-${id}`;
}

/**
 * Valid Sqid pattern: 8+ lowercase alphanumeric characters from our alphabet.
 * Sqids may generate IDs longer than minLength depending on the input numbers.
 */
const SQID_PATTERN = /^[0-9a-z]{8,}$/;

/**
 * Extract the connection ID from a slug.
 *
 * Sqids can vary in length (8+ characters), so we find the ID by looking
 * for the last segment after a hyphen that matches our pattern.
 *
 * @param slug - The full slug from URL
 * @returns The connection ID (8+ characters)
 * @throws Error if slug is malformed
 *
 * @example
 * extractIdFromSlug("fix-auth-bug-k6wm9zdx")
 * // => "k6wm9zdx"
 */
export function extractIdFromSlug(slug: string): string {
    // Slug must be at least MIN_LENGTH characters (ID only, no title)
    if (slug.length < MIN_LENGTH) {
        throw new Error(`Invalid slug: too short (minimum ${MIN_LENGTH} characters)`);
    }

    // Try to find the ID - it's the last segment that matches our pattern
    // First, try the entire slug as just an ID
    if (SQID_PATTERN.test(slug)) {
        return slug;
    }

    // Otherwise, find the last hyphen and check if what follows is a valid ID
    const lastHyphenIndex = slug.lastIndexOf("-");
    if (lastHyphenIndex === -1) {
        throw new Error(
            `Invalid slug: ID portion must be ${MIN_LENGTH}+ lowercase alphanumeric characters`
        );
    }

    const potentialId = slug.slice(lastHyphenIndex + 1);

    if (!SQID_PATTERN.test(potentialId)) {
        throw new Error(
            `Invalid slug: ID portion must be ${MIN_LENGTH}+ lowercase alphanumeric characters`
        );
    }

    return potentialId;
}

/**
 * Decode a Sqid back to its original numbers.
 *
 * Useful for debugging or if we ever need to extract metadata
 * encoded in the ID.
 *
 * @param id - The Sqid to decode
 * @returns Array of numbers that were encoded
 */
export function decodeSqid(id: string): number[] {
    return sqids.decode(id);
}

/**
 * Slugify a string for URLs.
 *
 * - Converts to lowercase
 * - Removes emojis and special characters
 * - Replaces spaces with hyphens
 * - Removes consecutive hyphens
 * - Trims hyphens from start/end
 * - Limits length for clean URLs
 *
 * @param text - Text to slugify
 * @returns URL-safe slug
 */
function slugify(text: string): string {
    return (
        text
            .toLowerCase()
            // Remove emojis and special unicode characters
            .replace(/[\u{1F300}-\u{1F9FF}]/gu, "")
            .replace(/[\u{2600}-\u{26FF}]/gu, "")
            .replace(/[\u{2700}-\u{27BF}]/gu, "")
            // Replace spaces and underscores with hyphens
            .replace(/[\s_]+/g, "-")
            // Remove all non-alphanumeric characters except hyphens
            .replace(/[^a-z0-9-]/g, "")
            // Remove consecutive hyphens
            .replace(/-+/g, "-")
            // Trim hyphens from start and end
            .replace(/^-|-$/g, "")
            // Limit length (60 chars for slug + 1 hyphen + 8+ for ID)
            .slice(0, 60)
            // Trim trailing hyphen if we cut mid-word
            .replace(/-$/, "")
    );
}
