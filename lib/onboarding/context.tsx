"use client";

/**
 * Onboarding Context
 *
 * Provides onboarding state to the chat interface. When onboarding is incomplete,
 * the chat shows Carmenta's onboarding prompts instead of the normal welcome screen.
 */

import {
    createContext,
    useContext,
    useState,
    useCallback,
    useMemo,
    type ReactNode,
} from "react";
import { useRouter } from "next/navigation";

import type { OnboardingItem } from "./config";
import type { OnboardingStatus } from "./actions";
import {
    completeOnboardingItem,
    skipOnboardingItem,
    completeThemeSelection,
    resetOnboarding as resetOnboardingAction,
} from "./actions";
import { logger } from "@/lib/client-logger";

interface OnboardingContextValue {
    /** Current onboarding status */
    status: OnboardingStatus;
    /** Whether we're in onboarding mode */
    isOnboarding: boolean;
    /** The current item being collected */
    currentItem: OnboardingItem | null;
    /** Complete the current item with data */
    completeItem: (data?: string) => Promise<void>;
    /** Skip the current item (if allowed) */
    skipItem: () => Promise<void>;
    /** Complete theme selection specifically */
    selectTheme: (theme: string) => Promise<void>;
    /** Reset onboarding (for testing) */
    reset: () => Promise<void>;
    /** Whether an action is in progress */
    isPending: boolean;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function useOnboarding() {
    const context = useContext(OnboardingContext);
    if (!context) {
        throw new Error("useOnboarding must be used within OnboardingProvider");
    }
    return context;
}

/**
 * Safe hook that returns null if not in OnboardingProvider
 * Useful for components that may or may not be in onboarding context
 */
export function useOnboardingOptional() {
    return useContext(OnboardingContext);
}

interface OnboardingProviderProps {
    children: ReactNode;
    /** Initial status from server */
    initialStatus: OnboardingStatus;
}

export function OnboardingProvider({
    children,
    initialStatus,
}: OnboardingProviderProps) {
    const router = useRouter();
    const [status, setStatus] = useState<OnboardingStatus>(initialStatus);
    const [isPending, setIsPending] = useState(false);

    const isOnboarding = !status.isComplete;
    const currentItem = status.nextItem;

    const completeItem = useCallback(
        async (data?: string) => {
            if (!currentItem) return;
            setIsPending(true);

            try {
                const newStatus = await completeOnboardingItem(currentItem.key, data);
                setStatus(newStatus);
                logger.info(
                    { item: currentItem.key, isComplete: newStatus.isComplete },
                    "Onboarding item completed"
                );
            } catch (error) {
                logger.error(
                    { error, item: currentItem.key },
                    "Failed to complete item"
                );
                throw error;
            } finally {
                setIsPending(false);
            }
        },
        [currentItem]
    );

    const skipItem = useCallback(async () => {
        if (!currentItem || currentItem.required) return;
        setIsPending(true);

        try {
            const newStatus = await skipOnboardingItem(currentItem.key);
            setStatus(newStatus);
            logger.info({ item: currentItem.key }, "Onboarding item skipped");
        } catch (error) {
            logger.error({ error, item: currentItem.key }, "Failed to skip item");
            throw error;
        } finally {
            setIsPending(false);
        }
    }, [currentItem]);

    const selectTheme = useCallback(async (theme: string) => {
        setIsPending(true);

        try {
            const newStatus = await completeThemeSelection(theme);
            setStatus(newStatus);
            logger.info({ theme }, "Theme selection completed");
        } catch (error) {
            logger.error({ error, theme }, "Failed to complete theme selection");
            throw error;
        } finally {
            setIsPending(false);
        }
    }, []);

    const reset = useCallback(async () => {
        // Prevent concurrent resets
        if (isPending) return;

        setIsPending(true);

        try {
            const newStatus = await resetOnboardingAction();
            setStatus(newStatus);
            // Refresh to re-run server-side checks
            router.refresh();
            logger.info({}, "Onboarding reset");
        } catch (error) {
            logger.error({ error }, "Failed to reset onboarding");
            throw error;
        } finally {
            setIsPending(false);
        }
    }, [router, isPending]);

    const value = useMemo<OnboardingContextValue>(
        () => ({
            status,
            isOnboarding,
            currentItem,
            completeItem,
            skipItem,
            selectTheme,
            reset,
            isPending,
        }),
        [
            status,
            isOnboarding,
            currentItem,
            completeItem,
            skipItem,
            selectTheme,
            reset,
            isPending,
        ]
    );

    return (
        <OnboardingContext.Provider value={value}>
            {children}
        </OnboardingContext.Provider>
    );
}
