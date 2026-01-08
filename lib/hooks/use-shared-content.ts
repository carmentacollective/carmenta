"use client";

/**
 * useSharedContent Hook
 *
 * Handles content shared to Carmenta via the PWA Share Target API.
 * Reads shared content from URL params and provides it to the composer.
 *
 * Flow:
 * 1. User shares content from another app
 * 2. /api/share uploads files and redirects with URL params
 * 3. This hook reads the params and provides shared content
 * 4. After consuming, clears params from URL
 */

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useSearchParams } from "next/navigation";

import { logger } from "@/lib/client-logger";

/**
 * Shared file metadata (matches what /api/share passes in URL)
 */
export interface SharedFile {
    url: string;
    name: string;
    mediaType: string;
    size: number;
}

/**
 * Hook return type
 */
interface UseSharedContentReturn {
    /** Shared text content (from title, text, URL) */
    sharedText: string | null;
    /** Shared files (already uploaded to Supabase) */
    sharedFiles: SharedFile[];
    /** Whether there's any shared content to consume */
    hasSharedContent: boolean;
    /** Clear shared content after consuming */
    clearSharedContent: () => void;
}

/**
 * Parse shared files from base64-encoded JSON.
 * Uses atob + TextDecoder for browser compatibility (no Node Buffer).
 */
function parseSharedFiles(filesBase64: string | null): SharedFile[] {
    if (!filesBase64) return [];

    try {
        // Decode base64 to binary string, then to UTF-8
        const binaryString = atob(filesBase64);
        const bytes = Uint8Array.from(binaryString, (char) => char.charCodeAt(0));
        const filesJson = new TextDecoder().decode(bytes);
        const parsed = JSON.parse(filesJson);

        // Validate structure - must be array to prevent crash on .length access
        if (!Array.isArray(parsed)) {
            logger.warn({ parsed }, "Shared files param is not an array");
            return [];
        }

        return parsed as SharedFile[];
    } catch (error) {
        logger.error({ error }, "Failed to parse shared files from URL");
        return [];
    }
}

/**
 * Read and consume shared content from URL params.
 *
 * Call clearSharedContent() after using the content to prevent
 * it from being re-applied on navigation.
 */
export function useSharedContent(): UseSharedContentReturn {
    const searchParams = useSearchParams();
    const [consumed, setConsumed] = useState(false);
    const hasLoggedRef = useRef(false);

    // Read shared content from URL params (returns null if consumed or no params)
    const sharedText = !consumed ? (searchParams?.get("sharedText") ?? null) : null;
    const filesBase64 = !consumed ? (searchParams?.get("sharedFiles") ?? null) : null;
    // Memoize to avoid re-parsing on every render
    const sharedFiles = useMemo(() => parseSharedFiles(filesBase64), [filesBase64]);

    // Log once when shared content is detected
    useEffect(() => {
        if (hasLoggedRef.current) return;
        if (!sharedText && sharedFiles.length === 0) return;

        hasLoggedRef.current = true;

        if (sharedText) {
            logger.info(
                { textLength: sharedText.length },
                "Loaded shared text from URL"
            );
        }
        if (sharedFiles.length > 0) {
            logger.info(
                {
                    fileCount: sharedFiles.length,
                    files: sharedFiles.map((f) => f.name),
                },
                "Loaded shared files from URL"
            );
        }
    }, [sharedText, sharedFiles]);

    // Clear shared content and update URL
    const clearSharedContent = useCallback(() => {
        setConsumed(true);

        // Remove share params from URL without triggering navigation
        const params = new URLSearchParams(searchParams?.toString() ?? "");
        params.delete("sharedText");
        params.delete("sharedFiles");

        // Keep other params (like 'new')
        const newUrl = params.toString()
            ? `${window.location.pathname}?${params.toString()}`
            : window.location.pathname;

        window.history.replaceState({}, "", newUrl);

        logger.debug({}, "Cleared shared content from URL");
    }, [searchParams]);

    const hasSharedContent = !!(sharedText || sharedFiles.length > 0);

    return {
        sharedText,
        sharedFiles,
        hasSharedContent,
        clearSharedContent,
    };
}
