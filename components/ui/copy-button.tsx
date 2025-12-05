"use client";

import { useState, useEffect, useRef, type ComponentProps } from "react";
import { Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { copyToClipboard } from "@/lib/copy-utils";

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
}

/**
 * Copy button with visual feedback and accessibility
 *
 * Shows a copy icon that changes to a check mark for 2 seconds after successful copy.
 * Uses client-logger for error tracking. Properly cleans up timers to prevent memory leaks.
 */
export function CopyButton({
    text,
    ariaLabel = "Copy to clipboard",
    onCopySuccess,
    variant = "ghost",
    size = "md",
    className,
    ...props
}: CopyButtonProps) {
    const [copied, setCopied] = useState(false);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Cleanup timeout on unmount to prevent memory leaks
    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    const handleCopy = async () => {
        const success = await copyToClipboard(text);

        if (success) {
            setCopied(true);
            onCopySuccess?.();

            // Clear any existing timeout
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }

            // Set new timeout and store reference
            timeoutRef.current = setTimeout(() => {
                setCopied(false);
                timeoutRef.current = null;
            }, 2000);
        }
    };

    const iconSize = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";

    return (
        <button
            onClick={handleCopy}
            aria-label={copied ? "Copied!" : ariaLabel}
            className={cn(
                "inline-flex shrink-0 items-center justify-center rounded-md transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                variant === "ghost" && "hover:bg-foreground/10 active:bg-foreground/15",
                variant === "glass" &&
                    "bg-white/50 backdrop-blur-sm hover:bg-white/70 active:bg-white/80",
                size === "sm" && "h-7 w-7",
                size === "md" && "h-8 w-8",
                copied && "text-green-600",
                !copied && "text-foreground/60 hover:text-foreground/90",
                className
            )}
            {...props}
        >
            {copied ? (
                <Check className={cn(iconSize, "animate-in fade-in zoom-in")} />
            ) : (
                <Copy className={iconSize} />
            )}
        </button>
    );
}
