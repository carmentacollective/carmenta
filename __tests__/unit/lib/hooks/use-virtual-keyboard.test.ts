/**
 * useVirtualKeyboard Hook Tests
 *
 * Tests mobile virtual keyboard detection via visualViewport API.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useVirtualKeyboard } from "@/lib/hooks/use-virtual-keyboard";

// Mock visualViewport
type MockVisualViewport = {
    height: number;
    width: number;
    addEventListener: ReturnType<typeof vi.fn>;
    removeEventListener: ReturnType<typeof vi.fn>;
};

function createMockVisualViewport(height: number): MockVisualViewport {
    return {
        height,
        width: 375,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
    };
}

describe("useVirtualKeyboard", () => {
    let originalVisualViewport: VisualViewport | null;
    let originalInnerHeight: number;

    beforeEach(() => {
        originalVisualViewport = window.visualViewport;
        originalInnerHeight = window.innerHeight;

        // Set a standard mobile viewport height
        Object.defineProperty(window, "innerHeight", {
            value: 800,
            writable: true,
            configurable: true,
        });
    });

    afterEach(() => {
        // Restore original values
        Object.defineProperty(window, "visualViewport", {
            value: originalVisualViewport,
            writable: true,
            configurable: true,
        });
        Object.defineProperty(window, "innerHeight", {
            value: originalInnerHeight,
            writable: true,
            configurable: true,
        });
        vi.clearAllMocks();
        vi.useRealTimers();
    });

    describe("when visualViewport is not supported", () => {
        it("should return isSupported false and default values", () => {
            Object.defineProperty(window, "visualViewport", {
                value: null,
                writable: true,
                configurable: true,
            });

            const { result } = renderHook(() => useVirtualKeyboard());

            expect(result.current.isSupported).toBe(false);
            expect(result.current.isKeyboardOpen).toBe(false);
            expect(result.current.keyboardHeight).toBe(0);
        });
    });

    describe("when visualViewport is supported", () => {
        it("should return isSupported true", () => {
            const mockViewport = createMockVisualViewport(800);
            Object.defineProperty(window, "visualViewport", {
                value: mockViewport,
                writable: true,
                configurable: true,
            });

            const { result } = renderHook(() => useVirtualKeyboard());

            expect(result.current.isSupported).toBe(true);
        });

        it("should attach resize and scroll listeners", () => {
            const mockViewport = createMockVisualViewport(800);
            Object.defineProperty(window, "visualViewport", {
                value: mockViewport,
                writable: true,
                configurable: true,
            });

            renderHook(() => useVirtualKeyboard());

            expect(mockViewport.addEventListener).toHaveBeenCalledWith(
                "resize",
                expect.any(Function)
            );
            expect(mockViewport.addEventListener).toHaveBeenCalledWith(
                "scroll",
                expect.any(Function)
            );
        });

        it("should remove listeners on unmount", () => {
            const mockViewport = createMockVisualViewport(800);
            Object.defineProperty(window, "visualViewport", {
                value: mockViewport,
                writable: true,
                configurable: true,
            });

            const { unmount } = renderHook(() => useVirtualKeyboard());
            unmount();

            expect(mockViewport.removeEventListener).toHaveBeenCalledWith(
                "resize",
                expect.any(Function)
            );
            expect(mockViewport.removeEventListener).toHaveBeenCalledWith(
                "scroll",
                expect.any(Function)
            );
        });

        it("should detect keyboard open when viewport shrinks significantly", () => {
            vi.useFakeTimers();

            const mockViewport = createMockVisualViewport(800);
            let resizeHandler: (() => void) | null = null;

            mockViewport.addEventListener = vi.fn(
                (event: string, handler: () => void) => {
                    if (event === "resize") {
                        resizeHandler = handler;
                    }
                }
            );

            Object.defineProperty(window, "visualViewport", {
                value: mockViewport,
                writable: true,
                configurable: true,
            });

            const { result } = renderHook(() => useVirtualKeyboard());

            // Initially keyboard is closed
            expect(result.current.isKeyboardOpen).toBe(false);

            // Simulate keyboard opening (viewport shrinks by 300px)
            act(() => {
                mockViewport.height = 500;
                resizeHandler?.();
                vi.advanceTimersByTime(100);
            });

            expect(result.current.isKeyboardOpen).toBe(true);
            expect(result.current.keyboardHeight).toBe(300);
        });

        it("should detect keyboard close when viewport returns to normal", () => {
            vi.useFakeTimers();

            const mockViewport = createMockVisualViewport(800);
            let resizeHandler: (() => void) | null = null;

            mockViewport.addEventListener = vi.fn(
                (event: string, handler: () => void) => {
                    if (event === "resize") {
                        resizeHandler = handler;
                    }
                }
            );

            Object.defineProperty(window, "visualViewport", {
                value: mockViewport,
                writable: true,
                configurable: true,
            });

            const { result } = renderHook(() => useVirtualKeyboard());

            // Open keyboard
            act(() => {
                mockViewport.height = 500;
                resizeHandler?.();
                vi.advanceTimersByTime(100);
            });

            expect(result.current.isKeyboardOpen).toBe(true);

            // Close keyboard
            act(() => {
                mockViewport.height = 800;
                resizeHandler?.();
                vi.advanceTimersByTime(100);
            });

            expect(result.current.isKeyboardOpen).toBe(false);
            expect(result.current.keyboardHeight).toBe(0);
        });

        it("should not trigger for small viewport changes (browser chrome)", () => {
            vi.useFakeTimers();

            const mockViewport = createMockVisualViewport(800);
            let resizeHandler: (() => void) | null = null;

            mockViewport.addEventListener = vi.fn(
                (event: string, handler: () => void) => {
                    if (event === "resize") {
                        resizeHandler = handler;
                    }
                }
            );

            Object.defineProperty(window, "visualViewport", {
                value: mockViewport,
                writable: true,
                configurable: true,
            });

            const { result } = renderHook(() => useVirtualKeyboard());

            // Small change (50px - less than threshold)
            act(() => {
                mockViewport.height = 750;
                resizeHandler?.();
                vi.advanceTimersByTime(100);
            });

            // Should not consider keyboard open for small changes
            expect(result.current.isKeyboardOpen).toBe(false);
        });
    });
});
