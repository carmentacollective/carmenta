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
import { SUPPORTED_FORMATS } from "@/lib/storage/types";

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
    const accept = Object.values(SUPPORTED_FORMATS).flat().join(",");

    return (
        <>
            <button
                type="button"
                onClick={handleClick}
                className="flex h-8 w-8 items-center justify-center rounded-full text-foreground/60 transition-colors hover:bg-foreground/5 hover:text-foreground/80"
                aria-label="Attach file"
            >
                <Paperclip className="h-5 w-5" />
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
