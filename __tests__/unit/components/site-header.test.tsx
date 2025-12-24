import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { SiteHeader } from "@/components/site-header";
import { FloatingEmojiProvider } from "@/components/delight/floating-emoji";

// Wrapper to provide required context for InteractiveLogo
function renderWithProviders(ui: React.ReactNode) {
    return render(<FloatingEmojiProvider>{ui}</FloatingEmojiProvider>);
}

describe("SiteHeader", () => {
    it("renders logo and brand name", () => {
        renderWithProviders(<SiteHeader />);
        expect(screen.getByAltText("Carmenta")).toBeInTheDocument();
        expect(screen.getByText("Carmenta")).toBeInTheDocument();
    });

    it("logo links to home page", () => {
        const { container } = renderWithProviders(<SiteHeader />);
        const link = container.querySelector("a");
        expect(link).toHaveAttribute("href", "/");
    });

    // Note: bordered prop exists but border styling was removed intentionally
    // (see commit "Make header fully transparent and move theme controls to user menu")
    it("header has transparent styling without borders", () => {
        const { container } = renderWithProviders(<SiteHeader bordered />);
        const header = container.querySelector("header");
        expect(header).not.toHaveClass("border-b");
    });

    it("renders right content when provided", () => {
        renderWithProviders(<SiteHeader rightContent={<button>Test Button</button>} />);
        expect(screen.getByText("Test Button")).toBeInTheDocument();
    });

    it("does not render user-provided right content when rightContent is not provided", () => {
        const { container } = renderWithProviders(
            <SiteHeader showThemeSwitcher={false} />
        );
        const header = container.querySelector("header");
        // Header has 2 children: logo link and right-side wrapper
        expect(header?.children.length).toBe(2);
        const rightWrapper = header?.children[1];
        // Right wrapper contains UserAuthButton (mocked as null, but still a child)
        expect(rightWrapper?.children.length).toBe(1);
    });

    it("renders multiple right content elements", () => {
        renderWithProviders(
            <SiteHeader
                rightContent={
                    <>
                        <button>Button 1</button>
                        <button>Button 2</button>
                    </>
                }
            />
        );
        expect(screen.getByText("Button 1")).toBeInTheDocument();
        expect(screen.getByText("Button 2")).toBeInTheDocument();
    });
});
