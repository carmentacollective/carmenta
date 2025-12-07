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
import { cn } from "@/lib/utils";

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
                className={cn(
                    "flex h-12 w-12 shrink-0 items-center justify-center rounded-full",
                    "shadow-xl ring-1 backdrop-blur-xl transition-all",
                    "hover:scale-105 hover:shadow-2xl hover:ring-[3px] hover:ring-primary/40",
                    "active:translate-y-0.5 active:shadow-sm",
                    "focus:scale-105 focus:shadow-2xl focus:outline-none focus:ring-[3px] focus:ring-primary/40",
                    "bg-white/50 text-foreground/60 opacity-70 ring-white/40 hover:bg-white/80 hover:opacity-100"
                )}
                aria-label="Attach file"
            >
                <Paperclip className="h-5 w-5 sm:h-6 sm:w-6" />
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
