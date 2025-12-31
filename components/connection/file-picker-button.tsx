"use client";

/**
 * File Picker Button
 *
 * Opens native file picker with accept filter for supported formats.
 * Triggers upload on selection.
 */

import { useRef } from "react";
import { Paperclip } from "lucide-react";
import { useFileAttachments } from "./file-attachment-context";
import { ALLOWED_MIME_TYPES } from "@/lib/storage/file-config";
import { cn } from "@/lib/utils";

interface FilePickerButtonProps {
    /** Additional CSS classes for mobile sizing overrides */
    className?: string;
}

export function FilePickerButton({ className }: FilePickerButtonProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const { addFiles } = useFileAttachments();

    const handleClick = () => {
        inputRef.current?.click();
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            addFiles(e.target.files);
            // Reset input so same file can be selected again
            e.target.value = "";
        }
    };

    // Build accept string from supported formats
    const accept = Object.values(ALLOWED_MIME_TYPES).flat().join(",");

    return (
        <>
            <button
                type="button"
                onClick={handleClick}
                className={cn("btn-icon-glass group", className)}
                data-tooltip-id="tip"
                data-tooltip-content="Add files · up to 10MB"
                aria-label="Attach file"
            >
                <Paperclip className="text-foreground/50 group-hover:text-foreground/80 h-5 w-5 transition-colors sm:h-6 sm:w-6" />
            </button>
            <input
                ref={inputRef}
                type="file"
                multiple
                accept={accept}
                onChange={handleChange}
                className="hidden"
                aria-hidden="true"
            />
        </>
    );
}
