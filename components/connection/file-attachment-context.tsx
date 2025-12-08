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
    useState,
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
import { useConnection } from "./connection-context";

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

interface FileAttachmentContextType {
    /** Pending uploads (uploading or complete) */
    pendingFiles: UploadProgress[];
    /** Add files to upload queue */
    addFiles: (files: FileList | File[]) => void;
    /** Remove file from queue */
    removeFile: (id: string) => void;
    /** Clear all files (after successful send) */
    clearFiles: () => void;
    /** Whether any uploads are in progress */
    isUploading: boolean;
    /** Successfully uploaded files */
    completedFiles: UploadedFile[];
    /** Add pasted text as file (stores original content for Insert inline) */
    addPastedText: (files: File[], textContent: string) => void;
    /** Get next sequential filename for pasted content */
    getNextPastedFileName: (type: "text" | "image") => string;
    /** Get original text content for pasted text file */
    getTextContent: (fileId: string) => string | undefined;
}

const FileAttachmentContext = createContext<FileAttachmentContextType | null>(null);

export function FileAttachmentProvider({ children }: { children: ReactNode }) {
    const [pendingFiles, dispatch] = useReducer(uploadReducer, []);
    const [pasteCount, setPasteCount] = useState({ text: 0, image: 0 });
    // Use ref for Map - it's mutated, not replaced, so shouldn't trigger re-renders
    const pastedTextContentRef = useRef(new Map<string, string>());
    const { activeConnection } = useConnection();
    const { user } = useUser();

    const startUpload = useCallback(
        async (upload: UploadProgress) => {
            const userEmail = user?.primaryEmailAddress?.emailAddress;
            if (!userEmail) {
                logger.error({}, "Cannot upload file: user not authenticated");
                dispatch({ type: "ERROR", id: upload.id, error: "Not authenticated" });
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
                    error instanceof Error ? error.message : "Upload failed";
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
        (fileList: FileList | File[]) => {
            const files = Array.from(fileList);
            const newUploads: UploadProgress[] = files.map((file) => ({
                id: nanoid(),
                file,
                status: "validating" as const,
            }));

            dispatch({ type: "ADD", uploads: newUploads });
            newUploads.forEach((upload) => startUpload(upload));
        },
        [startUpload]
    );

    const getNextPastedFileName = useCallback((type: "text" | "image") => {
        let nextCount = 1;
        setPasteCount((prev) => {
            nextCount = prev[type] + 1;
            return { ...prev, [type]: nextCount };
        });

        if (type === "text") {
            return nextCount === 1
                ? "Pasted Content.txt"
                : `Pasted Content ${nextCount}.txt`;
        }
        return nextCount === 1 ? "Pasted Image.png" : `Pasted Image ${nextCount}.png`;
    }, []);

    const addPastedText = useCallback(
        (fileList: File[], textContent: string) => {
            const files = Array.from(fileList);
            const newUploads: UploadProgress[] = files.map((file) => {
                const id = nanoid();
                pastedTextContentRef.current.set(id, textContent);
                return { id, file, status: "validating" as const };
            });

            dispatch({ type: "ADD", uploads: newUploads });
            newUploads.forEach((upload) => startUpload(upload));
        },
        [startUpload]
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
        setPasteCount({ text: 0, image: 0 });
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
                removeFile,
                clearFiles,
                isUploading,
                completedFiles,
                addPastedText,
                getNextPastedFileName,
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
