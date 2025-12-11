import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import TermsPage, { metadata } from "@/app/terms/page";
import { ThemeProvider } from "@/lib/theme";

describe("TermsPage", () => {
    it("renders without errors", () => {
        const { container } = render(
            <ThemeProvider>
                <TermsPage />
            </ThemeProvider>
        );
        expect(container).toBeTruthy();
    });

    it("has the expected metadata title", () => {
        expect(metadata.title).toBe("Our Partnership · Carmenta");
    });
});
