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
    Save,
    FileText,
    User,
    Sparkles,
    MessageSquare,
    AlertCircle,
    Check,
    RotateCcw,
    Loader2,
} from "lucide-react";
import * as Sentry from "@sentry/nextjs";
import { cn } from "@/lib/utils";
import { updateKBDocument, type KBDocument } from "@/lib/kb/actions";
import { logger } from "@/lib/client-logger";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";

// Map paths to icons
const PATH_ICONS: Record<string, typeof FileText> = {
    "profile.character": Sparkles,
    "profile.identity": User,
    "profile.preferences": MessageSquare,
};

// Character limits (~2,000 tokens for LLM context efficiency)
const CHAR_LIMIT = 8000;
const CHAR_SHOW_THRESHOLD = 0.6; // Show counter when content reaches 60% of limit
const CHAR_WARNING_THRESHOLD = 0.8; // Show warning color at 80%

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
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const savedTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const prevPathRef = useRef<string | undefined>(undefined);

    // Calculate character stats
    const charCount = editContent.length;
    const charPercentage = (charCount / CHAR_LIMIT) * 100;
    const isOverLimit = charCount > CHAR_LIMIT;
    const isNearLimit = charPercentage >= CHAR_WARNING_THRESHOLD * 100;
    const shouldShowCounter = charPercentage >= CHAR_SHOW_THRESHOLD * 100;
    const hasChanges = editContent !== originalContent;

    // Derive display save state from hasChanges and saveState
    // Priority: saving (in flight) > unsaved (user made new changes) > saved > idle
    const displaySaveState: SaveState =
        saveState === "saving"
            ? "saving"
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
            if (newValue.length > CHAR_LIMIT && newValue.length > editContent.length) {
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

            if (resultLength > CHAR_LIMIT) {
                e.preventDefault();
                const availableChars = CHAR_LIMIT - currentLength + selectionLength;

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
                            `Pasted content truncated by ${truncatedChars.toLocaleString()} characters to fit ${CHAR_LIMIT.toLocaleString()} limit`
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
                        `Cannot paste: already at ${CHAR_LIMIT.toLocaleString()} character limit`
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
        setError(null);
        setSaveState("saving");

        // Clear any existing timeout to prevent race conditions
        if (savedTimeoutRef.current) {
            clearTimeout(savedTimeoutRef.current);
            savedTimeoutRef.current = null;
        }

        startTransition(async () => {
            try {
                const updated = await updateKBDocument(savedPath, editContent);
                onUpdate(savedPath, updated);

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
                    "glass-card flex h-full max-h-[calc(100vh-16rem)] flex-1 items-center justify-center rounded-xl transition-opacity duration-200",
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
                "glass-card relative flex h-full max-h-[calc(100vh-16rem)] flex-1 flex-col overflow-hidden rounded-xl transition-opacity duration-200",
                dimmed && "opacity-30"
            )}
        >
            {/* Header */}
            <header
                role="banner"
                aria-label={`Editing ${kbDocument.name}`}
                className="flex items-center gap-3 border-b border-foreground/5 px-6 py-4"
            >
                <Icon className="h-5 w-5 text-foreground/50" aria-hidden="true" />
                <div className="flex flex-col">
                    <h2 className="text-lg font-medium text-foreground">
                        {kbDocument.name}
                    </h2>
                    {kbDocument.description && (
                        <p className="line-clamp-2 text-sm text-foreground/50">
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
                            className="flex items-center gap-2 border-b border-red-500/20 bg-red-500/10 px-6 py-3 text-sm text-red-600 dark:text-red-400"
                        >
                            <AlertCircle
                                className="h-4 w-4 shrink-0"
                                aria-hidden="true"
                            />
                            <span>{error}</span>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Content Area - scrollable within fixed height */}
            <div className="relative min-h-0 flex-1 overflow-hidden">
                {isEditable ? (
                    <textarea
                        ref={textareaRef}
                        value={editContent}
                        onChange={handleContentChange}
                        onPaste={handlePaste}
                        placeholder="Start writing"
                        aria-label={`Edit ${kbDocument.name}`}
                        aria-describedby="character-count error-message"
                        aria-invalid={isOverLimit}
                        className={cn(
                            "h-full w-full resize-none overflow-y-auto bg-transparent px-6 py-5",
                            "font-sans text-[15px] leading-[1.7] text-foreground/80",
                            "placeholder:italic placeholder:text-foreground/30",
                            "focus:outline-none",
                            "transition-colors duration-200",
                            // Stronger focus indication
                            "focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40",
                            "focus:bg-foreground/[0.04]"
                        )}
                        style={{
                            letterSpacing: "0.01em",
                        }}
                    />
                ) : (
                    <div className="h-full overflow-y-auto px-6 py-5">
                        <MarkdownRenderer
                            content={kbDocument.content}
                            className="text-[15px] leading-[1.7] text-foreground/80"
                        />
                    </div>
                )}
            </div>

            {/* Footer: Character Count (when approaching limit) + Save Actions */}
            {isEditable && (
                <footer className="flex items-center justify-between border-t border-foreground/5 px-6 py-3">
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
                                <div className="h-1.5 w-32 overflow-hidden rounded-full bg-foreground/10 sm:h-2 sm:w-40">
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
                                    {CHAR_LIMIT.toLocaleString()}
                                    {isNearLimit && ` (${Math.round(charPercentage)}%)`}
                                </span>
                            </motion.div>
                        ) : (
                            <div />
                        )}
                    </AnimatePresence>

                    {/* Save Actions */}
                    <AnimatePresence mode="wait">
                        {displaySaveState === "saved" ? (
                            <motion.div
                                key="saved"
                                role="status"
                                aria-live="polite"
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -8 }}
                                transition={{ duration: 0.3, ease: "easeOut" }}
                                className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400"
                            >
                                <Check className="h-4 w-4" aria-hidden="true" />
                                <span>Saved</span>
                            </motion.div>
                        ) : displaySaveState === "saving" ? (
                            <motion.div
                                key="saving"
                                role="status"
                                aria-live="polite"
                                aria-busy="true"
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -8 }}
                                transition={{ duration: 0.3, ease: "easeOut" }}
                                className="flex min-h-[44px] items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground opacity-50"
                            >
                                <Loader2
                                    className="h-3.5 w-3.5 animate-spin"
                                    aria-hidden="true"
                                />
                                <span>Saving...</span>
                            </motion.div>
                        ) : displaySaveState === "unsaved" ? (
                            <motion.div
                                key="actions"
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -8 }}
                                transition={{ duration: 0.3, ease: "easeOut" }}
                                className="flex items-center gap-2"
                            >
                                {/* Revert Button */}
                                <button
                                    onClick={handleRevert}
                                    disabled={isPending}
                                    className={cn(
                                        "flex min-h-[44px] items-center gap-1.5 rounded-lg px-3 py-2",
                                        "text-sm text-foreground/60",
                                        "transition-colors duration-150",
                                        "hover:bg-foreground/5 hover:text-foreground/80",
                                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                                        "disabled:opacity-50"
                                    )}
                                >
                                    <RotateCcw
                                        className="h-3.5 w-3.5"
                                        aria-hidden="true"
                                    />
                                    <span>Revert</span>
                                </button>

                                {/* Save Button */}
                                <button
                                    onClick={handleSave}
                                    disabled={isOverLimit}
                                    className={cn(
                                        "flex min-h-[44px] items-center gap-1.5 rounded-lg px-4 py-2",
                                        "text-sm font-medium",
                                        "transition-all duration-150",
                                        isOverLimit
                                            ? "cursor-not-allowed bg-foreground/10 text-foreground/40"
                                            : "bg-primary text-primary-foreground hover:bg-primary/90",
                                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2",
                                        "disabled:opacity-50"
                                    )}
                                >
                                    <Save className="h-3.5 w-3.5" aria-hidden="true" />
                                    <span>Save</span>
                                    <kbd className="ml-1.5 hidden rounded bg-primary-foreground/20 px-1.5 py-0.5 text-[10px] font-normal sm:inline-block">
                                        ⌘S
                                    </kbd>
                                </button>
                            </motion.div>
                        ) : null}
                    </AnimatePresence>
                </footer>
            )}
        </main>
    );
}
