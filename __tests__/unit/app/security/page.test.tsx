import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import SecurityPage, { metadata } from "@/app/security/page";
import { ThemeProvider } from "@/lib/theme";

describe("SecurityPage", () => {
    it("renders without errors", () => {
        const { container } = render(
            <ThemeProvider>
                <SecurityPage />
            </ThemeProvider>
        );
        expect(container).toBeTruthy();
    });

    it("has the expected metadata title", () => {
        expect(metadata.title).toBe("Our Security · Carmenta");
    });
});
