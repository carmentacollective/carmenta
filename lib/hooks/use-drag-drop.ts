"use client";

/**
 * useDragDrop - Native HTML5 drag-and-drop for file uploads
 *
 * Handles viewport-level drag events with ref counting to prevent
 * flicker when dragging over nested child elements.
 *
 * Usage:
 *   const { isDragging, handlers } = useDragDrop({ onDrop: addFiles });
 *   <div {...handlers}>...</div>
 *
 * Why ref counting: dragenter/dragleave fire for every child element.
 * Without tracking, moving from parent to child triggers leave+enter,
 * causing visible flicker. Counter stays > 0 while within the drop zone.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { logger } from "@/lib/client-logger";
import { validateFile } from "@/lib/storage/file-validator";

interface UseDragDropOptions {
    /** Called when files are dropped - receives valid files only */
    onDrop: (files: File[]) => void;
    /** Called when validation fails - receives error message */
    onError?: (error: string) => void;
    /** Whether drag-drop is disabled (e.g., during upload) */
    disabled?: boolean;
}

interface UseDragDropReturn {
    /** Whether files are currently being dragged over the viewport */
    isDragging: boolean;
}

/**
 * Check if a DataTransfer contains files (not other drag types like text)
 */
function hasFiles(dataTransfer: DataTransfer | null): boolean {
    if (!dataTransfer?.types) return false;
    return dataTransfer.types.includes("Files");
}

/**
 * Extract files from a DataTransfer, filtering out directories
 */
function extractFiles(dataTransfer: DataTransfer): File[] {
    const files: File[] = [];
    const items = dataTransfer.items;

    if (items) {
        // Modern API: use DataTransferItemList
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.kind === "file") {
                const file = item.getAsFile();
                if (file) files.push(file);
            }
        }
    } else if (dataTransfer.files) {
        // Fallback: use FileList
        files.push(...Array.from(dataTransfer.files));
    }

    return files;
}

export function useDragDrop({
    onDrop,
    onError,
    disabled = false,
}: UseDragDropOptions): UseDragDropReturn {
    const [isDraggingInternal, setIsDragging] = useState(false);
    const dragCounterRef = useRef(0);
    // Tracks whether state needs reset after disabled toggle (avoids setState in effect)
    const needsResetRef = useRef(false);

    // Derive the exposed state: always false when disabled
    const isDragging = disabled ? false : isDraggingInternal;

    const handleDragEnter = useCallback(
        (e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation();

            if (disabled) return;
            if (!hasFiles(e.dataTransfer)) return;

            // Reset stale state if flagged by effect (called from handler, not effect body)
            if (needsResetRef.current) {
                needsResetRef.current = false;
                setIsDragging(false);
            }

            dragCounterRef.current++;
            if (dragCounterRef.current === 1) {
                setIsDragging(true);
            }
        },
        [disabled]
    );

    const handleDragLeave = useCallback(
        (e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation();

            if (disabled) return;

            // Only decrement if we have a positive count (prevents negative from non-file drags)
            if (dragCounterRef.current > 0) {
                dragCounterRef.current--;
            }
            if (dragCounterRef.current === 0) {
                setIsDragging(false);
            }
        },
        [disabled]
    );

    const handleDragOver = useCallback(
        (e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation();

            // Set dropEffect to show the correct cursor
            if (e.dataTransfer && !disabled) {
                e.dataTransfer.dropEffect = "copy";
            }
        },
        [disabled]
    );

    const handleDrop = useCallback(
        (e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation();

            // Reset drag state
            dragCounterRef.current = 0;
            setIsDragging(false);

            if (disabled) return;
            if (!e.dataTransfer) return;

            const files = extractFiles(e.dataTransfer);
            if (files.length === 0) return;

            logger.info({ fileCount: files.length }, "Files dropped");

            // Validate files before passing to handler
            const validFiles: File[] = [];
            const errors: string[] = [];

            for (const file of files) {
                const result = validateFile(file);
                if (result.valid) {
                    validFiles.push(file);
                } else if (result.error) {
                    errors.push(result.error);
                }
            }

            // Report first error if any
            if (errors.length > 0 && onError) {
                onError(errors[0]);
            }

            // Process valid files
            if (validFiles.length > 0) {
                onDrop(validFiles);
            }
        },
        [disabled, onDrop, onError]
    );

    // Attach listeners to window for viewport-wide detection
    useEffect(() => {
        // Reset counter and flag that state needs clearing on next interaction
        // (We can't call setState directly in effect - ESLint rule)
        // The flag is consumed by handleDragEnter to reset stale isDragging state
        dragCounterRef.current = 0;
        needsResetRef.current = true;

        if (disabled) return;

        window.addEventListener("dragenter", handleDragEnter);
        window.addEventListener("dragleave", handleDragLeave);
        window.addEventListener("dragover", handleDragOver);
        window.addEventListener("drop", handleDrop);

        return () => {
            window.removeEventListener("dragenter", handleDragEnter);
            window.removeEventListener("dragleave", handleDragLeave);
            window.removeEventListener("dragover", handleDragOver);
            window.removeEventListener("drop", handleDrop);
        };
    }, [disabled, handleDragEnter, handleDragLeave, handleDragOver, handleDrop]);

    return { isDragging };
}
