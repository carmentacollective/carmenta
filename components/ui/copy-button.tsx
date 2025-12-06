"use client";

import { useState, useEffect, useRef, useCallback, type ComponentProps } from "react";
import { Copy, Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
    copyToClipboard,
    copyMarkdownWithFormats,
    copyMarkdown,
    copyPlainText,
} from "@/lib/copy-utils";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type CopyMode = "rich" | "markdown" | "plain";

/**
 * Cycling delight messages shown after successful copy.
 * These messages cycle sequentially through the list, persisted across sessions.
 * Curated to match Carmenta's voice: playful, warm, occasionally cheeky.
 */
const DELIGHT_MESSAGES = [
    "Copy that!",
    "Yoinked!",
    "Snatched!",
    "At least give me credit",
    "I'll be in the footnotes, right?",
    "Citation needed 😏",
    "I made that, you know",
    "Fine, take it",
    "Carry it well",
    "Go make something beautiful",
    "Take good care of it",
    "That one was good, wasn't it?",
    "I don't share with just anyone",
    "Artisanally duplicated",
] as const;

const STORAGE_KEY = "carmenta-copy-delight-index";

/**
 * Custom hook to manage cycling delight messages for copy actions.
 * Persists the current index to localStorage so users experience the full cycle
 * across sessions rather than always seeing the first few messages.
 */
function useCopyDelight() {
    const indexRef = useRef<number>(0);
    const initializedRef = useRef(false);
    const [currentMessage, setCurrentMessage] = useState<string | null>(null);

    // Initialize index from localStorage on mount (client-side only)
    useEffect(() => {
        if (!initializedRef.current) {
            initializedRef.current = true;
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                indexRef.current = parseInt(stored, 10) % DELIGHT_MESSAGES.length;
            }
        }
    }, []);

    const triggerDelight = useCallback(() => {
        const currentIndex = indexRef.current;

        // Set the message
        setCurrentMessage(DELIGHT_MESSAGES[currentIndex]);

        // Advance to next message for next time
        const nextIndex = (currentIndex + 1) % DELIGHT_MESSAGES.length;
        indexRef.current = nextIndex;

        // Persist to localStorage
        try {
            localStorage.setItem(STORAGE_KEY, String(nextIndex));
        } catch {
            // localStorage might be unavailable, ignore
        }
    }, []);

    const clearMessage = useCallback(() => {
        setCurrentMessage(null);
    }, []);

    return { currentMessage, triggerDelight, clearMessage };
}

interface CopyButtonProps extends Omit<ComponentProps<"button">, "onClick"> {
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
    ...props
}: CopyButtonProps) {
    const [copied, setCopied] = useState<CopyMode | false>(false);
    const [isOpen, setIsOpen] = useState(false);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const { currentMessage, triggerDelight, clearMessage } = useCopyDelight();

    // Cleanup timeout on unmount to prevent memory leaks
    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    const handleCopy = async (mode: CopyMode) => {
        let success = false;

        // Use appropriate copy function based on mode
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
            setCopied(mode);
            setIsOpen(false);
            triggerDelight();
            onCopySuccess?.();

            // Clear any existing timeout
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }

            // Set new timeout and store reference
            timeoutRef.current = setTimeout(() => {
                setCopied(false);
                clearMessage();
                timeoutRef.current = null;
            }, 2000);
        }
    };

    // Simple button mode (for code blocks)
    const handleSimpleCopy = async () => {
        const success = await copyToClipboard(text);

        if (success) {
            setCopied("plain");
            triggerDelight();
            onCopySuccess?.();

            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }

            timeoutRef.current = setTimeout(() => {
                setCopied(false);
                clearMessage();
                timeoutRef.current = null;
            }, 2000);
        }
    };

    const iconSize = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
    const chevronSize = size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3";

    const buttonClasses = cn(
        "inline-flex shrink-0 items-center justify-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        variant === "ghost" && "hover:bg-foreground/10 active:bg-foreground/15",
        variant === "glass" &&
            "bg-white/50 backdrop-blur-sm hover:bg-white/70 active:bg-white/80",
        size === "sm" && "h-7",
        size === "md" && "h-8",
        copied && "text-green-600",
        !copied && "text-foreground/60 hover:text-foreground/90"
    );

    // Simple button mode (no menu)
    if (!showMenu) {
        return (
            <div className="relative inline-flex items-center">
                <button
                    onClick={handleSimpleCopy}
                    aria-label={copied ? "Copied!" : ariaLabel}
                    className={cn(buttonClasses, "w-7 rounded-md sm:w-8", className)}
                    {...props}
                >
                    {copied ? (
                        <Check className={cn(iconSize, "animate-in fade-in zoom-in")} />
                    ) : (
                        <Copy className={iconSize} />
                    )}
                </button>
                {currentMessage && (
                    <span
                        className="pointer-events-none absolute left-full ml-2 whitespace-nowrap text-xs text-green-600 animate-in fade-in slide-in-from-left-1"
                        aria-live="polite"
                    >
                        {currentMessage}
                    </span>
                )}
            </div>
        );
    }

    // Button with dropdown menu
    return (
        <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
            <div className="relative flex items-center gap-0.5">
                {/* Main copy button */}
                <button
                    onClick={() => handleCopy("rich")}
                    aria-label={copied ? "Copied!" : ariaLabel}
                    className={cn(buttonClasses, "rounded-l-md px-2", className)}
                    {...props}
                >
                    {copied ? (
                        <Check className={cn(iconSize, "animate-in fade-in zoom-in")} />
                    ) : (
                        <Copy className={iconSize} />
                    )}
                </button>

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

                {/* Delight message */}
                {currentMessage && (
                    <span
                        className="pointer-events-none absolute left-full ml-2 whitespace-nowrap text-xs text-green-600 animate-in fade-in slide-in-from-left-1"
                        aria-live="polite"
                    >
                        {currentMessage}
                    </span>
                )}
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
