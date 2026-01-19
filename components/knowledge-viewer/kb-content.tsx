"use client";

/**
 * Knowledge Base Content Pane
 *
 * Beautiful inline editing experience for knowledge base documents.
 * Features seamless editing, character limits with visual feedback,
 * and clear save confirmation.
 */

import { useState, useCallback, useTransition, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    FileText,
    User,
    Sparkle,
    ChatCircle,
    WarningCircle,
    Check,
    ArrowCounterClockwise,
    CircleNotch,
    Copy,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import * as Sentry from "@sentry/nextjs";
import { cn } from "@/lib/utils";
import { updateKBDocument, type KBDocument } from "@/lib/kb/actions";
import { HUMAN_CHAR_LIMIT } from "@/lib/kb/text-utils";
import { logger } from "@/lib/client-logger";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import { analytics } from "@/lib/analytics/events";

// Map paths to icons
const PATH_ICONS: Record<string, typeof FileText> = {
    "profile.character": Sparkle,
    "profile.identity": User,
    "profile.preferences": ChatCircle,
};

// UI thresholds for character limit feedback
const CHAR_SHOW_THRESHOLD = 0.75; // Show counter at 75% of human limit (~7,200)
const CHAR_WARNING_THRESHOLD = 0.9; // Amber warning at 90% (~8,640)

type SaveState = "idle" | "unsaved" | "saving" | "saved" | "error";

export interface KBContentProps {
    document: KBDocument | null;
    onUpdate: (path: string, updated: KBDocument) => void;
    dimmed?: boolean;
}

export function KBContent({
    document: kbDocument,
    onUpdate,
    dimmed = false,
}: KBContentProps) {
    const [editContent, setEditContent] = useState("");
    const [originalContent, setOriginalContent] = useState("");
    const [isPending, startTransition] = useTransition();
    const [saveState, setSaveState] = useState<SaveState>("idle");
    const [error, setError] = useState<string | null>(null);
    const [isFocused, setIsFocused] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const savedTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const prevPathRef = useRef<string | undefined>(undefined);

    // Calculate character stats
    const charCount = editContent.length;
    const charPercentage = (charCount / HUMAN_CHAR_LIMIT) * 100;
    const isOverLimit = charCount > HUMAN_CHAR_LIMIT;
    const isNearLimit = charPercentage >= CHAR_WARNING_THRESHOLD * 100;
    // Only show counter when actively editing - don't scold users for LLM content
    const shouldShowCounter = isFocused && charPercentage >= CHAR_SHOW_THRESHOLD * 100;
    const hasChanges = editContent !== originalContent;

    // Derive display save state from hasChanges and saveState
    // Priority: saving (in flight) > error > unsaved (user made new changes) > saved > idle
    const displaySaveState: SaveState =
        saveState === "saving"
            ? "saving"
            : saveState === "error"
              ? "error"
              : hasChanges
                ? "unsaved"
                : saveState === "saved"
                  ? "saved"
                  : "idle";

    // Sync state with document prop changes (external system sync pattern)
    const currentPath = kbDocument?.path;
    if (currentPath !== prevPathRef.current) {
        prevPathRef.current = currentPath;
        const content = kbDocument?.content ?? "";
        // Batch state updates for new document
        setEditContent(content);
        setOriginalContent(content);
        setSaveState("idle");
        setError(null);
    }

    // Handle side effects that need cleanup
    useEffect(() => {
        // Cleanup saved timeout on unmount
        return () => {
            if (savedTimeoutRef.current) {
                clearTimeout(savedTimeoutRef.current);
            }
        };
    }, []);

    // Focus textarea when document loads (side effect)
    useEffect(() => {
        if (kbDocument?.editable && textareaRef.current) {
            textareaRef.current.focus();
        }
    }, [kbDocument?.path, kbDocument?.editable]);

    const handleContentChange = useCallback(
        (e: React.ChangeEvent<HTMLTextAreaElement>) => {
            const newValue = e.target.value;

            // Block input that would exceed limit (but allow deletions)
            if (
                newValue.length > HUMAN_CHAR_LIMIT &&
                newValue.length > editContent.length
            ) {
                return;
            }

            setEditContent(newValue);
            setError(null);
        },
        [editContent.length]
    );

    // Handle paste to prevent exceeding limit
    const handlePaste = useCallback(
        (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
            const pasteText = e.clipboardData.getData("text");
            const textarea = textareaRef.current;
            if (!textarea) return;

            const currentLength = editContent.length;
            const selectionStart = textarea.selectionStart ?? 0;
            const selectionEnd = textarea.selectionEnd ?? 0;
            const selectionLength = selectionEnd - selectionStart;
            const resultLength = currentLength - selectionLength + pasteText.length;

            if (resultLength > HUMAN_CHAR_LIMIT) {
                e.preventDefault();
                const availableChars =
                    HUMAN_CHAR_LIMIT - currentLength + selectionLength;

                // Allow paste if we have selected text (even at limit)
                // The selection will be replaced, freeing up space
                if (availableChars > 0) {
                    const truncatedPaste = pasteText.slice(0, availableChars);
                    const before = editContent.slice(0, selectionStart);
                    const after = editContent.slice(selectionEnd);
                    const newContent = before + truncatedPaste + after;

                    setEditContent(newContent);

                    // Show warning if we had to truncate
                    if (truncatedPaste.length < pasteText.length) {
                        const truncatedChars = pasteText.length - truncatedPaste.length;
                        setError(
                            `Pasted content truncated by ${truncatedChars.toLocaleString()} characters to fit ${HUMAN_CHAR_LIMIT.toLocaleString()} limit`
                        );
                    }

                    // Position cursor after pasted content
                    setTimeout(() => {
                        const newPosition = selectionStart + truncatedPaste.length;
                        textarea.setSelectionRange(newPosition, newPosition);
                    }, 0);
                } else {
                    // No selection and already at/over limit
                    setError(
                        `Cannot paste: already at ${HUMAN_CHAR_LIMIT.toLocaleString()} character limit`
                    );
                }
            }
        },
        [editContent]
    );

    const handleRevert = useCallback(() => {
        setEditContent(originalContent);
        setSaveState("idle");
        setError(null);
    }, [originalContent]);

    const handleSave = useCallback(() => {
        if (!kbDocument || !hasChanges || isOverLimit) return;

        const savedPath = kbDocument.path;
        const section = savedPath.split(".")[0];
        setError(null);
        setSaveState("saving");
        const startTime = Date.now();

        // Clear any existing timeout to prevent race conditions
        if (savedTimeoutRef.current) {
            clearTimeout(savedTimeoutRef.current);
            savedTimeoutRef.current = null;
        }

        startTransition(async () => {
            try {
                const updated = await updateKBDocument(savedPath, editContent);
                onUpdate(savedPath, updated);

                analytics.kb.documentSaved({
                    path: savedPath,
                    documentName: kbDocument.name,
                    section,
                    contentLength: editContent.length,
                    durationMs: Date.now() - startTime,
                });

                // Only update state if we're still on the same document
                // (user may have switched documents during save)
                if (kbDocument?.path === savedPath) {
                    setOriginalContent(editContent);
                    setSaveState("saved");

                    // Clear saved state after 2 seconds
                    savedTimeoutRef.current = setTimeout(() => {
                        setSaveState("idle");
                    }, 2000);
                }
            } catch (err) {
                const message =
                    err instanceof Error ? err.message : "Failed to save changes";
                setError(message);
                setSaveState("error");

                logger.error(
                    { error: err, path: savedPath },
                    "Failed to save KB document"
                );
                Sentry.captureException(err, {
                    tags: { component: "kb-content", action: "save" },
                    extra: { path: savedPath },
                });
            }
        });
    }, [kbDocument, editContent, hasChanges, isOverLimit, onUpdate]);

    // Keyboard shortcut for save
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "s") {
                e.preventDefault();
                // Only save if component is active, has changes, and not already saving
                if (!dimmed && hasChanges && !isOverLimit && !isPending) {
                    handleSave();
                }
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [handleSave, hasChanges, isOverLimit, dimmed, isPending]);

    if (!kbDocument) {
        return (
            <main
                className={cn(
                    "glass-card flex h-full flex-1 items-center justify-center rounded-xl transition-opacity duration-200",
                    dimmed && "opacity-30"
                )}
            >
                <p className="text-foreground/40">Select a document to begin</p>
            </main>
        );
    }

    const Icon = PATH_ICONS[kbDocument.path] ?? FileText;
    const isEditable = kbDocument.editable;

    return (
        <main
            className={cn(
                "glass-card relative flex h-full flex-1 flex-col overflow-hidden rounded-xl transition-opacity duration-200",
                dimmed && "opacity-30"
            )}
        >
            {/* Header */}
            <header
                role="banner"
                aria-label={`Editing ${kbDocument.name}`}
                className="border-foreground/5 flex items-center gap-3 border-b px-6 py-4"
            >
                <Icon className="text-foreground/50 h-5 w-5" aria-hidden="true" />
                <div className="flex flex-col">
                    <h2 className="text-foreground text-lg font-medium">
                        {kbDocument.name}
                    </h2>
                    {kbDocument.description && (
                        <p className="text-foreground/50 line-clamp-2 text-sm">
                            {kbDocument.description}
                        </p>
                    )}
                </div>
            </header>

            {/* Error Banner */}
            <AnimatePresence>
                {error && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                    >
                        <div
                            role="alert"
                            aria-live="assertive"
                            id="error-message"
                            className="flex items-center justify-between gap-2 border-b border-red-500/20 bg-red-500/10 px-6 py-3 text-sm text-red-600 dark:text-red-400"
                        >
                            <div className="flex items-center gap-2">
                                <WarningCircle
                                    className="h-4 w-4 shrink-0"
                                    aria-hidden="true"
                                />
                                <span>{error}</span>
                            </div>
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(editContent);
                                    toast.success("Copied to clipboard");
                                }}
                                className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-red-700 transition-colors hover:bg-red-500/20 dark:text-red-300"
                            >
                                <Copy className="h-3.5 w-3.5" />
                                Copy content
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Content Area - scrollable within fixed height */}
            <div className="relative min-h-0 flex-1 overflow-hidden p-4">
                {isEditable ? (
                    <textarea
                        ref={textareaRef}
                        value={editContent}
                        onChange={handleContentChange}
                        onPaste={handlePaste}
                        onFocus={() => setIsFocused(true)}
                        onBlur={() => setIsFocused(false)}
                        placeholder="Start writing"
                        aria-label={`Edit ${kbDocument.name}`}
                        aria-describedby="character-count error-message"
                        aria-invalid={isOverLimit}
                        className={cn(
                            "h-full w-full resize-none overflow-y-auto rounded-xl px-5 py-4",
                            "text-foreground/80 font-sans text-[15px] leading-[1.7]",
                            "placeholder:text-foreground/30 placeholder:italic",
                            "focus:outline-none",
                            "transition-all duration-200",
                            // Sunken glass effect matching chat composer
                            "bg-foreground/[0.03] shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)]",
                            "border",
                            isFocused ? "border-foreground/35" : "border-foreground/8"
                        )}
                        style={{
                            letterSpacing: "0.01em",
                        }}
                    />
                ) : (
                    <div className="h-full overflow-y-auto px-5 py-4">
                        <MarkdownRenderer
                            content={kbDocument.content}
                            className="text-foreground/80 text-[15px] leading-[1.7]"
                        />
                    </div>
                )}
            </div>

            {/* Footer: Character Count (when approaching limit) + Save Actions */}
            {isEditable && (
                <footer className="border-foreground/5 flex items-center justify-between border-t px-6 py-3">
                    {/* Character Counter - only shown when approaching or exceeding limit */}
                    <AnimatePresence>
                        {shouldShowCounter ? (
                            <motion.div
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -10 }}
                                transition={{ duration: 0.2 }}
                                className="flex items-center gap-3"
                            >
                                {/* Progress Bar */}
                                <div className="bg-foreground/10 h-1.5 w-32 overflow-hidden rounded-full sm:h-2 sm:w-40">
                                    <motion.div
                                        className={cn(
                                            "h-full rounded-full transition-colors duration-300",
                                            isOverLimit
                                                ? "bg-red-500"
                                                : isNearLimit
                                                  ? "bg-amber-500"
                                                  : "bg-primary/60"
                                        )}
                                        initial={false}
                                        animate={{
                                            width: `${Math.min(charPercentage, 100)}%`,
                                        }}
                                        transition={{ duration: 0.2, ease: "easeOut" }}
                                    />
                                </div>

                                {/* Character Count Text */}
                                <span
                                    id="character-count"
                                    role="status"
                                    aria-live="polite"
                                    className={cn(
                                        "text-xs tabular-nums transition-colors duration-200",
                                        isOverLimit
                                            ? "font-medium text-red-500"
                                            : isNearLimit
                                              ? "text-amber-600 dark:text-amber-400"
                                              : "text-foreground/40"
                                    )}
                                >
                                    {charCount.toLocaleString()} /{" "}
                                    {HUMAN_CHAR_LIMIT.toLocaleString()}
                                    {isNearLimit && ` (${Math.round(charPercentage)}%)`}
                                </span>
                            </motion.div>
                        ) : (
                            <div />
                        )}
                    </AnimatePresence>

                    {/* Save Actions - Always visible with intelligent states */}
                    <div className="flex items-center gap-2">
                        {/* Reset Button - only active when there are unsaved changes */}
                        <button
                            onClick={handleRevert}
                            disabled={!hasChanges || isPending}
                            className={cn(
                                "flex min-h-[44px] items-center gap-1.5 rounded-lg px-3 py-2",
                                "text-sm transition-colors duration-150",
                                "focus-visible:ring-primary/40 focus-visible:ring-2 focus-visible:outline-none",
                                hasChanges && !isPending
                                    ? "text-foreground/60 hover:bg-foreground/5 hover:text-foreground/80"
                                    : "text-foreground/30 cursor-not-allowed"
                            )}
                        >
                            <ArrowCounterClockwise
                                className="h-3.5 w-3.5"
                                aria-hidden="true"
                            />
                            <span>Reset</span>
                        </button>

                        {/* Save Button - intelligent states */}
                        <button
                            onClick={handleSave}
                            disabled={
                                (displaySaveState !== "unsaved" &&
                                    displaySaveState !== "error") ||
                                isOverLimit
                            }
                            className={cn(
                                "flex min-h-[44px] items-center gap-1.5 rounded-lg px-4 py-2",
                                "text-sm font-medium transition-all duration-150",
                                "focus-visible:ring-primary/40 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
                                // State-based styling
                                (displaySaveState === "unsaved" ||
                                    displaySaveState === "error") &&
                                    !isOverLimit
                                    ? displaySaveState === "error"
                                        ? "bg-red-500 text-white hover:bg-red-600"
                                        : "bg-primary text-primary-foreground hover:bg-primary/90"
                                    : "bg-primary/50 text-primary-foreground/70 cursor-not-allowed",
                                isOverLimit && "bg-foreground/10 text-foreground/40"
                            )}
                        >
                            {/* Icon only for loading/saved states */}
                            {displaySaveState === "saving" && (
                                <CircleNotch
                                    className="h-4 w-4 animate-spin"
                                    aria-hidden="true"
                                />
                            )}
                            {displaySaveState === "saved" && (
                                <Check className="h-4 w-4" aria-hidden="true" />
                            )}

                            {/* Text based on state - with ARIA live for screen readers */}
                            <span role="status" aria-live="polite">
                                {displaySaveState === "saving"
                                    ? "Saving..."
                                    : displaySaveState === "unsaved"
                                      ? "Save"
                                      : displaySaveState === "saved"
                                        ? "Saved"
                                        : displaySaveState === "error"
                                          ? "Retry"
                                          : "Save"}
                            </span>
                        </button>
                    </div>
                </footer>
            )}
        </main>
    );
}
