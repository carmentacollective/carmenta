import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import BrandPage from "@/app/brand/page";
import { ThemeVariantProvider } from "@/lib/theme/theme-variant-context";

describe("BrandPage", () => {
    it("renders without errors", () => {
        const { container } = render(
            <ThemeVariantProvider>
                <BrandPage />
            </ThemeVariantProvider>
        );
        expect(container).toBeTruthy();
    });
});
