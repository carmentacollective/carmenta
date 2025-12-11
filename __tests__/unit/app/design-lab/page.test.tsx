import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import DesignLabIndex from "@/app/design-lab/page";
import { ThemeProvider } from "@/lib/theme";

describe("DesignLabIndex", () => {
    it("renders without errors", () => {
        const { container } = render(
            <ThemeProvider>
                <DesignLabIndex />
            </ThemeProvider>
        );
        expect(container).toBeTruthy();
    });
});
