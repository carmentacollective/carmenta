"use client";

import { Thread } from "@assistant-ui/react-ui";

import { ConnectRuntimeProvider } from "./connect-runtime-provider";
import { WeatherToolUI, CompareToolUI } from "@/components/generative-ui";

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
        <ConnectRuntimeProvider>
            {/* Register tool UIs so they render when tools are called */}
            <WeatherToolUI />
            <CompareToolUI />

            {/* Full height thread with custom styling */}
            <div className="flex h-full flex-col">
                <Thread />
            </div>
        </ConnectRuntimeProvider>
    );
}
