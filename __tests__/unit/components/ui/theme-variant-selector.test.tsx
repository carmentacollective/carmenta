/**
 * Tests for ThemeVariantSelector component
 *
 * Tests rendering, theme selection behavior, and display of all themes.
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

import { render, fireEvent, cleanup } from "@testing-library/react";
import type { ReactNode } from "react";

import { ThemeVariantSelector } from "@/components/ui/theme-variant-selector";
import { ThemeProvider } from "@/lib/theme/theme-context";

describe("ThemeVariantSelector", () => {
    function createWrapper() {
        return function Wrapper({ children }: { children: ReactNode }) {
            return <ThemeProvider>{children}</ThemeProvider>;
        };
    }

    beforeEach(() => {
        localStorage.clear();
        document.documentElement.removeAttribute("data-theme");
    });

    afterEach(() => {
        cleanup();
    });

    describe("trigger button", () => {
        it("renders trigger with current theme name", () => {
            const { getByRole } = render(<ThemeVariantSelector />, {
                wrapper: createWrapper(),
            });

            const trigger = getByRole("button");
            expect(trigger).toHaveTextContent("Carmenta");
        });

        it("shows palette icon", () => {
            const { container } = render(<ThemeVariantSelector />, {
                wrapper: createWrapper(),
            });

            const svg = container.querySelector("svg");
            expect(svg).toBeInTheDocument();
        });
    });

    describe("popover content", () => {
        it("shows all 5 theme options when opened", () => {
            const { getByRole, getAllByText } = render(<ThemeVariantSelector />, {
                wrapper: createWrapper(),
            });

            // Open popover
            fireEvent.click(getByRole("button"));

            // Check all themes are present (getAllByText since trigger also shows current theme)
            expect(getAllByText("Carmenta").length).toBeGreaterThanOrEqual(1);
            expect(getAllByText("Warm Earth").length).toBeGreaterThanOrEqual(1);
            expect(getAllByText("Arctic Clarity").length).toBeGreaterThanOrEqual(1);
            expect(getAllByText("Forest Wisdom").length).toBeGreaterThanOrEqual(1);
            expect(getAllByText("Monochrome").length).toBeGreaterThanOrEqual(1);
        });

        it("shows theme descriptions", () => {
            const { getByRole, getByText } = render(<ThemeVariantSelector />, {
                wrapper: createWrapper(),
            });

            fireEvent.click(getByRole("button"));

            expect(getByText("Sky lavender glow")).toBeInTheDocument();
            expect(getByText("Terracotta, sage & gold")).toBeInTheDocument();
            expect(getByText("Ice blue precision")).toBeInTheDocument();
        });

        it("highlights current theme", () => {
            const { getByRole } = render(<ThemeVariantSelector />, {
                wrapper: createWrapper(),
            });

            fireEvent.click(getByRole("button"));

            // The default theme (carmenta) should have primary styling
            // Use document.querySelectorAll since Popover uses a Portal
            const highlightedButtons = document.querySelectorAll(
                "[class*='bg-primary']"
            );
            expect(highlightedButtons.length).toBeGreaterThan(0);
        });
    });

    describe("theme selection", () => {
        it("updates localStorage when theme is selected", () => {
            const { getByRole, getByText } = render(<ThemeVariantSelector />, {
                wrapper: createWrapper(),
            });

            fireEvent.click(getByRole("button"));
            fireEvent.click(getByText("Warm Earth"));

            expect(localStorage.getItem("carmenta-theme-variant")).toBe("warm-earth");
        });

        it("updates data-theme attribute when theme is selected", () => {
            const { getByRole, getByText } = render(<ThemeVariantSelector />, {
                wrapper: createWrapper(),
            });

            fireEvent.click(getByRole("button"));
            fireEvent.click(getByText("Arctic Clarity"));

            expect(document.documentElement.getAttribute("data-theme")).toBe(
                "arctic-clarity"
            );
        });
    });
});
