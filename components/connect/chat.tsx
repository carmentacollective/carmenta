"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

import { ConnectRuntimeProvider } from "./connect-runtime-provider";
import { HoloThread } from "./holo-thread";
import { WeatherToolUI, CompareToolUI } from "@/components/generative-ui";
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
                            className="btn-holo"
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
 * Uses our custom HoloThread built with headless primitives.
 * No fighting with pre-styled components - just clean composition.
 */
export function Chat() {
    return (
        <ChatErrorBoundary>
            <ConnectRuntimeProvider>
                <WeatherToolUI />
                <CompareToolUI />

                <div className="scrollbar-holo h-full">
                    <HoloThread />
                </div>
            </ConnectRuntimeProvider>
        </ChatErrorBoundary>
    );
}
