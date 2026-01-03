import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { DeepResearchResult } from "@/components/tools/research/deep-research";

// Mock framer-motion to avoid animation issues in tests
vi.mock("framer-motion", () => ({
    motion: {
        div: ({ children, ...props }: React.PropsWithChildren<object>) => (
            <div {...props}>{children}</div>
        ),
        p: ({ children, ...props }: React.PropsWithChildren<object>) => (
            <p {...props}>{children}</p>
        ),
    },
    AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

describe("DeepResearchResult", () => {
    describe("when status is running", () => {
        it("renders loading state with valid depth", () => {
            render(
                <DeepResearchResult
                    toolCallId="test-123"
                    status="running"
                    objective="Find best restaurants"
                    depth="standard"
                />
            );

            expect(screen.getByText(/conducting.*research/i)).toBeInTheDocument();
        });

        it("handles undefined depth gracefully", () => {
            // When AI doesn't provide depth, it's undefined - default should apply
            const { container } = render(
                <DeepResearchResult
                    toolCallId="test-123"
                    status="running"
                    objective="Find best restaurants"
                    depth={undefined}
                />
            );

            // Should render without crashing
            expect(container.textContent).toContain("research");
        });

        it("renders with each valid depth", () => {
            const depths = ["quick", "standard", "deep"] as const;
            for (const depth of depths) {
                const { container, unmount } = render(
                    <DeepResearchResult
                        toolCallId="test-123"
                        status="running"
                        objective="Find best restaurants"
                        depth={depth}
                    />
                );
                expect(container.textContent).toContain("research");
                unmount();
            }
        });
    });

    describe("when status is completed", () => {
        it("renders summary and findings", () => {
            render(
                <DeepResearchResult
                    toolCallId="test-123"
                    status="completed"
                    objective="Find best restaurants"
                    summary="Here are the best restaurants"
                    findings={[
                        {
                            insight: "Restaurant A is great",
                            sources: ["source1"],
                            confidence: "high",
                        },
                    ]}
                />
            );

            expect(screen.getByText("Research Complete")).toBeInTheDocument();
            expect(
                screen.getByText("Here are the best restaurants")
            ).toBeInTheDocument();
        });
    });

    describe("when status is error", () => {
        it("renders error message", () => {
            render(
                <DeepResearchResult
                    toolCallId="test-123"
                    status="error"
                    objective="Find best restaurants"
                    error="Something went wrong"
                />
            );

            expect(screen.getByText("Something went wrong")).toBeInTheDocument();
        });
    });
});
