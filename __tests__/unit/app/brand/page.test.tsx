import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import BrandPage from "@/app/brand/page";

describe("BrandPage", () => {
    it("renders without errors", () => {
        const { container } = render(<BrandPage />);
        expect(container).toBeTruthy();
    });
});
