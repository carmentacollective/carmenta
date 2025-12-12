import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import OfflinePage, { metadata } from "@/app/offline/page";
import { ThemeProvider } from "@/lib/theme";

describe("OfflinePage", () => {
    it("renders without errors", () => {
        const { container } = render(
            <ThemeProvider>
                <OfflinePage />
            </ThemeProvider>
        );
        expect(container).toBeTruthy();
    });

    it("has the expected metadata title", () => {
        expect(metadata.title).toBe("Reconnecting · Carmenta");
    });
});
