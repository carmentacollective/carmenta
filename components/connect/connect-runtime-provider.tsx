"use client";

import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useChatRuntime, AssistantChatTransport } from "@assistant-ui/react-ai-sdk";

interface ConnectRuntimeProviderProps {
    children: React.ReactNode;
}

/**
 * Provides the assistant-ui runtime configured for our /api/connect endpoint.
 *
 * This wraps the app with AssistantRuntimeProvider which enables:
 * - Message state management
 * - Tool UI rendering
 * - Streaming response handling
 *
 * Uses AssistantChatTransport to automatically forward system messages
 * and frontend tools to the backend.
 */
export function ConnectRuntimeProvider({ children }: ConnectRuntimeProviderProps) {
    const runtime = useChatRuntime({
        transport: new AssistantChatTransport({
            api: "/api/connect",
        }),
    });

    return (
        <AssistantRuntimeProvider runtime={runtime}>
            {children}
        </AssistantRuntimeProvider>
    );
}
