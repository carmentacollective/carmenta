"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Copy, Check, ChevronDown } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { transitions } from "@/lib/motion/presets";
import {
    copyToClipboard,
    copyMarkdownWithFormats,
    copyMarkdown,
    copyPlainText,
} from "@/lib/copy-utils";
import { useHapticFeedback } from "@/lib/hooks/use-haptic-feedback";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type CopyMode = "rich" | "markdown" | "plain";

/**
 * Special delight messages shown occasionally after copy.
 * Variable reinforcement: boring most of the time, delightful sometimes.
 * Curated to match Carmenta's voice: playful, warm, occasionally cheeky.
 */
const DELIGHT_MESSAGES = [
    "Copy that!",
    "Yoinked! 😏",
    "I'll be in the footnotes, right? 📝",
    "Citation needed 😏",
    "I made that, you know 😌",
    "Carry it well",
    "Go make something beautiful",
    "Take good care of it",
    "That one was good, wasn't it?",
    "I don't share with just anyone 💜",
    "Artisanally duplicated",
    "We created something good",
    "Shared with care",
] as const;

/** Probability of showing a delight message vs plain "Copied" (1 in N) */
const DELIGHT_CHANCE = 5; // ~20% chance of delight

/** Duration to show success feedback before resetting */
const FEEDBACK_DURATION_MS = 2000;

/**
 * Custom hook for copy feedback with variable reinforcement.
 * Shows plain "Copied" most of the time, occasionally surprises with delight.
 */
function useCopyDelight() {
    const [currentMessage, setCurrentMessage] = useState<string | null>(null);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    const triggerDelight = useCallback(() => {
        // Variable reinforcement: usually boring, sometimes delightful
        const isSpecial = Math.random() < 1 / DELIGHT_CHANCE;

        if (isSpecial) {
            const randomIndex = Math.floor(Math.random() * DELIGHT_MESSAGES.length);
            setCurrentMessage(DELIGHT_MESSAGES[randomIndex]);
        } else {
            setCurrentMessage("Copied");
        }
    }, []);

    const clearMessage = useCallback(() => {
        setCurrentMessage(null);
    }, []);

    const scheduleClear = useCallback(() => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
        timeoutRef.current = setTimeout(() => {
            clearMessage();
            timeoutRef.current = null;
        }, FEEDBACK_DURATION_MS);
    }, [clearMessage]);

    return { currentMessage, triggerDelight, clearMessage, scheduleClear };
}

interface CopyButtonProps {
    /**
     * Text content to copy to clipboard
     */
    text: string;

    /**
     * Accessible label for screen readers
     */
    ariaLabel?: string;

    /**
     * Optional callback after successful copy
     */
    onCopySuccess?: () => void;

    /**
     * Visual variant
     */
    variant?: "ghost" | "glass";

    /**
     * Size variant
     */
    size?: "sm" | "md";

    /**
     * Show dropdown menu for multiple copy options
     * - false: Simple button (for code blocks)
     * - true: Button with dropdown menu (for messages)
     */
    showMenu?: boolean;

    /**
     * Optional CSS class name
     */
    className?: string;
}

/**
 * Copy button with visual feedback, delight messages, and accessibility.
 *
 * Shows a copy icon that changes to a check mark with a cycling delight message
 * for 2 seconds after successful copy. Messages cycle sequentially through
 * a curated list, persisted across sessions.
 *
 * Two variants:
 * - Simple button (showMenu=false): One-click copy for code blocks
 * - Button with menu (showMenu=true): Default rich text + dropdown for markdown/plain text
 *
 * Uses client-logger for error tracking. Properly cleans up timers to prevent memory leaks.
 */
