import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import SignUpPage, { metadata } from "@/app/sign-up/[[...sign-up]]/page";
import { ThemeProvider } from "@/lib/theme";

// Mock the Clerk SignUp component
vi.mock("@clerk/nextjs", async () => {
    const actual = await vi.importActual("@clerk/nextjs");
    return {
        ...actual,
        SignUp: () => <div data-testid="clerk-signup">SignUp Component</div>,
    };
});

describe("SignUpPage", () => {
    it("renders without errors", () => {
        const { container } = render(
            <ThemeProvider>
                <SignUpPage />
            </ThemeProvider>
        );
        expect(container).toBeTruthy();
    });

    it("has the expected metadata title", () => {
        expect(metadata.title).toBe("Welcome · Carmenta");
    });
});
