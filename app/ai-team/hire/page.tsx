"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
    SparkleIcon,
    ArrowLeftIcon,
    ClockIcon,
    CheckCircleIcon,
} from "@phosphor-icons/react";
import * as Sentry from "@sentry/nextjs";

import { StandardPageLayout } from "@/components/layouts/standard-page-layout";
import {
    UserBubble,
    AssistantBubble,
    ThinkingBubble,
    SimpleComposer,
} from "@/components/chat";
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
 * Hiring wizard page - chat-style interface
 *
 * Uses shared chat components:
 * - UserBubble, AssistantBubble, ThinkingBubble for messages
 * - SimpleComposer for input
 */
export default function HirePage() {
    const router = useRouter();
    const [messages, setMessages] = useState<Message[]>([
        {
            id: "welcome",
            role: "assistant",
            content: `Hi there! We're here to help you hire a new AI team member.

Tell us what you'd like automated. For example:
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
                content:
                    data.content ??
                    "We're having trouble responding. Please try again.",
            };

            setMessages((prev) => [...prev, assistantMessage]);

            // API returns playbook when ready (via generateObject extraction)
            if (data.playbook) {
                setPlaybook(data.playbook);
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
                        "We're having trouble processing that. Could you try rephrasing?",
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
                    scheduleDisplayText: playbook.schedule.displayText,
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
                            <ArrowLeftIcon className="h-5 w-5" />
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
                                            <UserBubble content={message.content} />
                                        ) : (
                                            <AssistantBubble
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
                            <SimpleComposer
                                value={input}
                                onChange={setInput}
                                onSubmit={handleSubmit}
                                isLoading={isLoading}
                                placeholder="Describe what you need..."
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
                                <CheckCircleIcon className="text-primary h-5 w-5" />
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
                                        <ClockIcon className="h-4 w-4" />
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
                                        <SparkleIcon className="h-4 w-4 animate-pulse" />
                                        Setting up...
                                    </>
                                ) : (
                                    <>
                                        <CheckCircleIcon className="h-4 w-4" />
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
