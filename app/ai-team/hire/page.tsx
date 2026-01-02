"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Send, ArrowLeft, Clock, CheckCircle2, Square } from "lucide-react";
import * as Sentry from "@sentry/nextjs";

import { StandardPageLayout } from "@/components/layouts/standard-page-layout";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import { CarmentaAvatar } from "@/components/ui/carmenta-avatar";
import { cn } from "@/lib/utils";
import { logger } from "@/lib/client-logger";

/**
 * Message in the hiring conversation
 */
interface Message {
    id: string;
    role: "user" | "assistant";
    content: string;
}

/**
 * Generated playbook for the automation
 */
interface Playbook {
    name: string;
    description: string;
    schedule: {
        cron: string;
        displayText: string;
    };
    prompt: string;
    requiredIntegrations: string[];
}

/**
 * Parse playbook from assistant message
 */
function parsePlaybook(content: string): Playbook | null {
    try {
        // Look for JSON block in the message
        const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[1]) as Playbook;
        }

        // Try to find structured data markers
        const nameMatch = content.match(/\*\*Name:\*\*\s*(.+)/);
        const scheduleMatch = content.match(/\*\*Schedule:\*\*\s*(.+)/);
        const promptMatch = content.match(
            /\*\*Instructions:\*\*\s*([\s\S]+?)(?=\*\*|$)/
        );

        if (nameMatch && scheduleMatch) {
            return {
                name: nameMatch[1].trim(),
                description: "",
                schedule: {
                    cron: "0 9 * * *", // Default to 9am daily
                    displayText: scheduleMatch[1].trim(),
                },
                prompt: promptMatch ? promptMatch[1].trim() : "",
                requiredIntegrations: [],
            };
        }

        return null;
    } catch {
        return null;
    }
}

/**
 * User message bubble - reuses styling from HoloThread
 */
function UserMessageBubble({ content }: { content: string }) {
    return (
        <div className="my-3 flex w-full justify-end sm:my-4">
            <div className="max-w-[85%]">
                <div className="user-message-bubble border-r-primary rounded-2xl rounded-br-md border-r-[3px] px-4 py-3">
                    <p className="text-sm whitespace-pre-wrap">{content}</p>
                </div>
            </div>
        </div>
    );
}

/**
 * Assistant message bubble - reuses styling and components from HoloThread
 */
function AssistantMessageBubble({
    content,
    isStreaming = false,
}: {
    content: string;
    isStreaming?: boolean;
}) {
    return (
        <div className="my-3 flex w-full sm:my-4">
            <div className="relative max-w-[85%]">
                {/* Carmenta avatar - positioned outside bubble */}
                <div className="absolute top-2 -left-10 hidden sm:block">
                    <CarmentaAvatar
                        size="sm"
                        state={isStreaming ? "speaking" : "idle"}
                    />
                </div>

                <div className="assistant-message-bubble rounded-2xl rounded-bl-md border-l-[3px] border-l-cyan-400 px-4 py-3">
                    <MarkdownRenderer content={content} isStreaming={isStreaming} />
                </div>
            </div>
        </div>
    );
}

/**
 * Thinking indicator - shown while waiting for response
 */
