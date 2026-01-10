"use client";

/**
 * Google Workspace Files Tool UI
 *
 * Handles tool results for google-workspace-files integration:
 * - open_google_picker: Opens the Google Picker for file selection
 * - Other actions: Sheet/Doc creation confirmations
 */

import { useState, useEffect, useCallback } from "react";
import {
    ArrowSquareOut,
    ArrowsClockwise,
    CircleNotch,
    File,
    GoogleDriveLogo,
    Table,
    TextT,
    Presentation,
    Warning,
    PlugsConnected,
} from "@phosphor-icons/react";
import Link from "next/link";

import type { ToolStatus } from "@/lib/tools/tool-config";
import { useIntegrationToken } from "@/lib/hooks/use-integration-token";
import { useChatContext } from "@/components/connection/connect-runtime-provider";
import {
    GooglePicker,
    fileTypesToMimeTypes,
} from "@/components/integrations/google-picker";
import type { GooglePickerFile } from "@/lib/hooks/use-google-picker";
import { ToolRenderer } from "../shared";
import { logger } from "@/lib/client-logger";

interface GoogleWorkspaceFilesToolResultProps {
    toolCallId: string;
    status: ToolStatus;
    action: string;
    input: Record<string, unknown>;
    output?: Record<string, unknown>;
    error?: string;
}

/**
 * Get the appropriate icon for a Google Workspace file type
 */
function getFileIcon(mimeType: string) {
    if (mimeType.includes("spreadsheet")) {
        return <Table className="h-4 w-4 text-green-400" />;
    }
    if (mimeType.includes("document")) {
        return <TextT className="h-4 w-4 text-blue-400" />;
    }
    if (mimeType.includes("presentation")) {
        return <Presentation className="h-4 w-4 text-yellow-400" />;
    }
    return <File className="h-4 w-4 text-gray-400" />;
}

/**
 * Format MIME type to human-readable name
 */
function formatFileType(mimeType: string): string {
    if (mimeType.includes("spreadsheet")) return "Google Sheet";
    if (mimeType.includes("document")) return "Google Doc";
    if (mimeType.includes("presentation")) return "Google Slides";
    return "File";
}

/**
 * Picker UI - Handles the open_google_picker action
 */
