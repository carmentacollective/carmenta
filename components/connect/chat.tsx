"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { Thread } from "@assistant-ui/react-ui";

import { ConnectRuntimeProvider } from "./connect-runtime-provider";
import { WeatherToolUI, CompareToolUI } from "@/components/generative-ui";
import { logger } from "@/lib/client-logger";

/**
 * Error boundary to catch rendering failures in the chat interface.
 * Prevents tool UI crashes from taking down the entire page.
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
                    <div className="blueprint-box max-w-md border-destructive/50 bg-destructive/10">
                        <h2 className="mb-2 font-bold text-destructive">
                            Something went wrong
                        </h2>
                        <p className="mb-4 text-sm text-muted-foreground">
                            We encountered an error rendering the chat. Please refresh
                            the page to try again.
                        </p>
                        <button
                            onClick={() => window.location.reload()}
                            className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
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
 * Uses assistant-ui Thread for rendering the conversation with support for:
 * - Streaming text responses
 * - Tool calls rendered as custom UI components (WeatherCard, DataTable)
 * - Message branching and editing
 *
 * The ConnectRuntimeProvider handles:
 * - Connection to /api/connect endpoint
 * - Message state management
 * - Tool execution flow
 */
export function Chat() {
    return (
        <ChatErrorBoundary>
            <ConnectRuntimeProvider>
                {/* Register tool UIs so they render when tools are called */}
                <WeatherToolUI />
                <CompareToolUI />

                {/* Full height thread with custom styling */}
                <div className="flex h-full flex-col">
                    <Thread />
                </div>
            </ConnectRuntimeProvider>
        </ChatErrorBoundary>
    );
}
