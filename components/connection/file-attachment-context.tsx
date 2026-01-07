"use client";

/**
 * File Attachment Context
 *
 * Manages pending file uploads for the composer.
 * Uses a reducer for clean state management.
 */

import {
    createContext,
    useContext,
    useCallback,
    useReducer,
    useRef,
    type ReactNode,
} from "react";
import { nanoid } from "nanoid";
import { useUser } from "@clerk/nextjs";
import { uploadFile } from "@/lib/storage/upload";
import { logger } from "@/lib/client-logger";
import type { UploadProgress, UploadedFile, UploadStatus } from "@/lib/storage/types";
import { useConnectionSafe } from "./connection-context";

// Upload state reducer actions
type UploadAction =
    | { type: "ADD"; uploads: UploadProgress[] }
    | { type: "UPDATE_STATUS"; id: string; status: UploadStatus }
    | { type: "COMPLETE"; id: string; result: UploadedFile }
    | { type: "ERROR"; id: string; error: string }
    | { type: "REMOVE"; id: string }
    | { type: "CLEAR" };

function uploadReducer(
    state: UploadProgress[],
    action: UploadAction
): UploadProgress[] {
    switch (action.type) {
        case "ADD":
            return [...state, ...action.uploads];
        case "UPDATE_STATUS":
            return state.map((u) =>
                u.id === action.id ? { ...u, status: action.status } : u
            );
        case "COMPLETE":
            return state.map((u) =>
                u.id === action.id
                    ? { ...u, status: "complete", result: action.result }
                    : u
            );
        case "ERROR":
            return state.map((u) =>
                u.id === action.id ? { ...u, status: "error", error: action.error } : u
            );
        case "REMOVE":
            return state.filter((u) => u.id !== action.id);
        case "CLEAR":
            return [];
    }
}

/** Pre-uploaded file metadata (for share target) */
export interface PreUploadedFile {
    url: string;
    name: string;
    mediaType: string;
    size: number;
}

interface FileAttachmentContextType {
    /** Pending uploads (uploading or complete) */
    pendingFiles: UploadProgress[];
    /** Add files to upload queue, returns placeholder if provided */
    addFiles: (files: FileList | File[], placeholder?: string) => void;
    /** Add pre-uploaded files (already in storage, e.g., from share target) */
    addPreUploadedFiles: (files: PreUploadedFile[]) => void;
    /** Remove file from queue */
    removeFile: (id: string) => void;
    /** Clear all files (after successful send) */
    clearFiles: () => void;
    /** Whether any uploads are in progress */
    isUploading: boolean;
    /** Successfully uploaded files */
    completedFiles: UploadedFile[];
    /** Add pasted text as file (stores original content for Insert inline) */
    addPastedText: (files: File[], textContent: string, placeholder?: string) => void;
    /** Get next sequential placeholder for pasted content */
    getNextPlaceholder: (
        type: "text" | "image",
        mimeType?: string
    ) => {
        placeholder: string;
        filename: string;
    };
    /** Get original text content for pasted text file */
    getTextContent: (fileId: string) => string | undefined;
}

const FileAttachmentContext = createContext<FileAttachmentContextType | null>(null);

