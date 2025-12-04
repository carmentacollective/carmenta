/**
 * NanoID Utilities
 *
 * Custom NanoID generation for URL-safe, SEO-friendly identifiers.
 * Uses lowercase alphanumeric alphabet for clean URLs without special characters.
 */

import { customAlphabet } from "nanoid";

/**
 * URL-safe alphabet: lowercase letters and numbers only.
 * No special characters, no uppercase - clean URLs that work everywhere.
 */
const URL_SAFE_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";

/**
 * ID length: 12 characters provides ~62 bits of entropy.
 * At 1000 IDs/second, 50% collision probability in ~1000 years.
 * More than sufficient for connection IDs.
 */
const ID_LENGTH = 12;

/**
 * Generate a URL-safe NanoID for connections.
 *
 * @returns 12-character lowercase alphanumeric ID
 * @example "a1b2c3d4e5f6"
 */
export const generateConnectionId = customAlphabet(URL_SAFE_ALPHABET, ID_LENGTH);

/**
 * Generate a URL-safe slug from a title and ID.
 *
 * @param title - The connection title (can be null/undefined)
 * @param id - The connection NanoID
 * @returns SEO-friendly slug: "title-slug-id" or "new-connection-id"
 *
 * @example
 * generateSlug("Fix authentication bug", "a1b2c3d4e5f6")
 * // => "fix-authentication-bug-a1b2c3d4e5f6"
 *
 * generateSlug(null, "a1b2c3d4e5f6")
 * // => "new-connection-a1b2c3d4e5f6"
 *
 * generateSlug("✨ Add dark mode", "xyz789abc123")
 * // => "add-dark-mode-xyz789abc123"
 */
export function generateSlug(title: string | null | undefined, id: string): string {
    const baseSlug = slugify(title ?? "New connection");
    return `${baseSlug}-${id}`;
}

/**
 * Extract the connection ID from a slug.
 *
 * @param slug - The full slug from URL
 * @returns The 12-character connection ID
 *
 * @example
 * extractIdFromSlug("fix-auth-bug-a1b2c3d4e5f6")
 * // => "a1b2c3d4e5f6"
 */
export function extractIdFromSlug(slug: string): string {
    // ID is always the last 12 characters
    return slug.slice(-ID_LENGTH);
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
            // Limit length (60 chars for slug + 1 hyphen + 12 for ID = 73 total, under 100)
            .slice(0, 60)
            // Trim trailing hyphen if we cut mid-word
            .replace(/-$/, "")
    );
}
