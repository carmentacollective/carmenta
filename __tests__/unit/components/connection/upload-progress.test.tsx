/**
 * Upload Progress Tests
 *
 * Tests for the upload progress display component, specifically
 * placeholder display behavior when attachments have placeholders.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { UploadProgressDisplay } from "@/components/connection/upload-progress";
import type { UploadProgress } from "@/lib/storage/types";

// Mock state - use object so we can swap the array reference
const mockState = {
    pendingFiles: [] as UploadProgress[],
    removeFile: vi.fn(),
    getTextContent: vi.fn(),
};

vi.mock("@/components/connection/file-attachment-context", () => ({
    useFileAttachments: () => ({
        pendingFiles: mockState.pendingFiles,
        removeFile: mockState.removeFile,
        getTextContent: mockState.getTextContent,
    }),
}));

describe("UploadProgressDisplay", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockState.pendingFiles = [];
        mockState.getTextContent.mockReturnValue(undefined);
    });

    afterEach(() => {
        cleanup();
    });

    describe("placeholder display", () => {
        it("shows placeholder instead of 'Complete' when placeholder exists", () => {
            mockState.pendingFiles.push({
                id: "upload-1",
                file: new File([""], "Pasted Image #1.png", { type: "image/png" }),
                status: "complete",
                placeholder: "[Pasted Image #1]",
            });

            render(<UploadProgressDisplay />);

            expect(screen.getByText("[Pasted Image #1]")).toBeInTheDocument();
            expect(screen.queryByText("Complete")).not.toBeInTheDocument();
        });

        it("shows no status text when completed without placeholder (checkmark is sufficient)", () => {
            mockState.pendingFiles.push({
                id: "upload-1",
                file: new File([""], "regular-file.png", { type: "image/png" }),
                status: "complete",
                // No placeholder - checkmark badge is sufficient
            });

            render(<UploadProgressDisplay />);

            // No status text shown - the checkmark badge indicates completion
            expect(screen.queryByText("Ready")).not.toBeInTheDocument();
            // But filename is still shown
            expect(screen.getByText("regular-file.png")).toBeInTheDocument();
        });

        it("shows placeholder for text files", () => {
            mockState.pendingFiles.push({
                id: "upload-1",
                file: new File(["content"], "Pasted Text #1.txt", {
                    type: "text/plain",
                }),
                status: "complete",
                placeholder: "[Pasted Text #1]",
            });

            render(<UploadProgressDisplay />);

            expect(screen.getByText("[Pasted Text #1]")).toBeInTheDocument();
        });

        it("shows multiple placeholders for multiple uploads", () => {
            mockState.pendingFiles.push(
                {
                    id: "upload-1",
                    file: new File([""], "Pasted Image #1.png", { type: "image/png" }),
                    status: "complete",
                    placeholder: "[Pasted Image #1]",
                },
                {
                    id: "upload-2",
                    file: new File([""], "Pasted Image #2.png", { type: "image/png" }),
                    status: "complete",
                    placeholder: "[Pasted Image #2]",
                }
            );

            render(<UploadProgressDisplay />);

            expect(screen.getByText("[Pasted Image #1]")).toBeInTheDocument();
            expect(screen.getByText("[Pasted Image #2]")).toBeInTheDocument();
        });
    });

    describe("status messages during upload", () => {
        it("shows 'Checking...' during validation", () => {
            mockState.pendingFiles.push({
                id: "upload-1",
                file: new File([""], "test.png", { type: "image/png" }),
                status: "validating",
                placeholder: "[Pasted Image #1]",
            });

            render(<UploadProgressDisplay />);

            expect(screen.getByText("Checking...")).toBeInTheDocument();
        });

        it("shows 'Optimizing...' during optimization", () => {
            mockState.pendingFiles.push({
                id: "upload-1",
                file: new File([""], "test.png", { type: "image/png" }),
                status: "optimizing",
                placeholder: "[Pasted Image #1]",
            });

            render(<UploadProgressDisplay />);

            expect(screen.getByText("Optimizing...")).toBeInTheDocument();
        });

        it("shows 'Uploading...' during upload", () => {
            mockState.pendingFiles.push({
                id: "upload-1",
                file: new File([""], "test.png", { type: "image/png" }),
                status: "uploading",
                placeholder: "[Pasted Image #1]",
            });

            render(<UploadProgressDisplay />);

            expect(screen.getByText("Uploading...")).toBeInTheDocument();
        });

        it("shows error message on error", () => {
            mockState.pendingFiles.push({
                id: "upload-1",
                file: new File([""], "test.png", { type: "image/png" }),
                status: "error",
                error: "File too large",
                placeholder: "[Pasted Image #1]",
            });

            render(<UploadProgressDisplay />);

            expect(screen.getByText("File too large")).toBeInTheDocument();
        });
    });

    describe("file display", () => {
        it("shows filename", () => {
            mockState.pendingFiles.push({
                id: "upload-1",
                file: new File([""], "Pasted Image #1.png", { type: "image/png" }),
                status: "complete",
                placeholder: "[Pasted Image #1]",
            });

            render(<UploadProgressDisplay />);

            expect(screen.getByText("Pasted Image #1.png")).toBeInTheDocument();
        });

        it("renders nothing when no pending files", () => {
            const { container } = render(<UploadProgressDisplay />);

            expect(container.firstChild).toBeNull();
        });
    });
});
