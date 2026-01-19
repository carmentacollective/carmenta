"use client";

/**
 * Knowledge Detail View
 *
 * Document viewer/editor for the knowledge base.
 * Supports two modes:
 * - "view" (default): Read-only view with optional correction submission (for import)
 * - "edit": Full editing with save states (for KB page)
 */

import { useState, useCallback, useEffect } from "react";
import { X, Check } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import { cn } from "@/lib/utils";
import { formatNodeName, type KBDocumentData } from "./tree-utils";
import { toast } from "sonner";

export interface KnowledgeDetailProps {
    document: KBDocumentData | null;
    onClose?: () => void;
    /** Mode: "view" for read-only with corrections, "edit" for full editing */
    mode?: "view" | "edit";
    /** Callback when a correction is submitted (view mode only) */
    onCorrection?: (path: string, correction: string) => Promise<KBDocumentData | null>;
    className?: string;
}

export function KnowledgeDetail({
    document,
    onClose,
    mode = "view",
    onCorrection,
    className,
}: KnowledgeDetailProps) {
    const [correction, setCorrection] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Reset correction state when document changes
    useEffect(() => {
        setCorrection("");
    }, [document?.path]);

    const handleSubmitCorrection = useCallback(async () => {
        if (!document || !correction.trim() || !onCorrection || isSubmitting) return;

        setIsSubmitting(true);
        try {
            const updated = await onCorrection(document.path, correction.trim());
            if (updated) {
                setCorrection("");
                toast.success("Correction applied");
                onClose?.();
            } else {
                toast.error("Failed to apply correction");
            }
        } catch {
            toast.error("Something went wrong");
        } finally {
            setIsSubmitting(false);
        }
    }, [document, correction, onCorrection, isSubmitting, onClose]);

    if (!document) {
        return (
            <div
                className={cn(
                    "text-muted-foreground flex h-full items-center justify-center text-center text-sm",
                    className
                )}
            >
                <p>
                    Choose a document from the tree
                    {mode === "view" && (
                        <>
                            <br />
                            to review or suggest changes
                        </>
                    )}
                </p>
            </div>
        );
    }

    const displayName = formatNodeName(document.name);

    return (
        <div className={cn("flex h-full flex-col space-y-4", className)}>
            {/* Header */}
            <div className="flex items-start justify-between gap-2">
                <div>
                    <h3 className="font-medium">{displayName}</h3>
                    {document.description && (
                        <p className="text-muted-foreground text-sm">
                            {document.description}
                        </p>
                    )}
                </div>
                {onClose && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={onClose}
                    >
                        <X className="h-4 w-4" />
                    </Button>
                )}
            </div>

            {/* Content */}
            <div className="bg-muted/50 prose prose-sm dark:prose-invert min-h-0 max-w-none flex-1 overflow-y-auto rounded-md p-3 text-sm">
                <MarkdownRenderer content={document.content} />
            </div>

            {/* Correction form (view mode only) */}
            {mode === "view" && onCorrection && (
                <div className="space-y-2">
                    <label className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                        Correction
                    </label>
                    <textarea
                        value={correction}
                        onChange={(e) => setCorrection(e.target.value)}
                        placeholder="What should be different? (e.g., 'I actually have 26 years experience, not 25')"
                        className="border-input bg-background min-h-[80px] w-full rounded-md border px-3 py-2 text-sm"
                    />
                    <div className="flex gap-2">
                        <Button
                            size="sm"
                            onClick={handleSubmitCorrection}
                            disabled={!correction.trim() || isSubmitting}
                        >
                            {isSubmitting ? (
                                <LoadingSpinner size={14} className="mr-2" />
                            ) : (
                                <Check className="mr-2 h-4 w-4" />
                            )}
                            Apply Correction
                        </Button>
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                                setCorrection("");
                                onClose?.();
                            }}
                        >
                            Cancel
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
