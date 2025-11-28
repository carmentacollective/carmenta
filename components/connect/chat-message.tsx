"use client";

import type { UIMessage } from "@ai-sdk/react";
import Markdown from "react-markdown";

import { cn } from "@/lib/utils";

interface ChatMessageProps {
    message: UIMessage;
}

export function ChatMessage({ message }: ChatMessageProps) {
    const isUser = message.role === "user";

    // Extract text content from message parts
    const textContent = message.parts
        .filter((part): part is { type: "text"; text: string } => part.type === "text")
        .map((part) => part.text)
        .join("");

    return (
        <div className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}>
            <div
                className={cn(
                    "max-w-[85%] px-4 py-3",
                    isUser ? "bg-primary/20 text-foreground" : "blueprint-box"
                )}
            >
                {isUser ? (
                    <p className="whitespace-pre-wrap">{textContent}</p>
                ) : (
                    <div className="prose prose-invert prose-sm prose-headings:text-foreground prose-headings:font-bold prose-p:text-foreground/90 prose-p:leading-relaxed prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-strong:text-foreground prose-strong:font-semibold prose-code:text-primary prose-code:bg-muted/50 prose-code:px-1 prose-code:py-0.5 prose-code:rounded-none prose-code:before:content-none prose-code:after:content-none prose-pre:bg-muted/30 prose-pre:border prose-pre:border-border prose-pre:rounded-none prose-ul:text-foreground/90 prose-ol:text-foreground/90 prose-li:marker:text-primary max-w-none">
                        <Markdown>{textContent}</Markdown>
                    </div>
                )}
            </div>
        </div>
    );
}
