import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import HomePage from "@/app/page";
import { ThemeProvider } from "@/lib/theme";

describe("HomePage (Landing Page)", () => {
    it("renders without errors", () => {
        const { container } = render(
            <ThemeProvider>
                <HomePage />
            </ThemeProvider>
        );
        expect(container).toBeTruthy();
    });
});
