"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

import { HoloThread } from "./holo-thread";
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

/**
 * Main Chat component for the Connect page.
 *
 * Uses our custom HoloThread built with plain React components.
 * Chat state is managed via ChatContext from ConnectRuntimeProvider,
 * which wraps the entire ConnectLayout (including header).
 *
 * Tool UIs (search, comparison, etc.) will be rendered inline when
 * we encounter tool call parts in assistant messages.
 */
export function Chat() {
    return (
        <ChatErrorBoundary>
            <div className="scrollbar-holo h-full">
                <HoloThread />
            </div>
        </ChatErrorBoundary>
    );
}