export function CopyButton({
    text,
    ariaLabel = "Copy to clipboard",
    onCopySuccess,
    variant = "ghost",
    size = "md",
    showMenu = false,
    className,
}: CopyButtonProps) {
    const [copied, setCopied] = useState<CopyMode | false>(false);
    const [isOpen, setIsOpen] = useState(false);
    const copiedTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const { currentMessage, triggerDelight, scheduleClear } = useCopyDelight();
    const { trigger: triggerHaptic } = useHapticFeedback();

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (copiedTimeoutRef.current) {
                clearTimeout(copiedTimeoutRef.current);
            }
        };
    }, []);

    // Shared success handler for both copy modes
    const handleSuccess = useCallback(
        (mode: CopyMode) => {
            setCopied(mode);
            setIsOpen(false);
            triggerDelight();
            triggerHaptic();
            scheduleClear();
            onCopySuccess?.();

            if (copiedTimeoutRef.current) {
                clearTimeout(copiedTimeoutRef.current);
            }
            copiedTimeoutRef.current = setTimeout(() => {
                setCopied(false);
                copiedTimeoutRef.current = null;
            }, FEEDBACK_DURATION_MS);
        },
        [triggerDelight, triggerHaptic, scheduleClear, onCopySuccess]
    );

    const handleCopy = async (mode: CopyMode) => {
        let success = false;

        switch (mode) {
            case "rich":
                success = await copyMarkdownWithFormats(text);
                break;
            case "markdown":
                success = await copyMarkdown(text);
                break;
            case "plain":
                success = await copyPlainText(text);
                break;
        }

        if (success) {
            handleSuccess(mode);
        }
    };

    const handleSimpleCopy = async () => {
        const success = await copyToClipboard(text);
        if (success) {
            handleSuccess("plain");
        }
    };

    const iconSize = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
    const chevronSize = size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3";

    const buttonClasses = cn(
        "inline-flex shrink-0 items-center justify-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        variant === "ghost" && "hover:bg-foreground/10 active:bg-foreground/15",
        variant === "glass" &&
            "bg-white/50 backdrop-blur-sm hover:bg-white/70 active:bg-white/80",
        size === "sm" && "h-11",
        size === "md" && "h-11",
        copied && "text-green-600",
        !copied && "text-foreground/60 hover:text-foreground/90"
    );

    // Simple button mode (no menu)
    if (!showMenu) {
        return (
            <motion.button
                onClick={handleSimpleCopy}
                aria-label={copied ? "Copied!" : ariaLabel}
                layout
                className={cn(
                    buttonClasses,
                    "gap-1.5 overflow-hidden rounded-md",
                    !copied && "w-11",
                    className
                )}
            >
                {copied ? (
                    <>
                        <Check className={cn(iconSize, "flex-shrink-0")} />
                        <motion.span
                            initial={{ opacity: 0, width: 0 }}
                            animate={{ opacity: 1, width: "auto" }}
                            exit={{ opacity: 0, width: 0 }}
                            transition={transitions.quick}
                            className="whitespace-nowrap text-xs font-medium"
                            aria-live="polite"
                        >
                            {currentMessage || "Copied"}
                        </motion.span>
                    </>
                ) : (
                    <Copy className={iconSize} />
                )}
            </motion.button>
        );
    }

    // Button with dropdown menu
    return (
        <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
            <div className="flex items-center gap-0.5">
                {/* Main copy button */}
                <motion.button
                    onClick={() => handleCopy("rich")}
                    aria-label={copied ? "Copied!" : ariaLabel}
                    layout
                    className={cn(
                        buttonClasses,
                        "gap-1.5 overflow-hidden rounded-l-md px-2",
                        className
                    )}
                >
                    {copied ? (
                        <>
                            <Check className={cn(iconSize, "flex-shrink-0")} />
                            <motion.span
                                initial={{ opacity: 0, width: 0 }}
                                animate={{ opacity: 1, width: "auto" }}
                                exit={{ opacity: 0, width: 0 }}
                                transition={transitions.quick}
                                className="whitespace-nowrap text-xs font-medium"
                                aria-live="polite"
                            >
                                {currentMessage || "Copied"}
                            </motion.span>
                        </>
                    ) : (
                        <Copy className={iconSize} />
                    )}
                </motion.button>

                {/* Dropdown trigger */}
                <DropdownMenuTrigger asChild>
                    <button
                        aria-label="Copy options"
                        className={cn(
                            buttonClasses,
                            "rounded-r-md border-l border-white/20 px-1"
                        )}
                    >
                        <ChevronDown className={chevronSize} />
                    </button>
                </DropdownMenuTrigger>
            </div>

            <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => handleCopy("markdown")}>
                    Copy as Markdown
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleCopy("plain")}>
                    Copy as Plain Text
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
