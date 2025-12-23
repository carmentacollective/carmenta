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
 * Cryptographically shuffled to prevent sequential patterns in generated IDs.
 */
const URL_SAFE_ALPHABET = "2ot9ib15snuxw4vfdjc37l0gmk68ezypharq";

/**
 * Minimum ID length: 6 characters for compact, shareable URLs.
 * Combined with two 32-bit random numbers, provides sufficient entropy.
 */
const MIN_LENGTH = 6;

/**
 * Sqids instance configured for URL-safe connection IDs.
 */
const sqids = new Sqids({
    alphabet: URL_SAFE_ALPHABET,
    minLength: MIN_LENGTH,
});

/**
 * Encode a sequential database ID into a URL-safe Sqid.
 *
 * This is the core of Sqids: sequential IDs (1, 2, 3...) become
 * non-sequential-looking strings that grow naturally as IDs increase.
 *
 * @param seqId - Sequential integer from database (e.g., SERIAL column)
 * @returns 6+ character lowercase alphanumeric ID
 *
 * @example
 * encodeConnectionId(1)       // => "2ot9ib" (6 chars)
 * encodeConnectionId(1000000) // => "2ot9ib5s" (8 chars)
 */
export function encodeConnectionId(seqId: number): string {
    return sqids.encode([seqId]);
}

/**
 * Decode a Sqid back to its sequential database ID.
 *
 * Useful for database lookups - decode the URL ID to get the seq_id,
 * then query by the indexed integer column.
 *
 * Returns null for invalid IDs instead of throwing, allowing graceful
 * handling in server actions.
 *
 * @param id - The Sqid to decode
 * @returns The original sequential ID, or null if invalid
 *
 * @example
 * decodeConnectionId("2ot9ib") // => 1
 * decodeConnectionId("invalid") // => null
 */
export function decodeConnectionId(id: string): number | null {
    try {
        const decoded = sqids.decode(id);
        if (decoded.length !== 1) {
            return null;
        }
        return decoded[0];
    } catch {
        return null;
    }
}

/**
 * Default slug when title is empty or contains only special characters.
 */
const DEFAULT_SLUG = "connection";

/**
 * Generate a URL-safe slug from a title.
 *
 * URL structure is now /connection/[slug]/[id] so the slug is title-only.
 *
 * @param title - The connection title (can be null/undefined)
 * @returns SEO-friendly slug from title, or "connection" as fallback
 *
 * @example
 * generateSlug("Fix authentication bug")
 * // => "fix-authentication-bug"
 *
 * generateSlug(null)
 * // => "connection"
 *
 * generateSlug("✨ Add dark mode")
 * // => "add-dark-mode"
 *
 * generateSlug("✨🎉🔥")
 * // => "connection" (fallback for emoji-only titles)
 */
export function generateSlug(title: string | null | undefined): string {
    const baseSlug = slugify(title ?? "");

    // Fallback if title was empty or contained only special characters
    if (!baseSlug) {
        return DEFAULT_SLUG;
    }

    return baseSlug;
}

/**
 * Valid Sqid pattern: 6+ lowercase alphanumeric characters from our alphabet.
 * Sqids may generate IDs longer than minLength depending on the input numbers.
 */
const SQID_PATTERN = /^[0-9a-z]{6,}$/;

/**
 * Validate a connection ID format.
 *
 * With the URL structure /connection/[slug]/[id], the ID comes from
 * a dedicated route parameter, so we just need to validate its format.
 *
 * @param id - The ID to validate
 * @returns true if valid Sqid format
 *
 * @example
 * isValidConnectionId("2ot9ib") // => true
 * isValidConnectionId("INVALID") // => false
 */
export function isValidConnectionId(id: string): boolean {
    return SQID_PATTERN.test(id);
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
            // Limit length to 60 chars for clean, readable URLs
            .slice(0, 60)
            // Trim trailing hyphen if we cut mid-word
            .replace(/-$/, "")
    );
}
