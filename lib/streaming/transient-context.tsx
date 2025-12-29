"use client";

/**
 * Transient Message Context
 *
 * Client-side state management for transient messages received during streaming.
 * Provides hooks for components to access and display transient status updates.
 */

import {
    createContext,
    useContext,
    useState,
    useCallback,
    useMemo,
    useRef,
    type ReactNode,
} from "react";
import type { TransientMessage, TransientDestination } from "./types";
import { isTransientDataPart } from "./types";

/**
 * Context value shape.
 */
interface TransientContextValue {
    /** All current transient messages, keyed by ID */
    messages: Map<string, TransientMessage>;
    /** Messages filtered by destination */
    chatMessages: TransientMessage[];
    oracleMessages: TransientMessage[];
    toastMessages: TransientMessage[];
    /** Handler for incoming data parts from useChat */
    handleDataPart: (dataPart: unknown) => void;
    /** Clear all transient messages (call when streaming ends) */
    clearAll: () => void;
    /** Clear a specific message by ID */
    clearMessage: (id: string) => void;
    /** Whether there are any active transient messages */
    hasActiveMessages: boolean;
}

const TransientContext = createContext<TransientContextValue | null>(null);

/**
 * Provider for transient message state.
 */
export function TransientProvider({ children }: { children: ReactNode }) {
    const [messages, setMessages] = useState<Map<string, TransientMessage>>(new Map());

    /**
     * Handle incoming data parts from useChat's onData callback.
     * Filters for transient parts and updates state.
     */
    // Track when messages were first shown to enforce minimum display time
    const messageTimestamps = useRef<Map<string, number>>(new Map());
    const pendingClears = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
    const MINIMUM_DISPLAY_MS = 800; // Show status for at least 800ms

    const handleDataPart = useCallback((dataPart: unknown) => {
        if (!isTransientDataPart(dataPart)) {
            return;
        }

        const message = dataPart.data;

        // Empty text means clear the message (but enforce minimum display time)
        if (!message.text) {
            const timestamp = messageTimestamps.current.get(dataPart.id);
            const elapsed = timestamp ? Date.now() - timestamp : MINIMUM_DISPLAY_MS;
            const remainingTime = Math.max(0, MINIMUM_DISPLAY_MS - elapsed);

            // Cancel any pending clear for this ID
            const existingClear = pendingClears.current.get(dataPart.id);
            if (existingClear) clearTimeout(existingClear);

            if (remainingTime > 0) {
                // Delay the clear to ensure minimum display time
                const timeoutId = setTimeout(() => {
                    setMessages((prev) => {
                        const next = new Map(prev);
                        next.delete(dataPart.id);
                        return next;
                    });
                    messageTimestamps.current.delete(dataPart.id);
                    pendingClears.current.delete(dataPart.id);
                }, remainingTime);
                pendingClears.current.set(dataPart.id, timeoutId);
            } else {
                // Already displayed long enough, clear immediately
                setMessages((prev) => {
                    const next = new Map(prev);
                    next.delete(dataPart.id);
                    return next;
                });
                messageTimestamps.current.delete(dataPart.id);
            }
            return;
        }

        // Update or add the message
        if (!messageTimestamps.current.has(dataPart.id)) {
            messageTimestamps.current.set(dataPart.id, Date.now());
        }
        setMessages((prev) => {
            const next = new Map(prev);
            next.set(dataPart.id, message);
            return next;
        });
    }, []);

    /**
     * Clear all transient messages.
     * Should be called when streaming completes.
     */
    const clearAll = useCallback(() => {
        // Cancel any pending delayed clears
        for (const timeoutId of pendingClears.current.values()) {
            clearTimeout(timeoutId);
        }
        pendingClears.current.clear();
        messageTimestamps.current.clear();
        setMessages(new Map());
    }, []);

    /**
     * Clear a specific message by ID.
     */
    const clearMessage = useCallback((id: string) => {
        setMessages((prev) => {
            const next = new Map(prev);
            next.delete(id);
            return next;
        });
    }, []);

    /**
     * Filter messages by destination.
     */
    const filterByDestination = useCallback(
        (destination: TransientDestination): TransientMessage[] => {
            return Array.from(messages.values()).filter(
                (m) => m.destination === destination
            );
        },
        [messages]
    );

    const value = useMemo<TransientContextValue>(() => {
        const chatMessages = filterByDestination("chat");
        const oracleMessages = filterByDestination("oracle");
        const toastMessages = filterByDestination("toast");

        return {
            messages,
            chatMessages,
            oracleMessages,
            toastMessages,
            handleDataPart,
            clearAll,
            clearMessage,
            hasActiveMessages: messages.size > 0,
        };
    }, [messages, filterByDestination, handleDataPart, clearAll, clearMessage]);

    return (
        <TransientContext.Provider value={value}>{children}</TransientContext.Provider>
    );
}

/**
 * Hook to access transient message state.
 */
export function useTransient(): TransientContextValue {
    const context = useContext(TransientContext);
    if (!context) {
        throw new Error("useTransient must be used within TransientProvider");
    }
    return context;
}

/**
 * Hook to access only chat-destination transient messages.
 */
export function useTransientChat(): TransientMessage[] {
    const { chatMessages } = useTransient();
    return chatMessages;
}

/**
 * Hook to access only oracle-destination transient messages.
 */
export function useTransientOracle(): TransientMessage[] {
    const { oracleMessages } = useTransient();
    return oracleMessages;
}

/**
 * Hook to access only toast-destination transient messages.
 */
export function useTransientToast(): TransientMessage[] {
    const { toastMessages } = useTransient();
    return toastMessages;
}
