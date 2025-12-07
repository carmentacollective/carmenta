import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { SiteHeader } from "@/components/site-header";

describe("SiteHeader", () => {
    it("renders logo and brand name", () => {
        render(<SiteHeader />);
        expect(screen.getByAltText("Carmenta")).toBeInTheDocument();
        expect(screen.getByText("Carmenta")).toBeInTheDocument();
    });

    it("logo links to home page", () => {
        const { container } = render(<SiteHeader />);
        const link = container.querySelector("a");
        expect(link).toHaveAttribute("href", "/");
    });

    it("applies bordered styles when bordered prop is true", () => {
        const { container } = render(<SiteHeader bordered />);
        const header = container.querySelector("header");
        expect(header?.className).toContain("border-b");
        expect(header?.className).toContain("bg-white/80");
        expect(header?.className).toContain("backdrop-blur-sm");
    });

    it("does not apply bordered styles when bordered prop is false", () => {
        const { container } = render(<SiteHeader bordered={false} />);
        const header = container.querySelector("header");
        expect(header?.className).not.toContain("border-b");
        expect(header?.className).not.toContain("bg-white/80");
    });

    it("does not apply bordered styles by default", () => {
        const { container } = render(<SiteHeader />);
        const header = container.querySelector("header");
        expect(header?.className).not.toContain("border-b");
    });

    it("renders right content when provided", () => {
        render(<SiteHeader rightContent={<button>Test Button</button>} />);
        expect(screen.getByText("Test Button")).toBeInTheDocument();
    });

    it("does not render user-provided right content when rightContent is not provided", () => {
        const { container } = render(<SiteHeader showThemeSwitcher={false} />);
        const header = container.querySelector("header");
        // Header has 2 children: logo link and right-side wrapper
        // Right-side wrapper should be empty when no rightContent or themeSwitcher
        expect(header?.children.length).toBe(2);
        const rightWrapper = header?.children[1];
        expect(rightWrapper?.children.length).toBe(0);
    });

    it("renders multiple right content elements", () => {
        render(
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
