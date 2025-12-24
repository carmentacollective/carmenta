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
    getCurrentHoliday,
    resolveToCssTheme,
    HOLIDAYS,
    type ThemeVariant,
    type HolidayConfig,
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

        it("migrates old 'christmas' theme to 'holiday'", () => {
            // Simulate user with old "christmas" stored
            localStorage.setItem("carmenta-theme-variant", "christmas");

            const { result } = renderHook(() => useThemeVariant(), {
                wrapper: createWrapper(),
            });

            // Should migrate to "holiday"
            expect(result.current.themeVariant).toBe("holiday");
            expect(localStorage.getItem("carmenta-theme-variant")).toBe("holiday");
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
            "holiday",
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
            // For "holiday", data-theme should be the resolved CSS theme (e.g., "christmas")
            // For others, data-theme matches the variant
            const expectedDataTheme =
                theme === "holiday" ? resolveToCssTheme(theme) : theme;
            expect(document.documentElement.getAttribute("data-theme")).toBe(
                expectedDataTheme
            );
        });
    });
});

describe("Holiday theme resolution", () => {
    describe("getCurrentHoliday", () => {
        beforeEach(() => {
            vi.useFakeTimers();
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it("returns Christmas during Christmas period (Dec 1 - Jan 6)", () => {
            // Test middle of Christmas period
            vi.setSystemTime(new Date("2024-12-25T12:00:00Z"));

            const holiday = getCurrentHoliday();

            expect(holiday.cssTheme).toBe("christmas");
            expect(holiday.label).toBe("Christmas");
        });

        it("returns Christmas on Dec 1 (start boundary)", () => {
            vi.setSystemTime(new Date(2024, 11, 1, 12, 0, 0)); // Dec 1, 2024 12:00 local

            const holiday = getCurrentHoliday();

            expect(holiday.cssTheme).toBe("christmas");
        });

        it("returns Christmas on Jan 6 (end boundary)", () => {
            vi.setSystemTime(new Date(2025, 0, 6, 23, 59, 59)); // Jan 6, 2025 23:59 local

            const holiday = getCurrentHoliday();

            expect(holiday.cssTheme).toBe("christmas");
        });

        it("returns Christmas on Dec 31 (year-spanning range)", () => {
            vi.setSystemTime(new Date(2024, 11, 31, 23, 59, 59)); // Dec 31, 2024 23:59 local

            const holiday = getCurrentHoliday();

            expect(holiday.cssTheme).toBe("christmas");
        });

        it("returns Christmas on Jan 1 (year-spanning range)", () => {
            vi.setSystemTime(new Date(2025, 0, 1, 0, 0, 0)); // Jan 1, 2025 00:00 local

            const holiday = getCurrentHoliday();

            expect(holiday.cssTheme).toBe("christmas");
        });

        it("returns default holiday outside Christmas period", () => {
            // Mid-summer, definitely not a holiday
            vi.setSystemTime(new Date(2024, 6, 15, 12, 0, 0)); // July 15, 2024 local

            const holiday = getCurrentHoliday();

            expect(holiday.cssTheme).toBe("carmenta");
            expect(holiday.label).toBe("Seasonal");
        });

        it("returns default holiday on Nov 30 (day before Christmas)", () => {
            vi.setSystemTime(new Date(2024, 10, 30, 23, 59, 59)); // Nov 30, 2024 local

            const holiday = getCurrentHoliday();

            expect(holiday.cssTheme).toBe("carmenta");
        });

        it("returns default holiday on Jan 7 (day after Christmas)", () => {
            vi.setSystemTime(new Date(2025, 0, 7, 0, 0, 0)); // Jan 7, 2025 local

            const holiday = getCurrentHoliday();

            expect(holiday.cssTheme).toBe("carmenta");
        });
    });

    describe("resolveToCssTheme", () => {
        beforeEach(() => {
            vi.useFakeTimers();
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it("resolves 'holiday' to Christmas during Christmas period", () => {
            vi.setSystemTime(new Date("2024-12-25T12:00:00Z"));

            expect(resolveToCssTheme("holiday")).toBe("christmas");
        });

        it("resolves 'holiday' to Carmenta outside holiday period", () => {
            vi.setSystemTime(new Date("2024-07-15T12:00:00Z"));

            expect(resolveToCssTheme("holiday")).toBe("carmenta");
        });

        it("passes through non-holiday themes unchanged", () => {
            expect(resolveToCssTheme("carmenta")).toBe("carmenta");
            expect(resolveToCssTheme("warm-earth")).toBe("warm-earth");
            expect(resolveToCssTheme("arctic-clarity")).toBe("arctic-clarity");
            expect(resolveToCssTheme("forest-wisdom")).toBe("forest-wisdom");
            expect(resolveToCssTheme("monochrome")).toBe("monochrome");
        });
    });

    describe("HOLIDAYS configuration", () => {
        it("has Christmas holiday configured", () => {
            const christmas = HOLIDAYS.find((h) => h.cssTheme === "christmas");

            expect(christmas).toBeDefined();
            expect(christmas?.label).toBe("Christmas");
            expect(christmas?.startMonth).toBe(12);
            expect(christmas?.startDay).toBe(1);
            expect(christmas?.endMonth).toBe(1);
            expect(christmas?.endDay).toBe(6);
        });

        it("Christmas config has valid colors", () => {
            const christmas = HOLIDAYS.find((h) => h.cssTheme === "christmas");

            expect(christmas?.colors).toHaveLength(3);
            expect(christmas?.colors[0]).toMatch(/^hsl\(/);
        });
    });
});
