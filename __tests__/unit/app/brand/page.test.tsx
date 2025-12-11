import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import BrandPage from "@/app/brand/page";
import { ThemeProvider } from "@/lib/theme";

describe("BrandPage", () => {
    it("renders without errors", () => {
        const { container } = render(
            <ThemeProvider>
                <BrandPage />
            </ThemeProvider>
        );
        expect(container).toBeTruthy();
    });
});
