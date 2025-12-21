"use client";

/**
 * Onboarding Chat
 *
 * Renders the onboarding experience within the chat interface.
 * Shows Carmenta's welcome message and handles user responses
 * for each onboarding step.
 */

import { useState, useCallback, useRef, useEffect, type FormEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, SkipForward, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { useOnboarding } from "@/lib/onboarding/context";
import { ThemeSelector } from "@/components/tool-ui/theme-selector";
import { Button } from "@/components/ui/button";
import { CarmentaAvatar } from "@/components/ui/carmenta-avatar";

/**
 * Carmenta's message bubble
 */
function CarmentaMessage({ children }: { children: React.ReactNode }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="flex gap-3"
        >
            <CarmentaAvatar size="sm" state="breathing" className="shrink-0" />
            <div className="flex-1 space-y-4">
                <div className="prose prose-sm max-w-none text-foreground/90">
                    {children}
                </div>
            </div>
        </motion.div>
    );
}

/**
 * User's response bubble
 */
function UserMessage({ content }: { content: string }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex justify-end"
        >
            <div className="max-w-[80%] rounded-2xl bg-primary/10 px-4 py-3 text-foreground">
                {content}
            </div>
        </motion.div>
    );
}

/**
 * Text input form for free-text onboarding responses
 */
function OnboardingInput({
    onSubmit,
    isPending,
    placeholder,
    canSkip,
    onSkip,
}: {
    onSubmit: (value: string) => void;
    isPending: boolean;
    placeholder?: string;
    canSkip: boolean;
    onSkip: () => void;
}) {
    const [value, setValue] = useState("");
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Auto-focus on mount
    useEffect(() => {
        textareaRef.current?.focus();
    }, []);

    // Auto-resize textarea
    useEffect(() => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = "auto";
            textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
        }
    }, [value]);

    const handleSubmit = useCallback(
        (e: FormEvent) => {
            e.preventDefault();
            if (!value.trim() || isPending) return;
            onSubmit(value.trim());
        },
        [value, isPending, onSubmit]
    );

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (value.trim() && !isPending) {
                    onSubmit(value.trim());
                }
            }
        },
        [value, isPending, onSubmit]
    );

    return (
        <motion.form
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.3 }}
            onSubmit={handleSubmit}
            className="space-y-3"
        >
            <div className="relative">
                <textarea
                    ref={textareaRef}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder ?? "Share your thoughts..."}
                    aria-label="Your response"
                    disabled={isPending}
                    rows={3}
                    className={cn(
                        "w-full resize-none rounded-xl border bg-card/60 px-4 py-3 pr-12",
                        "text-foreground placeholder:text-muted-foreground",
                        "focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20",
                        "disabled:opacity-50",
                        "backdrop-blur-sm transition-all"
                    )}
                />
                <button
                    type="submit"
                    disabled={!value.trim() || isPending}
                    className={cn(
                        "absolute bottom-3 right-3",
                        "flex h-8 w-8 items-center justify-center rounded-lg",
                        "bg-primary text-primary-foreground",
                        "transition-all hover:bg-primary/90",
                        "disabled:cursor-not-allowed disabled:opacity-50"
                    )}
                >
                    {isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <Send className="h-4 w-4" />
                    )}
                </button>
            </div>

            {canSkip && (
                <div className="flex justify-end">
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={onSkip}
                        disabled={isPending}
                        className="text-muted-foreground"
                    >
                        <SkipForward className="mr-1.5 h-4 w-4" />
                        Skip for now
                    </Button>
                </div>
            )}
        </motion.form>
    );
}

/**
 * Progress indicator for onboarding steps
 */
function OnboardingProgress({ progress }: { progress: number }) {
    return (
        <div className="flex items-center gap-3">
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-foreground/10">
                <motion.div
                    className="h-full bg-primary"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                />
            </div>
            <span className="text-xs text-muted-foreground">{progress}%</span>
        </div>
    );
}

/**
 * Main onboarding chat component
 */
export function OnboardingChat() {
    const { status, currentItem, completeItem, skipItem, selectTheme, isPending } =
        useOnboarding();

    const [submittedResponse, setSubmittedResponse] = useState<string | null>(null);

    // Handle text response submission
    const handleTextSubmit = useCallback(
        async (value: string) => {
            setSubmittedResponse(value);
            await completeItem(value);
            setSubmittedResponse(null);
        },
        [completeItem]
    );

    // Handle theme selection
    const handleThemeConfirm = useCallback(
        async (theme: string) => {
            await selectTheme(theme);
        },
        [selectTheme]
    );

    // Handle skip
    const handleSkip = useCallback(async () => {
        await skipItem();
    }, [skipItem]);

    if (!currentItem) {
        // Onboarding complete - this component shouldn't render
        return null;
    }

    const canSkip = !currentItem.required;

    return (
        <div className="flex h-full flex-col">
            {/* Progress bar at top */}
            <div className="border-b border-border/30 bg-background/50 px-6 py-4 backdrop-blur-sm">
                <OnboardingProgress progress={status.progress} />
            </div>

            {/* Chat content */}
            <div className="flex-1 overflow-y-auto px-6 py-8">
                <div className="mx-auto max-w-2xl space-y-6">
                    <AnimatePresence mode="wait">
                        {/* Carmenta's message */}
                        <CarmentaMessage key={`prompt-${currentItem.key}`}>
                            <p>{currentItem.prompt}</p>
                        </CarmentaMessage>

                        {/* Show user's response if submitted */}
                        {submittedResponse && (
                            <UserMessage
                                key={`response-${currentItem.key}`}
                                content={submittedResponse}
                            />
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* Input area */}
            <div className="border-t border-border/30 bg-background/50 px-6 py-4 backdrop-blur-sm">
                <div className="mx-auto max-w-2xl">
                    {currentItem.inputType === "theme_selection" ? (
                        <ThemeSelector
                            id={`onboarding-theme-${currentItem.key}`}
                            onConfirm={handleThemeConfirm}
                        />
                    ) : (
                        <OnboardingInput
                            onSubmit={handleTextSubmit}
                            isPending={isPending}
                            canSkip={canSkip}
                            onSkip={handleSkip}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
