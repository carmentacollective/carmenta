import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import PrivacyPage, { metadata } from "@/app/privacy/page";
import { ThemeProvider } from "@/lib/theme";

describe("PrivacyPage", () => {
    it("renders without errors", () => {
        const { container } = render(
            <ThemeProvider>
                <PrivacyPage />
            </ThemeProvider>
        );
        expect(container).toBeTruthy();
    });

    it("has the expected metadata title", () => {
        expect(metadata.title).toBe("Your Privacy · Carmenta");
    });
});
