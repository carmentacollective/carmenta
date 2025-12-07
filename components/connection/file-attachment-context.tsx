"use client";

/**
 * File Attachment Context
 *
 * Manages pending file uploads for the composer.
 * Provides upload queue state and methods.
 */

import {
    createContext,
    useContext,
    useState,
    useCallback,
    type ReactNode,
} from "react";
import { nanoid } from "nanoid";
import { useUser } from "@clerk/nextjs";
import { uploadFile } from "@/lib/storage/upload";
import { logger } from "@/lib/client-logger";
import type { UploadProgress, UploadedFile } from "@/lib/storage/types";
import { useConnection } from "./connection-context";

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
}

const FileAttachmentContext = createContext<FileAttachmentContextType | null>(null);

export function FileAttachmentProvider({ children }: { children: ReactNode }) {
    const [pendingFiles, setPendingFiles] = useState<UploadProgress[]>([]);
    const { activeConnection } = useConnection();
    const { user } = useUser();

    const startUpload = useCallback(
        async (upload: UploadProgress) => {
            const userEmail = user?.primaryEmailAddress?.emailAddress;
            if (!userEmail) {
                logger.error({}, "Cannot upload file: user not authenticated");
                setPendingFiles((prev) =>
                    prev.map((u) =>
                        u.id === upload.id
                            ? { ...u, status: "error", error: "Not authenticated" }
                            : u
                    )
                );
                return;
            }

            try {
                const result = await uploadFile(
                    upload.file,
                    userEmail,
                    activeConnection?.id || null,
                    (status) => {
                        // Update status as upload progresses
                        setPendingFiles((prev) =>
                            prev.map((u) => (u.id === upload.id ? { ...u, status } : u))
                        );
                    }
                );

                // Mark complete with result
                setPendingFiles((prev) =>
                    prev.map((u) =>
                        u.id === upload.id ? { ...u, status: "complete", result } : u
                    )
                );
            } catch (error) {
                const errorMessage =
                    error instanceof Error ? error.message : "Upload failed";

                logger.error(
                    { error: errorMessage, filename: upload.file.name },
                    "Upload failed"
                );

                setPendingFiles((prev) =>
                    prev.map((u) =>
                        u.id === upload.id
                            ? { ...u, status: "error", error: errorMessage }
                            : u
                    )
                );
            }
        },
        [user, activeConnection]
    );

    const addFiles = useCallback(
        (fileList: FileList | File[]) => {
            const files = Array.from(fileList);

            // Create pending upload entries with initial "validating" status
            const newUploads: UploadProgress[] = files.map((file) => ({
                id: nanoid(),
                file,
                status: "validating" as const,
            }));

            setPendingFiles((prev) => [...prev, ...newUploads]);

            // Start uploads
            newUploads.forEach((upload) => {
                startUpload(upload);
            });
        },
        [startUpload]
    );

    const removeFile = useCallback((id: string) => {
        setPendingFiles((prev) => prev.filter((u) => u.id !== id));
    }, []);

    const clearFiles = useCallback(() => {
        setPendingFiles([]);
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
