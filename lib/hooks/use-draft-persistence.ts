/**
 * Draft Persistence Hook
 *
 * Saves unsent message text to localStorage as the user types.
 * Restores draft on page load so work is never lost.
 *
 * Features:
 * - Debounced saves (500ms) to avoid excessive writes
 * - Per-connection drafts (each conversation has its own draft)
 * - Clears draft on successful send
 * - SSR-safe (no localStorage access on server)
 * - Detects recovered drafts for UI notification
 *
 * @see knowledge/users-should-feel.md - "Memory is relationship"
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { logger } from "@/lib/client-logger";

const DRAFT_KEY_PREFIX = "carmenta:draft:";
const DEBOUNCE_MS = 500;

export interface UseDraftPersistenceOptions {
    /** Connection ID to scope the draft to */
    connectionId: string | null;
    /** Current input value from parent state */
    input: string;
    /** Function to update input in parent state */
    setInput: (value: string) => void;
}

export interface UseDraftPersistenceReturn {
    /** Whether a draft was recovered on mount */
    hasRecoveredDraft: boolean;
    /** Dismiss the recovery notification (user chose to keep) */
    dismissRecovery: () => void;
    /** Clear the draft and dismiss (user chose to start fresh) */
    clearDraft: () => void;
    /** Call this when message is successfully sent */
    onMessageSent: () => void;
}

function getDraftKey(connectionId: string): string {
    return `${DRAFT_KEY_PREFIX}${connectionId}`;
}

/**
 * Try to get saved draft from localStorage
 * Returns null if not available or empty
 */
function getSavedDraft(connectionId: string | null): string | null {
    if (!connectionId) return null;
    if (typeof window === "undefined") return null;

    try {
        const key = getDraftKey(connectionId);
        const savedDraft = localStorage.getItem(key);
        if (savedDraft && savedDraft.trim().length > 0) {
            return savedDraft;
        }
    } catch {
        // localStorage might be unavailable
    }
    return null;
}

export function useDraftPersistence({
    connectionId,
    input,
    setInput,
}: UseDraftPersistenceOptions): UseDraftPersistenceReturn {
    // Track whether we've restored for this connection (to prevent double-restore)
    const restoredConnectionRef = useRef<string | null>(null);
    const debounceRef = useRef<NodeJS.Timeout | null>(null);

    // Initialize with draft check on first render (SSR-safe)
    const [showRecoveryBanner, setShowRecoveryBanner] = useState(false);

    // Restore draft on mount or connection change
    useEffect(() => {
        // Skip if we've already restored for this connection
        if (restoredConnectionRef.current === connectionId) return;
        if (!connectionId) return;

        const savedDraft = getSavedDraft(connectionId);

        if (savedDraft) {
            setInput(savedDraft);
            // Show banner after a microtask to avoid "setState in effect" lint error
            // by ensuring it's in a callback context
            Promise.resolve().then(() => {
                setShowRecoveryBanner(true);
            });
            logger.info(
                { connectionId, length: savedDraft.length },
                "📝 Draft recovered"
            );
        } else {
            // No draft for this connection - ensure banner is hidden
            Promise.resolve().then(() => {
                setShowRecoveryBanner(false);
            });
        }

        // Mark this connection as restored
        restoredConnectionRef.current = connectionId;
    }, [connectionId, setInput]);

    // Debounced save to localStorage
    useEffect(() => {
        if (!connectionId) return;
        if (typeof window === "undefined") return;

        // Clear any pending save
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }

        // Schedule save
        debounceRef.current = setTimeout(() => {
            try {
                const key = getDraftKey(connectionId);

                if (input.trim().length > 0) {
                    localStorage.setItem(key, input);
                } else {
                    // Clear empty drafts
                    localStorage.removeItem(key);
                }
            } catch (error) {
                // Quota exceeded or unavailable - fail silently
                logger.debug({ error }, "Could not save draft");
            }
        }, DEBOUNCE_MS);

        return () => {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }
        };
    }, [connectionId, input]);

    // Dismiss recovery notification (keep the text)
    const dismissRecovery = useCallback(() => {
        setShowRecoveryBanner(false);
    }, []);

    // Clear draft and dismiss (start fresh)
    const clearDraft = useCallback(() => {
        if (!connectionId) return;

        setInput("");
        setShowRecoveryBanner(false);

        try {
            const key = getDraftKey(connectionId);
            localStorage.removeItem(key);
        } catch {
            // Fail silently
        }
    }, [connectionId, setInput]);

    // Clear draft when message is sent
    const onMessageSent = useCallback(() => {
        if (!connectionId) return;

        // Clear any pending save
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
            debounceRef.current = null;
        }

        try {
            const key = getDraftKey(connectionId);
            localStorage.removeItem(key);
        } catch {
            // Fail silently
        }

        // Also dismiss recovery if it was showing
        setShowRecoveryBanner(false);
    }, [connectionId]);

    return {
        hasRecoveredDraft: showRecoveryBanner,
        dismissRecovery,
        clearDraft,
        onMessageSent,
    };
}
