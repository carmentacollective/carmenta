"use client";

import { useCopilotChat, useCopilotAction } from "@copilotkit/react-core";
import { useEffect, useRef, useState } from "react";

import { logger } from "@/lib/client-logger";
import { WeatherCard } from "@/components/generative-ui/weather-card";
import { DataTable } from "@/components/generative-ui/data-table";

import { MessageInput } from "./message-input";
import { Message } from "./message";

const MODEL_ID = "anthropic/claude-sonnet-4.5";

// Type for CopilotKit messages (simplified from their internal types)
interface CopilotMessage {
    id: string;
    role: string;
    content: string;
}

export function Connect() {
    const [input, setInput] = useState("");
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const { visibleMessages, appendMessage, isLoading } = useCopilotChat();

    // Cast messages to our simplified type
    const messages = visibleMessages as unknown as CopilotMessage[];

    // Register frontend render for weather action
    useCopilotAction({
        name: "getWeather",
        description: "Get the current weather for a location",
        parameters: [
            {
                name: "location",
                type: "string",
                description: "The city or location to get weather for",
                required: true,
            },
        ],
        render: ({ result }) => {
            if (!result) {
                return (
                    <div className="blueprint-box animate-pulse p-4">
                        <div className="mb-2 h-4 w-24 rounded bg-muted" />
                        <div className="h-8 w-16 rounded bg-muted" />
                    </div>
                );
            }

            try {
                const data = JSON.parse(result as string);
                return <WeatherCard data={data} />;
            } catch {
                return (
                    <div className="text-sm text-muted-foreground">
                        Unable to display weather
                    </div>
                );
            }
        },
    });

    // Register frontend render for comparison action
    useCopilotAction({
        name: "compareOptions",
        description: "Compare multiple options in a table format",
        parameters: [
            {
                name: "title",
                type: "string",
                description: "Title for the comparison",
                required: true,
            },
            {
                name: "items",
                type: "string",
                description: "JSON array of items to compare",
                required: true,
            },
        ],
        render: ({ result }) => {
            if (!result) {
                return (
                    <div className="blueprint-box animate-pulse p-4">
                        <div className="mb-4 h-4 w-32 rounded bg-muted" />
                        <div className="space-y-2">
                            <div className="h-8 rounded bg-muted" />
                            <div className="h-8 rounded bg-muted" />
                        </div>
                    </div>
                );
            }

            try {
                const { title, data } = JSON.parse(result as string);
                const columns =
                    data.length > 0
                        ? Object.keys(data[0]).map((key: string) => ({
                              key,
                              header:
                                  key.charAt(0).toUpperCase() +
                                  key.slice(1).replace(/_/g, " "),
                          }))
                        : [];
                return <DataTable title={title} columns={columns} data={data} />;
            } catch {
                return (
                    <div className="text-sm text-muted-foreground">
                        Unable to display comparison
                    </div>
                );
            }
        },
    });

    // Scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userInput = input;
        setInput("");

        logger.debug({ messageCount: messages.length }, "Sending message");

        // Use type assertion for appendMessage since CopilotKit's types are complex
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (appendMessage as any)({
            id: crypto.randomUUID(),
            role: "user",
            content: userInput,
        });
    };

    return (
        <div className="flex h-full flex-col">
            {/* Messages area */}
            <div className="flex-1 overflow-y-auto px-4 py-6">
                <div className="mx-auto max-w-3xl space-y-6">
                    {messages.length === 0 ? (
                        <div className="flex h-full min-h-[300px] flex-col items-center justify-center text-center">
                            <div className="space-y-4">
                                <h2 className="text-2xl font-bold text-foreground">
                                    Let&apos;s connect
                                </h2>
                                <p className="max-w-md text-muted-foreground">
                                    We&apos;re here to think together. Share what&apos;s
                                    on your mind—a question, an idea, something
                                    you&apos;re working through.
                                </p>
                            </div>
                        </div>
                    ) : (
                        messages.map((message) => (
                            <Message
                                key={message.id}
                                message={{
                                    id: message.id,
                                    role: message.role as "user" | "assistant",
                                    parts: [
                                        {
                                            type: "text" as const,
                                            text: message.content,
                                        },
                                    ],
                                }}
                                modelId={
                                    message.role === "assistant" ? MODEL_ID : undefined
                                }
                            />
                        ))
                    )}

                    <div ref={messagesEndRef} />
                </div>
            </div>

            {/* Input area */}
            <div className="border-t border-border bg-background/80 px-4 py-4 backdrop-blur-sm">
                <div className="mx-auto max-w-3xl">
                    <MessageInput
                        input={input}
                        isLoading={isLoading}
                        onInputChange={setInput}
                        onSubmit={handleSubmit}
                    />
                    {isLoading && (
                        <p className="mt-2 text-xs text-muted-foreground">
                            We&apos;re thinking...
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
