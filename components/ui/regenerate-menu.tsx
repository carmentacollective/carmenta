"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { RotateCw, ChevronDown, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { MODELS, type ModelId } from "@/lib/model-config";
import { ProviderIcon } from "@/components/icons/provider-icons";

interface RegenerateMenuProps {
    /**
     * Callback when regenerate is requested with default model
     */
    onRegenerate: () => Promise<void>;

    /**
     * Callback when regenerate is requested with a specific model
     */
    onRegenerateWithModel?: (modelId: string) => Promise<void>;

    /**
     * Currently active model ID (shown with checkmark)
     */
    currentModelId?: string;

    /**
     * Whether regeneration is currently in progress
     */
    isRegenerating?: boolean;

    /**
     * Disable the button (e.g., during streaming)
     */
    disabled?: boolean;

    /**
     * Optional CSS class name
     */
    className?: string;
}

/**
 * Regenerate menu with model selection dropdown.
 *
 * - Click the main button to regenerate with current model (fast path)
 * - Click the chevron to select a different model for regeneration
 *
 * Follows open-webui's pattern of preserving model choice after regeneration.
 */
export function RegenerateMenu({
    onRegenerate,
    onRegenerateWithModel,
    currentModelId,
    isRegenerating = false,
    disabled = false,
    className,
}: RegenerateMenuProps) {
    const [isAnimating, setIsAnimating] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Close menu when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    const handleRegenerate = useCallback(async () => {
        if (disabled || isRegenerating || isAnimating) return;

        setIsAnimating(true);
        setIsOpen(false);
        try {
            await onRegenerate();
        } finally {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
            timeoutRef.current = setTimeout(() => {
                setIsAnimating(false);
                timeoutRef.current = null;
            }, 500);
        }
    }, [onRegenerate, disabled, isRegenerating, isAnimating]);

    const handleRegenerateWithModel = useCallback(
        async (modelId: string) => {
            if (disabled || isRegenerating || isAnimating) return;
            if (!onRegenerateWithModel) return;

            setIsAnimating(true);
            setIsOpen(false);
            try {
                await onRegenerateWithModel(modelId);
            } finally {
                if (timeoutRef.current) {
                    clearTimeout(timeoutRef.current);
                }
                timeoutRef.current = setTimeout(() => {
                    setIsAnimating(false);
                    timeoutRef.current = null;
                }, 500);
            }
        },
        [onRegenerateWithModel, disabled, isRegenerating, isAnimating]
    );

    const isSpinning = isAnimating || isRegenerating;
    const showDropdown = onRegenerateWithModel !== undefined;

    return (
        <div ref={menuRef} className={cn("relative inline-flex", className)}>
            {/* Main regenerate button */}
            <motion.button
                onClick={handleRegenerate}
                aria-label="Regenerate this response"
                disabled={disabled || isRegenerating || isAnimating}
                className={cn(
                    "inline-flex h-7 shrink-0 items-center justify-center transition-all",
                    showDropdown ? "rounded-l-md pl-2 pr-1" : "rounded-md px-2",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    "hover:bg-foreground/10 active:bg-foreground/15",
                    disabled || isRegenerating || isAnimating
                        ? "cursor-not-allowed opacity-40"
                        : "text-foreground/60 hover:text-foreground/90"
                )}
                whileTap={
                    !disabled && !isRegenerating && !isAnimating
                        ? { scale: 0.95 }
                        : undefined
                }
            >
                <AnimatePresence mode="wait">
                    {isSpinning ? (
                        <motion.div
                            key="spinning"
                            initial={{ opacity: 0, rotate: 0 }}
                            animate={{ opacity: 1, rotate: 360 }}
                            exit={{ opacity: 0 }}
                            transition={{
                                rotate: { duration: 0.5, ease: "easeInOut" },
                                opacity: { duration: 0.15 },
                            }}
                        >
                            <RotateCw className="h-3.5 w-3.5" />
                        </motion.div>
                    ) : (
                        <motion.div
                            key="static"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.15 }}
                        >
                            <RotateCw className="h-3.5 w-3.5" />
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.button>

            {/* Dropdown chevron - only show if model selection is enabled */}
            {showDropdown && (
                <>
                    <button
                        onClick={() => setIsOpen(!isOpen)}
                        disabled={disabled || isRegenerating}
                        aria-label="Choose model for regeneration"
                        aria-expanded={isOpen}
                        className={cn(
                            "inline-flex h-7 w-5 items-center justify-center rounded-r-md border-l border-foreground/10 transition-all",
                            "hover:bg-foreground/10 active:bg-foreground/15",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                            disabled || isRegenerating
                                ? "cursor-not-allowed opacity-40"
                                : "text-foreground/60 hover:text-foreground/90"
                        )}
                    >
                        <ChevronDown
                            className={cn(
                                "h-3 w-3 transition-transform",
                                isOpen && "rotate-180"
                            )}
                        />
                    </button>

                    {/* Dropdown menu */}
                    <AnimatePresence>
                        {isOpen && (
                            <motion.div
                                initial={{ opacity: 0, y: -4, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -4, scale: 0.95 }}
                                transition={{ duration: 0.15 }}
                                className="absolute bottom-full left-0 z-dropdown mb-1 min-w-[200px] overflow-hidden rounded-lg border border-foreground/10 bg-background/95 shadow-lg backdrop-blur-xl"
                            >
                                <div className="px-2 py-1.5 text-[10px] font-medium uppercase tracking-wider text-foreground/40">
                                    Regenerate with
                                </div>
                                <div className="max-h-[280px] overflow-y-auto py-1">
                                    {MODELS.map((model) => {
                                        const isActive = model.id === currentModelId;
                                        return (
                                            <button
                                                key={model.id}
                                                onClick={() =>
                                                    handleRegenerateWithModel(model.id)
                                                }
                                                className={cn(
                                                    "flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm transition-colors",
                                                    "hover:bg-foreground/5",
                                                    isActive &&
                                                        "bg-primary/5 text-primary"
                                                )}
                                            >
                                                <div className="flex h-5 w-5 items-center justify-center rounded bg-foreground/5">
                                                    <ProviderIcon
                                                        provider={model.provider}
                                                        className="h-3 w-3"
                                                    />
                                                </div>
                                                <span className="flex-1 truncate">
                                                    {model.displayName}
                                                </span>
                                                {isActive && (
                                                    <Check className="h-3.5 w-3.5 text-primary" />
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </>
            )}
        </div>
    );
}