export function FileAttachmentProvider({ children }: { children: ReactNode }) {
    const [pendingFiles, dispatch] = useReducer(uploadReducer, []);
    // Use ref for paste count to avoid race conditions with simultaneous pastes
    const pasteCountRef = useRef({ text: 0, image: 0 });
    // Use ref for Map - it's mutated, not replaced, so shouldn't trigger re-renders
    const pastedTextContentRef = useRef(new Map<string, string>());
    // Safe version - activeConnection is optional for file uploads
    // When outside ConnectionProvider (e.g., CarmentaSheet), uploads work without connection context
    const connectionContext = useConnectionSafe();
    const activeConnection = connectionContext?.activeConnection ?? null;
    const { user } = useUser();

    const startUpload = useCallback(
        async (upload: UploadProgress) => {
            const userEmail = user?.primaryEmailAddress?.emailAddress;
            if (!userEmail) {
                logger.error({}, "Cannot upload file: user not authenticated");
                dispatch({
                    type: "ERROR",
                    id: upload.id,
                    error: "We need you to sign in",
                });
                return;
            }

            try {
                const result = await uploadFile(
                    upload.file,
                    userEmail,
                    activeConnection?.id || null,
                    (status) => {
                        dispatch({ type: "UPDATE_STATUS", id: upload.id, status });
                    }
                );
                dispatch({ type: "COMPLETE", id: upload.id, result });
            } catch (error) {
                const errorMessage =
                    error instanceof Error ? error.message : "Upload didn't work";
                logger.error(
                    { error: errorMessage, filename: upload.file.name },
                    "Upload failed"
                );
                dispatch({ type: "ERROR", id: upload.id, error: errorMessage });
            }
        },
        [user, activeConnection]
    );

    const addFiles = useCallback(
        (fileList: FileList | File[], placeholder?: string) => {
            const files = Array.from(fileList);
            const newUploads: UploadProgress[] = files.map((file) => ({
                id: nanoid(),
                file,
                status: "validating" as const,
                placeholder,
            }));

            dispatch({ type: "ADD", uploads: newUploads });
            newUploads.forEach((upload) => startUpload(upload));
        },
        [startUpload]
    );

    /**
     * Add pre-uploaded files (already in storage).
     * Used by PWA Share Target where files are uploaded server-side
     * before being passed to the client.
     */
    const addPreUploadedFiles = useCallback((files: PreUploadedFile[]) => {
        if (files.length === 0) return;

        const newUploads: UploadProgress[] = files.map((file) => ({
            id: nanoid(),
            // Create a minimal File object for the progress display
            file: new File([], file.name, { type: file.mediaType }),
            status: "complete" as const,
            result: {
                url: file.url,
                mediaType: file.mediaType,
                name: file.name,
                size: file.size,
                path: file.url, // Use URL as path since it's already uploaded
            },
        }));

        dispatch({ type: "ADD", uploads: newUploads });
        logger.info(
            { fileCount: files.length, names: files.map((f) => f.name) },
            "Added pre-uploaded files from share target"
        );
    }, []);

    const getNextPlaceholder = useCallback(
        (type: "text" | "image", mimeType?: string) => {
            // Increment synchronously via ref to avoid race conditions with simultaneous pastes
            pasteCountRef.current[type] += 1;
            const nextCount = pasteCountRef.current[type];

            if (type === "text") {
                return {
                    placeholder: `[Pasted Text #${nextCount}]`,
                    filename: `Pasted Text #${nextCount}.txt`,
                };
            }

            // Use actual image extension from MIME type (e.g., image/jpeg → jpeg)
            const ext = mimeType?.split("/")[1] || "png";
            return {
                placeholder: `[Pasted Image #${nextCount}]`,
                filename: `Pasted Image #${nextCount}.${ext}`,
            };
        },
        []
    );

    const addPastedText = useCallback(
        (fileList: File[], textContent: string, placeholder?: string) => {
            const files = Array.from(fileList);
            const newUploads: UploadProgress[] = files.map((file) => {
                const id = nanoid();
                pastedTextContentRef.current.set(id, textContent);
                // Mark complete immediately - no upload needed
                // Pasted text is stored locally and auto-inlined on send
                return { id, file, status: "complete" as const, placeholder };
            });

            dispatch({ type: "ADD", uploads: newUploads });
            // Skip startUpload() - text files don't need storage upload
        },
        []
    );

    const getTextContent = useCallback((fileId: string) => {
        return pastedTextContentRef.current.get(fileId);
    }, []);

    const removeFile = useCallback((id: string) => {
        dispatch({ type: "REMOVE", id });
        pastedTextContentRef.current.delete(id);
    }, []);

    const clearFiles = useCallback(() => {
        dispatch({ type: "CLEAR" });
        pastedTextContentRef.current.clear();
        pasteCountRef.current = { text: 0, image: 0 };
    }, []);

    const isUploading = pendingFiles.some(
        (u) =>
            u.status === "validating" ||
            u.status === "optimizing" ||
            u.status === "uploading"
    );

    const completedFiles = pendingFiles
        .filter((u) => u.status === "complete" && u.result)
        .map((u) => u.result!);

    return (
        <FileAttachmentContext.Provider
            value={{
                pendingFiles,
                addFiles,
                addPreUploadedFiles,
                removeFile,
                clearFiles,
                isUploading,
                completedFiles,
                addPastedText,
                getNextPlaceholder,
                getTextContent,
            }}
        >
            {children}
        </FileAttachmentContext.Provider>
    );
}

export function useFileAttachments() {
    const context = useContext(FileAttachmentContext);
    if (!context) {
        throw new Error(
            "useFileAttachments must be used within FileAttachmentProvider"
        );
    }
    return context;
}
