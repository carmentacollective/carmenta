/**
 * Tests for theme context
 *
 * Tests the ThemeProvider, useThemeVariant hook, and theme persistence.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Unmock theme-context so we test the real implementation
// (vitest.setup.ts mocks it globally for other component tests)
vi.unmock("@/lib/theme/theme-context");

// Mock next-themes for isolation from light/dark mode logic
vi.mock("next-themes", () => ({
    ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
    useTheme: () => ({ theme: "system", setTheme: vi.fn() }),
}));

import { renderHook, act, cleanup } from "@testing-library/react";
import type { ReactNode } from "react";

import {
    ThemeProvider,
    useThemeVariant,
    type ThemeVariant,
} from "@/lib/theme/theme-context";

describe("ThemeProvider and useThemeVariant", () => {
    beforeEach(() => {
        // Clear localStorage before each test
        localStorage.clear();
        // Reset document attribute
        document.documentElement.removeAttribute("data-theme");
    });

    afterEach(() => {
        cleanup();
    });

    // Create fresh wrapper for each test
    function createWrapper() {
        return function Wrapper({ children }: { children: ReactNode }) {
            return <ThemeProvider>{children}</ThemeProvider>;
        };
    }

    describe("useThemeVariant hook", () => {
        it("throws error when used outside ThemeProvider", () => {
            // Suppress console.error for this test since we expect an error
            const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

            expect(() => {
                renderHook(() => useThemeVariant());
            }).toThrow("useThemeVariant must be used within ThemeProvider");

            consoleSpy.mockRestore();
        });

        it("provides themeVariant and setThemeVariant", () => {
            const { result } = renderHook(() => useThemeVariant(), {
                wrapper: createWrapper(),
            });

            expect(result.current.themeVariant).toBeDefined();
            expect(typeof result.current.setThemeVariant).toBe("function");
        });
    });

    describe("default theme", () => {
        it("defaults to carmenta when no localStorage value", () => {
            const { result } = renderHook(() => useThemeVariant(), {
                wrapper: createWrapper(),
            });

            expect(result.current.themeVariant).toBe("carmenta");
        });
    });

    describe("setThemeVariant", () => {
        it("updates themeVariant state", () => {
            const { result } = renderHook(() => useThemeVariant(), {
                wrapper: createWrapper(),
            });

            act(() => {
                result.current.setThemeVariant("warm-earth");
            });

            expect(result.current.themeVariant).toBe("warm-earth");
        });

        it("persists theme to localStorage", () => {
            const { result } = renderHook(() => useThemeVariant(), {
                wrapper: createWrapper(),
            });

            act(() => {
                result.current.setThemeVariant("forest-wisdom");
            });

            expect(localStorage.getItem("carmenta-theme-variant")).toBe(
                "forest-wisdom"
            );
        });

        it("applies data-theme attribute to documentElement", () => {
            const { result } = renderHook(() => useThemeVariant(), {
                wrapper: createWrapper(),
            });

            act(() => {
                result.current.setThemeVariant("monochrome");
            });

            expect(document.documentElement.getAttribute("data-theme")).toBe(
                "monochrome"
            );
        });
    });

    describe("all theme variants", () => {
        const themes: ThemeVariant[] = [
            "carmenta",
            "warm-earth",
            "arctic-clarity",
            "forest-wisdom",
            "monochrome",
        ];

        it.each(themes)("supports %s theme variant", (theme) => {
            const { result } = renderHook(() => useThemeVariant(), {
                wrapper: createWrapper(),
            });

            act(() => {
                result.current.setThemeVariant(theme);
            });

            expect(result.current.themeVariant).toBe(theme);
            expect(localStorage.getItem("carmenta-theme-variant")).toBe(theme);
            expect(document.documentElement.getAttribute("data-theme")).toBe(theme);
        });
    });
});
