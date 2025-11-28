"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import { logger } from "@/lib/client-logger";

import { ChatInput } from "./chat-input";
import { ChatMessage } from "./chat-message";

const MODEL_ID = "anthropic/claude-sonnet-4.5";

export function Chat() {
    const [input, setInput] = useState("");
    const chatId = useId();

    const transport = useMemo(
        () =>
            new DefaultChatTransport({
                api: "/api/chat",
            }),
        []
    );

    const { messages, status, error, sendMessage } = useChat({
        id: chatId,
        transport,
        onFinish: () => {
            logger.debug({ chatId }, "Chat response completed");
        },
    });

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const isLoading = status === "submitted" || status === "streaming";

    // Log errors when they occur
    useEffect(() => {
        if (error) {
            logger.error(
                { error: error.message, messageCount: messages.length },
                "Chat request failed"
            );
        }
    }, [error, messages.length]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userInput = input;
        setInput("");
        sendMessage({ text: userInput });
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
                            <ChatMessage
                                key={message.id}
                                message={message}
                                modelId={
                                    message.role === "assistant" ? MODEL_ID : undefined
                                }
                            />
                        ))
                    )}

                    {error && (
                        <div className="blueprint-box border-destructive/50 bg-destructive/10 text-sm text-destructive">
                            Something went wrong. Please try again.
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>
            </div>

            {/* Input area */}
            <div className="border-t border-border bg-background/80 px-4 py-4 backdrop-blur-sm">
                <div className="mx-auto max-w-3xl">
                    <ChatInput
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
