/**
 * useDragDrop Hook Tests
 *
 * Tests viewport-wide drag-and-drop file upload functionality.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDragDrop } from "@/lib/hooks/use-drag-drop";

// Mock the client logger
vi.mock("@/lib/client-logger", () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

// Mock the file validator
vi.mock("@/lib/storage/file-validator", () => ({
    validateFile: vi.fn((file: File) => {
        // Reject files with "invalid" in the name
        if (file.name.includes("invalid")) {
            return { valid: false, error: "Invalid file type" };
        }
        return { valid: true };
    }),
}));

/**
 * Create a synthetic drag event since jsdom doesn't support DragEvent
 */
function createDragEvent(type: string, dataTransfer?: Partial<DataTransfer>): Event {
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(event, "dataTransfer", {
        value: dataTransfer ?? null,
        writable: false,
    });
    return event;
}

describe("useDragDrop", () => {
    let onDropMock: (files: File[]) => void;
    let onErrorMock: (error: string) => void;

    beforeEach(() => {
        onDropMock = vi.fn();
        onErrorMock = vi.fn();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe("initial state", () => {
        it("should start with isDragging false", () => {
            const { result } = renderHook(() => useDragDrop({ onDrop: onDropMock }));

            expect(result.current.isDragging).toBe(false);
        });
    });

    describe("drag enter behavior", () => {
        it("should set isDragging true when files are dragged over", () => {
            const { result } = renderHook(() => useDragDrop({ onDrop: onDropMock }));

            act(() => {
                const event = createDragEvent("dragenter", {
                    types: ["Files"],
                } as Partial<DataTransfer>);
                window.dispatchEvent(event);
            });

            expect(result.current.isDragging).toBe(true);
        });

        it("should not set isDragging when non-file items are dragged", () => {
            const { result } = renderHook(() => useDragDrop({ onDrop: onDropMock }));

            act(() => {
                const event = createDragEvent("dragenter", {
                    types: ["text/plain"],
                } as Partial<DataTransfer>);
                window.dispatchEvent(event);
            });

            expect(result.current.isDragging).toBe(false);
        });
    });

    describe("drag leave behavior", () => {
        it("should set isDragging false when drag leaves", () => {
            const { result } = renderHook(() => useDragDrop({ onDrop: onDropMock }));

            // Enter first
            act(() => {
                const enterEvent = createDragEvent("dragenter", {
                    types: ["Files"],
                } as Partial<DataTransfer>);
                window.dispatchEvent(enterEvent);
            });

            expect(result.current.isDragging).toBe(true);

            // Then leave
            act(() => {
                const leaveEvent = createDragEvent("dragleave");
                window.dispatchEvent(leaveEvent);
            });

            expect(result.current.isDragging).toBe(false);
        });

        it("should use ref counting to prevent flicker on nested elements", () => {
            const { result } = renderHook(() => useDragDrop({ onDrop: onDropMock }));

            // Enter parent
            act(() => {
                const event = createDragEvent("dragenter", {
                    types: ["Files"],
                } as Partial<DataTransfer>);
                window.dispatchEvent(event);
            });

            expect(result.current.isDragging).toBe(true);

            // Enter child (counter = 2)
            act(() => {
                const event = createDragEvent("dragenter", {
                    types: ["Files"],
                } as Partial<DataTransfer>);
                window.dispatchEvent(event);
            });

            // Leave child (counter = 1, still dragging)
            act(() => {
                const event = createDragEvent("dragleave");
                window.dispatchEvent(event);
            });

            expect(result.current.isDragging).toBe(true);

            // Leave parent (counter = 0)
            act(() => {
                const event = createDragEvent("dragleave");
                window.dispatchEvent(event);
            });

            expect(result.current.isDragging).toBe(false);
        });
    });

    describe("drop behavior", () => {
        it("should call onDrop with valid files", () => {
            const { result } = renderHook(() => useDragDrop({ onDrop: onDropMock }));

            const file = new File(["content"], "test.jpg", {
                type: "image/jpeg",
            });

            act(() => {
                const dropEvent = createDragEvent("drop", {
                    items: [
                        { kind: "file", getAsFile: () => file },
                    ] as unknown as DataTransferItemList,
                    files: [file] as unknown as FileList,
                } as Partial<DataTransfer>);
                window.dispatchEvent(dropEvent);
            });

            expect(onDropMock).toHaveBeenCalledWith([file]);
            expect(result.current.isDragging).toBe(false);
        });

        it("should call onError for invalid files", () => {
            renderHook(() => useDragDrop({ onDrop: onDropMock, onError: onErrorMock }));

            const file = new File(["content"], "invalid.exe", {
                type: "application/x-msdownload",
            });

            act(() => {
                const dropEvent = createDragEvent("drop", {
                    items: [
                        { kind: "file", getAsFile: () => file },
                    ] as unknown as DataTransferItemList,
                    files: [file] as unknown as FileList,
                } as Partial<DataTransfer>);
                window.dispatchEvent(dropEvent);
            });

            expect(onErrorMock).toHaveBeenCalledWith("Invalid file type");
            expect(onDropMock).not.toHaveBeenCalled();
        });

        it("should filter out invalid files but pass valid ones", () => {
            renderHook(() => useDragDrop({ onDrop: onDropMock, onError: onErrorMock }));

            const validFile = new File(["content"], "test.jpg", {
                type: "image/jpeg",
            });
            const invalidFile = new File(["content"], "invalid.exe", {
                type: "application/x-msdownload",
            });

            act(() => {
                const dropEvent = createDragEvent("drop", {
                    items: [
                        { kind: "file", getAsFile: () => validFile },
                        { kind: "file", getAsFile: () => invalidFile },
                    ] as unknown as DataTransferItemList,
                    files: [validFile, invalidFile] as unknown as FileList,
                } as Partial<DataTransfer>);
                window.dispatchEvent(dropEvent);
            });

            expect(onDropMock).toHaveBeenCalledWith([validFile]);
            expect(onErrorMock).toHaveBeenCalledWith("Invalid file type");
        });
    });

    describe("disabled state", () => {
        it("should not respond to drag events when disabled", () => {
            const { result } = renderHook(() =>
                useDragDrop({ onDrop: onDropMock, disabled: true })
            );

            act(() => {
                const event = createDragEvent("dragenter", {
                    types: ["Files"],
                } as Partial<DataTransfer>);
                window.dispatchEvent(event);
            });

            expect(result.current.isDragging).toBe(false);
        });

        it("should return isDragging false even if internal state is true", () => {
            const { result, rerender } = renderHook(
                ({ disabled }) => useDragDrop({ onDrop: onDropMock, disabled }),
                { initialProps: { disabled: false } }
            );

            // Start dragging
            act(() => {
                const event = createDragEvent("dragenter", {
                    types: ["Files"],
                } as Partial<DataTransfer>);
                window.dispatchEvent(event);
            });

            expect(result.current.isDragging).toBe(true);

            // Disable while dragging
            rerender({ disabled: true });

            // Should derive isDragging as false
            expect(result.current.isDragging).toBe(false);
        });
    });

    describe("cleanup", () => {
        it("should remove event listeners on unmount", () => {
            const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");

            const { unmount } = renderHook(() => useDragDrop({ onDrop: onDropMock }));

            unmount();

            expect(removeEventListenerSpy).toHaveBeenCalledWith(
                "dragenter",
                expect.any(Function)
            );
            expect(removeEventListenerSpy).toHaveBeenCalledWith(
                "dragleave",
                expect.any(Function)
            );
            expect(removeEventListenerSpy).toHaveBeenCalledWith(
                "dragover",
                expect.any(Function)
            );
            expect(removeEventListenerSpy).toHaveBeenCalledWith(
                "drop",
                expect.any(Function)
            );

            removeEventListenerSpy.mockRestore();
        });
    });
});