function ThinkingBubble() {
    return (
        <div className="my-3 flex w-full sm:my-4">
            <div className="relative">
                <div className="absolute top-2 -left-10 hidden sm:block">
                    <CarmentaAvatar size="sm" state="thinking" />
                </div>
                <div className="assistant-message-bubble rounded-2xl rounded-bl-md border-l-[3px] border-l-cyan-400 px-4 py-3">
                    <div className="text-foreground/60 flex items-center gap-2 text-sm">
                        <Sparkles className="h-4 w-4 animate-pulse" />
                        <span>Thinking...</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

/**
 * Simple composer for wizard chat - much simpler than main Composer
 */
function WizardComposer({
    value,
    onChange,
    onSubmit,
    isLoading,
    placeholder = "Describe what you need...",
}: {
    value: string;
    onChange: (value: string) => void;
    onSubmit: () => void;
    isLoading: boolean;
    placeholder?: string;
}) {
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // Focus input on mount
    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    // Auto-resize textarea
    useEffect(() => {
        const textarea = inputRef.current;
        if (!textarea) return;
        textarea.style.height = "auto";
        textarea.style.height = `${textarea.scrollHeight}px`;
    }, [value]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (value.trim() && !isLoading) {
                onSubmit();
            }
        }
    };

    return (
        <div className="flex gap-2">
            <textarea
                ref={inputRef}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                className={cn(
                    "w-full flex-1 resize-none",
                    "max-h-48 min-h-11",
                    "px-4 py-2.5",
                    "text-base leading-5 outline-none",
                    "text-foreground/95 placeholder:text-foreground/40",
                    "rounded-xl transition-all",
                    "bg-foreground/[0.03] shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)]",
                    "border-foreground/8 focus:border-foreground/35 border"
                )}
                rows={1}
                disabled={isLoading}
            />
            <button
                type="button"
                onClick={onSubmit}
                disabled={isLoading || !value.trim()}
                className={cn(
                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-all",
                    "bg-primary text-primary-foreground hover:bg-primary/90",
                    "disabled:cursor-not-allowed disabled:opacity-50"
                )}
            >
                {isLoading ? (
                    <Square className="h-4 w-4" />
                ) : (
                    <Send className="h-4 w-4" />
                )}
            </button>
        </div>
    );
}

/**
 * Hiring wizard page - chat-style interface
 *
 * Uses shared components from the main chat:
 * - MarkdownRenderer for message content
 * - CarmentaAvatar for assistant identity
 * - Message bubble styling patterns
 */
export default function HirePage() {
    const router = useRouter();
    const [messages, setMessages] = useState<Message[]>([
        {
            id: "welcome",
            role: "assistant",
            content: `Hi there! I'm here to help you hire a new AI team member.

Tell me what you'd like automated. For example:
- "Check my email every morning and flag important messages"
- "Monitor competitor news and summarize weekly"
- "Triage my Slack DMs and highlight urgent ones"

What can we help you with?`,
        },
    ]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [playbook, setPlaybook] = useState<Playbook | null>(null);
    const [isHiring, setIsHiring] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, isLoading]);

    const handleSubmit = useCallback(async () => {
        if (!input.trim() || isLoading) return;

        const userMessage: Message = {
            id: `user-${Date.now()}`,
            role: "user",
            content: input.trim(),
        };

        setMessages((prev) => [...prev, userMessage]);
        setInput("");
        setIsLoading(true);

        try {
            const response = await fetch("/api/ai-team/hire", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    messages: [...messages, userMessage].map((m) => ({
                        role: m.role,
                        content: m.content,
                    })),
                }),
            });

            if (!response.ok) {
                throw new Error("Failed to get response");
            }

            const data = await response.json();

            const assistantMessage: Message = {
                id: `assistant-${Date.now()}`,
                role: "assistant",
                content: data.content,
            };

            setMessages((prev) => [...prev, assistantMessage]);

            // Check if response contains a playbook
            if (data.playbook) {
                setPlaybook(data.playbook);
            } else {
                const parsed = parsePlaybook(data.content);
                if (parsed) {
                    setPlaybook(parsed);
                }
            }
        } catch (error) {
            logger.error({ error }, "Failed to get hiring response");
            Sentry.captureException(error, {
                tags: { component: "hire-page", action: "chat" },
            });

            setMessages((prev) => [
                ...prev,
                {
                    id: `error-${Date.now()}`,
                    role: "assistant",
                    content:
                        "I'm having trouble processing that. Could you try rephrasing?",
                },
            ]);
        } finally {
            setIsLoading(false);
        }
    }, [input, isLoading, messages]);

    const handleHire = async () => {
        if (!playbook) return;

        setIsHiring(true);

        try {
            const response = await fetch("/api/jobs", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: playbook.name,
                    prompt: playbook.prompt,
                    scheduleCron: playbook.schedule.cron,
                    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                }),
            });

            if (!response.ok) {
                let errorMessage = "Failed to create automation";
                try {
                    const error = await response.json();
                    errorMessage = error.error ?? errorMessage;
                } catch {
                    // Failed to parse error response
                }
                throw new Error(errorMessage);
            }

            // Navigate back to AI Team page
            router.push("/ai-team?hired=true");
        } catch (error) {
            logger.error({ error }, "Failed to hire automation");
            Sentry.captureException(error, {
                tags: { component: "hire-page", action: "hire" },
            });

            setMessages((prev) => [
                ...prev,
                {
                    id: `error-${Date.now()}`,
                    role: "assistant",
                    content: `Something went wrong while setting that up: ${error instanceof Error ? error.message : "Unknown error"}. Want to try again?`,
                },
            ]);
            setIsHiring(false);
        }
    };

    return (
        <StandardPageLayout maxWidth="standard" contentClassName="py-8">
            <div className="flex h-[calc(100vh-12rem)] flex-col">
                {/* Header */}
                <div className="mb-6 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => router.push("/ai-team")}
                            className="text-foreground/60 hover:text-foreground p-1 transition-colors"
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </button>
                        <div>
                            <h1 className="text-foreground text-xl font-medium">
                                Hire a New Team Member
                            </h1>
                            <p className="text-foreground/60 text-sm">
                                Describe what you need and we'll set it up
                            </p>
                        </div>
                    </div>
                </div>

                {/* Main content area - split view on larger screens */}
                <div className="flex flex-1 gap-6 overflow-hidden">
                    {/* Chat panel */}
                    <div className="border-foreground/10 bg-foreground/[0.01] flex flex-1 flex-col rounded-2xl border">
                        {/* Messages - scrollable area with padding for avatar */}
                        <div className="flex-1 overflow-y-auto px-4 py-4 sm:pl-14">
                            <AnimatePresence mode="popLayout">
                                {messages.map((message) => (
                                    <motion.div
                                        key={message.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.2 }}
                                    >
                                        {message.role === "user" ? (
                                            <UserMessageBubble
                                                content={message.content}
                                            />
                                        ) : (
                                            <AssistantMessageBubble
                                                content={message.content}
                                            />
                                        )}
                                    </motion.div>
                                ))}
                            </AnimatePresence>

                            {isLoading && <ThinkingBubble />}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input */}
                        <div className="border-foreground/10 border-t p-4">
                            <WizardComposer
                                value={input}
                                onChange={setInput}
                                onSubmit={handleSubmit}
                                isLoading={isLoading}
                            />
                        </div>
                    </div>

                    {/* Playbook card - shown when generated */}
                    {playbook && (
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="border-foreground/10 bg-foreground/[0.01] w-80 flex-shrink-0 rounded-2xl border p-6"
                        >
                            <div className="mb-6 flex items-center gap-2">
                                <CheckCircle2 className="text-primary h-5 w-5" />
                                <h2 className="text-foreground font-medium">
                                    Ready to Hire
                                </h2>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <p className="text-foreground/60 text-xs tracking-wide uppercase">
                                        Name
                                    </p>
                                    <p className="text-foreground font-medium">
                                        {playbook.name}
                                    </p>
                                </div>

                                <div>
                                    <p className="text-foreground/60 text-xs tracking-wide uppercase">
                                        Schedule
                                    </p>
                                    <div className="text-foreground flex items-center gap-2">
                                        <Clock className="h-4 w-4" />
                                        <span>{playbook.schedule.displayText}</span>
                                    </div>
                                </div>

                                {playbook.description && (
                                    <div>
                                        <p className="text-foreground/60 text-xs tracking-wide uppercase">
                                            What it does
                                        </p>
                                        <p className="text-foreground/80 text-sm">
                                            {playbook.description}
                                        </p>
                                    </div>
                                )}

                                {playbook.requiredIntegrations.length > 0 && (
                                    <div>
                                        <p className="text-foreground/60 text-xs tracking-wide uppercase">
                                            Requires
                                        </p>
                                        <div className="mt-1 flex flex-wrap gap-1">
                                            {playbook.requiredIntegrations.map(
                                                (int) => (
                                                    <span
                                                        key={int}
                                                        className="bg-foreground/10 text-foreground/80 rounded-lg px-2 py-1 text-xs"
                                                    >
                                                        {int}
                                                    </span>
                                                )
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <button
                                onClick={handleHire}
                                disabled={isHiring}
                                className="bg-primary text-primary-foreground hover:bg-primary/90 mt-6 flex w-full items-center justify-center gap-2 rounded-xl py-3 font-medium transition-colors disabled:opacity-50"
                            >
                                {isHiring ? (
                                    <>
                                        <Sparkles className="h-4 w-4 animate-pulse" />
                                        Setting up...
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 className="h-4 w-4" />
                                        Hire This Team Member
                                    </>
                                )}
                            </button>
                        </motion.div>
                    )}
                </div>
            </div>
        </StandardPageLayout>
    );
}
