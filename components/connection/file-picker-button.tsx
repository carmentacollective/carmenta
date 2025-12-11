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

export function FilePickerButton() {
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
                className="btn-icon-glass group"
                aria-label="Attach file"
            >
                <Paperclip className="h-5 w-5 text-foreground/50 transition-colors group-hover:text-foreground/80 sm:h-6 sm:w-6" />
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
