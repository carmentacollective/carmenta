"use client";

/**
 * Google Picker Component
 *
 * Opens Google's native file picker UI to let users select files from their Drive.
 * Only files the user explicitly picks become accessible to the app (drive.file scope).
 *
 * This component automatically opens the picker when mounted with valid credentials,
 * making it suitable for use in tool result renderers.
 */

import { useEffect, useRef } from "react";
import { CircleNotch, GoogleDriveLogo, Warning } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import { logger } from "@/lib/client-logger";
import {
    useGooglePicker,
    type GooglePickerFile,
    type GooglePickerOptions,
} from "@/lib/hooks/use-google-picker";

export interface GooglePickerProps {
    /** OAuth access token for the user's Google account */
    accessToken: string;
    /** Callback when user selects file(s) */
    onSelect: (files: GooglePickerFile[]) => void;
    /** Callback when user cancels the picker */
    onCancel: () => void;
    /** Optional MIME types to filter */
    mimeTypes?: string[];
    /** Optional title for the picker dialog */
    title?: string;
    /** Whether to allow multiple file selection */
    multiSelect?: boolean;
    /** Optional className for the container */
    className?: string;
}

/**
 * Maps file type strings to MIME types
 */
const FILE_TYPE_TO_MIME: Record<string, string> = {
    spreadsheet: "application/vnd.google-apps.spreadsheet",
    document: "application/vnd.google-apps.document",
    presentation: "application/vnd.google-apps.presentation",
};

/**
 * Converts file type array to MIME types
 */
export function fileTypesToMimeTypes(
    fileTypes?: Array<"spreadsheet" | "document" | "presentation">
): string[] {
    if (!fileTypes || fileTypes.length === 0) {
        return Object.values(FILE_TYPE_TO_MIME);
    }
    return fileTypes.map((type) => FILE_TYPE_TO_MIME[type]).filter(Boolean);
}

/**
 * Google Picker Component
 *
 * Renders a button/status that opens the Google Picker when ready.
 * Automatically attempts to open the picker when mounted with valid credentials.
 */
export function GooglePicker({
    accessToken,
    onSelect,
    onCancel,
    mimeTypes,
    title = "Select a file",
    multiSelect = false,
    className,
}: GooglePickerProps) {
    const { isReady, isLoading, openPicker, error } = useGooglePicker();
    const hasOpened = useRef(false);
    const isOpeningRef = useRef(false);

    // Auto-open picker when ready
    useEffect(() => {
        if (!isReady || !accessToken || hasOpened.current || isOpeningRef.current) {
            return;
        }

        const open = async () => {
            isOpeningRef.current = true;
            hasOpened.current = true;

            const options: GooglePickerOptions = {
                accessToken,
                mimeTypes,
                multiSelect,
                title,
            };

            logger.info({ title, mimeTypes }, "Opening Google Picker");
            const files = await openPicker(options);

            if (files && files.length > 0) {
                onSelect(files);
            } else {
                onCancel();
            }

            isOpeningRef.current = false;
        };

        open();
    }, [
        isReady,
        accessToken,
        mimeTypes,
        multiSelect,
        title,
        openPicker,
        onSelect,
        onCancel,
    ]);

    // Render loading state while waiting for picker API
    if (!isReady || isLoading) {
        return (
            <div
                className={cn(
                    "flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-3",
                    className
                )}
            >
                <CircleNotch className="h-4 w-4 animate-spin text-blue-400" />
                <span className="text-sm text-white/70">Opening file picker...</span>
            </div>
        );
    }

    // Render error state
    if (error) {
        return (
            <div
                className={cn(
                    "flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3",
                    className
                )}
            >
                <Warning className="h-4 w-4 text-red-400" />
                <span className="text-sm text-red-300">{error}</span>
            </div>
        );
    }

    // Render ready state with manual open button (fallback if auto-open fails)
    return (
        <button
            onClick={async () => {
                const options: GooglePickerOptions = {
                    accessToken,
                    mimeTypes,
                    multiSelect,
                    title,
                };

                const files = await openPicker(options);

                if (files && files.length > 0) {
                    onSelect(files);
                } else {
                    onCancel();
                }
            }}
            className={cn(
                "flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-3 transition-colors hover:bg-white/10",
                className
            )}
        >
            <GoogleDriveLogo className="h-5 w-5 text-blue-400" weight="duotone" />
            <span className="text-sm text-white/90">Open Google Drive</span>
        </button>
    );
}