function PickerAction({
    toolCallId,
    fileTypes,
}: {
    toolCallId: string;
    fileTypes?: Array<"spreadsheet" | "document" | "presentation">;
}) {
    const { append } = useChatContext();
    const { fetchToken, isLoading: tokenLoading } = useIntegrationToken();

    const [accessToken, setAccessToken] = useState<string | null>(null);
    const [pickerState, setPickerState] = useState<
        "loading" | "ready" | "selected" | "cancelled" | "error"
    >("loading");
    const [selectedFile, setSelectedFile] = useState<GooglePickerFile | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [needsReconnect, setNeedsReconnect] = useState(false);

    // Fetch token on mount
    useEffect(() => {
        let cancelled = false;

        const loadToken = async () => {
            const result = await fetchToken("google-workspace-files");
            if (cancelled) return;

            if (result) {
                setAccessToken(result.accessToken);
                setPickerState("ready");
            } else {
                setPickerState("error");
                setNeedsReconnect(true);
                setError("Couldn't connect to your Google account");
            }
        };

        loadToken();

        return () => {
            cancelled = true;
        };
    }, [fetchToken]);

    const handleSelect = useCallback(
        (files: GooglePickerFile[]) => {
            const file = files[0];
            if (!file) return;

            setSelectedFile(file);
            setPickerState("selected");

            logger.info(
                { toolCallId, fileId: file.id, fileName: file.name },
                "Google file selected"
            );

            // Send file info back to conversation
            // Include ID for downstream tool calls (read_sheet, etc.) but keep it unobtrusive
            append({
                role: "user",
                content: `I selected "${file.name}" (${formatFileType(file.mimeType)}) - ID: ${file.id}`,
            });
        },
        [append, toolCallId]
    );

    const handleCancel = useCallback(() => {
        setPickerState("cancelled");
        logger.info({ toolCallId }, "Google Picker cancelled");

        // Inform the conversation that user cancelled
        append({
            role: "user",
            content: "I cancelled the file picker.",
        });
    }, [append, toolCallId]);

    // Retry handler for cancelled state (must be declared before early returns)
    const handleRetry = useCallback(() => {
        setPickerState("ready");
    }, []);

    // Loading state
    if (pickerState === "loading" || tokenLoading) {
        return (
            <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-3">
                <CircleNotch className="h-4 w-4 animate-spin text-blue-400" />
                <span className="text-sm text-white/70">
                    Getting your files ready...
                </span>
            </div>
        );
    }

    // Error state with reconnect link when needed
    // (Currently only token fetch failures set error state)
    if (pickerState === "error") {
        return (
            <div className="flex items-center gap-3 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
                <Warning className="h-4 w-4 shrink-0 text-red-400" />
                <div className="min-w-0 flex-1">
                    <p className="text-sm text-red-300">
                        {error || "Something went sideways with the file picker"}
                    </p>
                    {needsReconnect && (
                        <Link
                            href="/integrations"
                            className="mt-1 inline-flex items-center gap-1 text-xs text-red-300/70 underline underline-offset-2 transition-colors hover:text-red-200"
                        >
                            Reconnect Google account
                        </Link>
                    )}
                </div>
            </div>
        );
    }

    // Selected state - show confirmation
    if (pickerState === "selected" && selectedFile) {
        return (
            <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-4 py-3">
                {getFileIcon(selectedFile.mimeType)}
                <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white">
                        {selectedFile.name}
                    </p>
                    <p className="text-xs text-white/50">
                        {formatFileType(selectedFile.mimeType)} selected
                    </p>
                </div>
                <a
                    href={selectedFile.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-white/50 transition-colors hover:text-white"
                    aria-label={`Open ${selectedFile.name} in Google Drive`}
                >
                    <ArrowSquareOut className="h-4 w-4" />
                </a>
            </div>
        );
    }

    // Cancelled state with retry option
    if (pickerState === "cancelled") {
        return (
            <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-4 py-3">
                <GoogleDriveLogo className="h-4 w-4 text-white/50" />
                <span className="flex-1 text-sm text-white/50">
                    File selection cancelled
                </span>
                <button
                    onClick={handleRetry}
                    className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs text-white/70 transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
                >
                    <ArrowsClockwise className="h-3.5 w-3.5" />
                    Try again
                </button>
            </div>
        );
    }

    // Ready state - render the picker
    if (accessToken) {
        return (
            <GooglePicker
                accessToken={accessToken}
                onSelect={handleSelect}
                onCancel={handleCancel}
                mimeTypes={fileTypesToMimeTypes(fileTypes)}
                title="Select a file"
            />
        );
    }

    return null;
}

/**
 * File creation confirmation
 */
function FileCreatedConfirmation({
    type,
    title,
    url,
}: {
    type: "sheet" | "doc" | "slides";
    title: string;
    url: string;
}) {
    const icons = {
        sheet: <Table className="h-5 w-5 text-green-400" />,
        doc: <TextT className="h-5 w-5 text-blue-400" />,
        slides: <Presentation className="h-5 w-5 text-yellow-400" />,
    };

    const typeNames = {
        sheet: "Google Sheet",
        doc: "Google Doc",
        slides: "Google Slides",
    };

    // Explicit mapping for action text (avoids brittle string split)
    const openInLabels = {
        sheet: "Open in Sheets",
        doc: "Open in Docs",
        slides: "Open in Slides",
    };

    return (
        <div className="rounded-md border border-white/10 bg-white/5 p-4">
            <div className="flex items-center gap-2 text-sm">
                {icons[type]}
                <span className="font-medium text-white">
                    Your {typeNames[type]} is ready
                </span>
            </div>
            <div className="mt-3 space-y-2 text-sm">
                <div className="font-medium text-white">{title}</div>
                <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1.5 rounded text-blue-400 transition-colors hover:text-blue-300 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
                >
                    <ArrowSquareOut className="h-3.5 w-3.5" />
                    {openInLabels[type]}
                </a>
            </div>
        </div>
    );
}

/**
 * Integration not connected message with direct link
 */
function IntegrationRequired() {
    return (
        <div className="flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
            <PlugsConnected className="h-5 w-5 shrink-0 text-amber-400" />
            <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-amber-200">
                    Google Sheets/Docs/Slides not connected
                </p>
                <Link
                    href="/integrations"
                    className="mt-1 inline-flex items-center gap-1 text-xs text-amber-200/70 underline underline-offset-2 transition-colors hover:text-amber-100 focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:outline-none"
                >
                    Connect your Google account
                </Link>
            </div>
        </div>
    );
}

/**
 * Main tool result component
 */
export function GoogleWorkspaceFilesToolResult({
    toolCallId,
    status,
    action,
    input,
    output,
    error,
}: GoogleWorkspaceFilesToolResultProps) {
    // Render rich output based on action
    const renderOutput = () => {
        if (status !== "completed" || !output) return null;

        // Handle picker action
        if (action === "open_google_picker" || output.action === "open_google_picker") {
            const fileTypes = (output.fileTypes || input.fileTypes) as
                | Array<"spreadsheet" | "document" | "presentation">
                | undefined;
            return <PickerAction toolCallId={toolCallId} fileTypes={fileTypes} />;
        }

        // Handle integration not connected
        if (output.error === "integration_not_connected") {
            return <IntegrationRequired />;
        }

        // Handle file creation
        if (output.spreadsheetId && output.url) {
            return (
                <FileCreatedConfirmation
                    type="sheet"
                    title={(input.title as string) || "Untitled Spreadsheet"}
                    url={output.url as string}
                />
            );
        }

        if (output.documentId && output.url) {
            return (
                <FileCreatedConfirmation
                    type="doc"
                    title={(input.title as string) || "Untitled Document"}
                    url={output.url as string}
                />
            );
        }

        if (output.presentationId && output.url) {
            return (
                <FileCreatedConfirmation
                    type="slides"
                    title={(input.title as string) || "Untitled Presentation"}
                    url={output.url as string}
                />
            );
        }

        return null;
    };

    return (
        <ToolRenderer
            toolName="google-workspace-files"
            toolCallId={toolCallId}
            status={status}
            input={input}
            output={output}
            error={error}
        >
            {renderOutput()}
        </ToolRenderer>
    );
}
