"use client";

import { Component, useEffect, type ErrorInfo, type ReactNode } from "react";

import { ConnectRuntimeProvider } from "./connect-runtime-provider";
import { HoloThread } from "./holo-thread";
import { OnboardingChat } from "./onboarding-chat";
import { useOnboardingOptional } from "@/lib/onboarding";
import { logger } from "@/lib/client-logger";

/**
 * Error boundary to catch rendering failures in the chat interface.
 */
class ChatErrorBoundary extends Component<
    { children: ReactNode },
    { hasError: boolean }
> {
    constructor(props: { children: ReactNode }) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(): { hasError: boolean } {
        return { hasError: true };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        logger.error(
            { error: error.message, componentStack: errorInfo.componentStack },
            "Chat component error"
        );
    }

    render(): ReactNode {
        if (this.state.hasError) {
            return (
                <div className="flex h-full flex-col items-center justify-center p-8 text-center">
                    <div className="glass-card max-w-md">
                        <h2 className="mb-2 text-lg font-semibold text-foreground/90">
                            We hit a snag
                        </h2>
                        <p className="mb-4 text-sm text-foreground/60">
                            Something went sideways. A quick refresh should get us back
                            on track.
                        </p>
                        <button
                            onClick={() => window.location.reload()}
                            className="btn-cta rounded-full px-6 py-3"
                        >
                            Refresh Page
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

interface ChatProps {
    /** Whether to reset onboarding (from URL param) */
    shouldResetOnboarding?: boolean;
}

/**
 * Inner chat content that can access onboarding context.
 */
function ChatContent({ shouldResetOnboarding }: ChatProps) {
    const onboarding = useOnboardingOptional();

    // Handle reset onboarding when flag is set
    useEffect(() => {
        if (shouldResetOnboarding && onboarding) {
            onboarding
                .reset()
                .then(() => {
                    // Clear the URL param after resetting
                    const url = new URL(window.location.href);
                    url.searchParams.delete("reset-onboarding");
                    window.history.replaceState({}, "", url.toString());
                })
                .catch((error) => {
                    logger.error(
                        { error },
                        "Failed to reset onboarding from URL param"
                    );
                });
        }
    }, [shouldResetOnboarding, onboarding]);

    // Show onboarding chat if user hasn't completed onboarding
    if (onboarding?.isOnboarding) {
        return <OnboardingChat />;
    }

    // Normal chat
    return (
        <div className="scrollbar-holo h-full">
            <HoloThread />
        </div>
    );
}

/**
 * Main Chat component for the Connect page.
 *
 * Uses our custom HoloThread built with plain React components.
 * Chat state is managed via ChatContext from ConnectRuntimeProvider.
 *
 * Onboarding: If the user hasn't completed onboarding, shows the
 * OnboardingChat instead of the normal chat interface.
 *
 * Tool UIs (search, comparison, etc.) will be rendered inline when
 * we encounter tool call parts in assistant messages.
 */
export function Chat({ shouldResetOnboarding }: ChatProps) {
    return (
        <ChatErrorBoundary>
            <ConnectRuntimeProvider>
                <ChatContent shouldResetOnboarding={shouldResetOnboarding} />
            </ConnectRuntimeProvider>
        </ChatErrorBoundary>
    );
}
