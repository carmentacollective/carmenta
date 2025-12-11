import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import AIFirstDevelopmentPage, { metadata } from "@/app/ai-first-development/page";
import { ThemeProvider } from "@/lib/theme";

describe("AIFirstDevelopmentPage", () => {
    it("renders without errors", () => {
        const { container } = render(
            <ThemeProvider>
                <AIFirstDevelopmentPage />
            </ThemeProvider>
        );
        expect(container).toBeTruthy();
    });

    it("has the expected metadata title", () => {
        expect(metadata.title).toBe("AI-First Development | Carmenta");
    });
});
