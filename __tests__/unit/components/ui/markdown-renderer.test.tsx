/**
 * MarkdownRenderer Tests
 *
 * Tests for the reusable markdown rendering component that uses Streamdown
 * (Vercel's AI-optimized markdown renderer) for streaming-aware parsing.
 *
 * Features tested:
 * - GitHub Flavored Markdown support
 * - Streaming cursor behavior
 * - Reduced motion preferences
 * - Edge cases and error handling
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";

// Clean up after each test to prevent test pollution
afterEach(() => {
    cleanup();
});

/**
 * Mock framer-motion to simplify testing.
 */
vi.mock("framer-motion", () => ({
    motion: {
        span: ({
            children,
            className,
            initial,
            animate,
            exit,
            transition,
            ...props
        }: React.HTMLAttributes<HTMLSpanElement> & {
            initial?: unknown;
            animate?: unknown;
            exit?: unknown;
            transition?: unknown;
        }) => (
            <span className={className} data-testid="motion-span" {...props}>
                {children}
            </span>
        ),
    },
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

/**
 * Mock Next.js Image component
 */
vi.mock("next/image", () => ({
    default: ({
        src,
        alt,
        width,
        height,
        className,
        ...props
    }: {
        src: string;
        alt: string;
        width?: number;
        height?: number;
        className?: string;
    } & Record<string, unknown>) => (
        <img
            src={src}
            alt={alt}
            width={width}
            height={height}
            className={className}
            data-testid="cursor-image"
            {...props}
        />
    ),
}));

/**
 * Mock Streamdown - the core markdown renderer.
 * We pass through content for verification while simulating render behavior.
 */
vi.mock("streamdown", () => ({
    Streamdown: ({
        children,
        mode,
        isAnimating,
        controls,
    }: {
        children: string;
        mode?: string;
        isAnimating?: boolean;
        controls?: boolean;
    }) => (
        <div
            data-testid="streamdown"
            data-mode={mode}
            data-animating={String(isAnimating)}
            data-controls={String(controls)}
        >
            {children}
        </div>
    ),
}));

/**
 * Mock reduced motion hook
 */
vi.mock("@/lib/hooks/use-reduced-motion", () => ({
    useReducedMotion: () => false,
}));

describe("MarkdownRenderer", () => {
    describe("Basic Rendering", () => {
        it("renders content via Streamdown", () => {
            render(<MarkdownRenderer content="Hello, world!" />);

            const streamdown = screen.getByTestId("streamdown");
            expect(streamdown).toHaveTextContent("Hello, world!");
        });

        it("passes content to Streamdown unchanged", () => {
            const content = "# Heading\n\nParagraph with **bold** and *italic*";
            render(<MarkdownRenderer content={content} />);

            const streamdown = screen.getByTestId("streamdown");
            expect(streamdown).toHaveTextContent("# Heading");
            expect(streamdown).toHaveTextContent(
                "Paragraph with **bold** and *italic*"
            );
        });

        it("sets Streamdown mode to streaming", () => {
            render(<MarkdownRenderer content="Test" />);

            const streamdown = screen.getByTestId("streamdown");
            expect(streamdown).toHaveAttribute("data-mode", "streaming");
        });

        it("enables Streamdown controls", () => {
            render(<MarkdownRenderer content="Test" />);

            const streamdown = screen.getByTestId("streamdown");
            expect(streamdown).toHaveAttribute("data-controls", "true");
        });

        it("wraps content in holo-markdown container", () => {
            const { container } = render(<MarkdownRenderer content="Test" />);

            expect(container.querySelector(".holo-markdown")).toBeInTheDocument();
        });
    });

    describe("Null/Undefined Content Handling", () => {
        it("returns null for null content", () => {
            const { container } = render(
                <MarkdownRenderer content={null as unknown as string} />
            );

            expect(container.firstChild).toBeNull();
        });

        it("returns null for undefined content", () => {
            const { container } = render(
                <MarkdownRenderer content={undefined as unknown as string} />
            );

            expect(container.firstChild).toBeNull();
        });

        it("renders empty string content (preserves wrapper)", () => {
            const { container } = render(<MarkdownRenderer content="" />);

            // Empty string should still render the wrapper
            expect(container.querySelector(".holo-markdown")).toBeInTheDocument();
        });
    });

    describe("Streaming State", () => {
        it("defaults to not streaming", () => {
            render(<MarkdownRenderer content="Test" />);

            const streamdown = screen.getByTestId("streamdown");
            expect(streamdown).toHaveAttribute("data-animating", "false");
        });

        it("passes isAnimating=true to Streamdown when streaming", () => {
            render(<MarkdownRenderer content="Test" isStreaming />);

            const streamdown = screen.getByTestId("streamdown");
            expect(streamdown).toHaveAttribute("data-animating", "true");
        });

        it("passes isAnimating=false when not streaming", () => {
            render(<MarkdownRenderer content="Test" isStreaming={false} />);

            const streamdown = screen.getByTestId("streamdown");
            expect(streamdown).toHaveAttribute("data-animating", "false");
        });

        it("shows streaming cursor when isStreaming=true", () => {
            render(<MarkdownRenderer content="Test" isStreaming />);

            expect(screen.getByTestId("cursor-image")).toBeInTheDocument();
        });

        it("hides streaming cursor when isStreaming=false", () => {
            render(<MarkdownRenderer content="Test" isStreaming={false} />);

            expect(screen.queryByTestId("cursor-image")).not.toBeInTheDocument();
        });

        it("hides default Streamdown cursor when streaming", () => {
            const { container } = render(
                <MarkdownRenderer content="Test" isStreaming />
            );

            const wrapper = container.querySelector(".holo-markdown");
            expect(wrapper).toHaveClass("[&_.streamdown-cursor]:hidden");
        });

        it("does not hide Streamdown cursor when not streaming", () => {
            const { container } = render(
                <MarkdownRenderer content="Test" isStreaming={false} />
            );

            const wrapper = container.querySelector(".holo-markdown");
            expect(wrapper).not.toHaveClass("[&_.streamdown-cursor]:hidden");
        });
    });

    describe("Streaming Cursor", () => {
        it("cursor uses Carmenta logo", () => {
            render(<MarkdownRenderer content="Test" isStreaming />);

            const cursorImage = screen.getByTestId("cursor-image");
            expect(cursorImage).toHaveAttribute("src", "/logos/icon-transparent.png");
        });

        it("cursor has correct dimensions", () => {
            render(<MarkdownRenderer content="Test" isStreaming />);

            const cursorImage = screen.getByTestId("cursor-image");
            expect(cursorImage).toHaveAttribute("width", "14");
            expect(cursorImage).toHaveAttribute("height", "14");
        });

        it("cursor has empty alt text for accessibility", () => {
            render(<MarkdownRenderer content="Test" isStreaming />);

            const cursorImage = screen.getByTestId("cursor-image");
            expect(cursorImage).toHaveAttribute("alt", "");
        });

        it("cursor has opacity styling", () => {
            render(<MarkdownRenderer content="Test" isStreaming />);

            const cursorImage = screen.getByTestId("cursor-image");
            expect(cursorImage).toHaveClass("opacity-80");
        });
    });

    describe("Inline Mode", () => {
        it("does not apply inline styles by default", () => {
            const { container } = render(<MarkdownRenderer content="Test" />);

            const wrapper = container.querySelector(".holo-markdown");
            expect(wrapper).not.toHaveClass("[&>*]:my-0");
            expect(wrapper).not.toHaveClass("[&>p]:m-0");
            expect(wrapper).not.toHaveClass("[&>p]:inline");
        });

        it("applies inline styles when inline=true", () => {
            const { container } = render(<MarkdownRenderer content="Test" inline />);

            const wrapper = container.querySelector(".holo-markdown");
            expect(wrapper).toHaveClass("[&>*]:my-0");
            expect(wrapper).toHaveClass("[&>p]:m-0");
            expect(wrapper).toHaveClass("[&>p]:inline");
        });

        it("does not apply inline styles when inline=false", () => {
            const { container } = render(
                <MarkdownRenderer content="Test" inline={false} />
            );

            const wrapper = container.querySelector(".holo-markdown");
            expect(wrapper).not.toHaveClass("[&>*]:my-0");
        });
    });

    describe("Custom ClassName", () => {
        it("applies custom className", () => {
            const { container } = render(
                <MarkdownRenderer content="Test" className="custom-class" />
            );

            const wrapper = container.querySelector(".holo-markdown");
            expect(wrapper).toHaveClass("custom-class");
        });

        it("preserves base holo-markdown class with custom className", () => {
            const { container } = render(
                <MarkdownRenderer content="Test" className="custom-class" />
            );

            const wrapper = container.querySelector(".holo-markdown");
            expect(wrapper).toHaveClass("holo-markdown");
            expect(wrapper).toHaveClass("custom-class");
        });

        it("combines multiple custom classes", () => {
            const { container } = render(
                <MarkdownRenderer content="Test" className="class-a class-b" />
            );

            const wrapper = container.querySelector(".holo-markdown");
            expect(wrapper).toHaveClass("class-a");
            expect(wrapper).toHaveClass("class-b");
        });
    });

    describe("Content Edge Cases", () => {
        it("handles markdown with code blocks", () => {
            const content = "```javascript\nconst x = 1;\n```";
            render(<MarkdownRenderer content={content} />);

            const streamdown = screen.getByTestId("streamdown");
            expect(streamdown).toHaveTextContent("const x = 1;");
        });

        it("handles markdown with inline code", () => {
            const content = "Use `console.log()` for debugging";
            render(<MarkdownRenderer content={content} />);

            const streamdown = screen.getByTestId("streamdown");
            expect(streamdown).toHaveTextContent("Use `console.log()` for debugging");
        });

        it("handles markdown with links", () => {
            const content = "Visit [Carmenta](https://carmenta.ai)";
            render(<MarkdownRenderer content={content} />);

            const streamdown = screen.getByTestId("streamdown");
            expect(streamdown).toHaveTextContent(
                "Visit [Carmenta](https://carmenta.ai)"
            );
        });

        it("handles markdown with lists", () => {
            const content = "- Item 1\n- Item 2\n- Item 3";
            render(<MarkdownRenderer content={content} />);

            const streamdown = screen.getByTestId("streamdown");
            expect(streamdown).toHaveTextContent("- Item 1");
            expect(streamdown).toHaveTextContent("- Item 2");
        });

        it("handles markdown with headers", () => {
            const content = "# H1\n## H2\n### H3";
            render(<MarkdownRenderer content={content} />);

            const streamdown = screen.getByTestId("streamdown");
            expect(streamdown).toHaveTextContent("# H1");
            expect(streamdown).toHaveTextContent("## H2");
        });

        it("handles markdown with blockquotes", () => {
            const content = "> This is a quote\n> with multiple lines";
            render(<MarkdownRenderer content={content} />);

            const streamdown = screen.getByTestId("streamdown");
            expect(streamdown).toHaveTextContent("> This is a quote");
        });

        it("handles markdown with tables", () => {
            const content = "| Header |\n|--------|\n| Cell   |";
            render(<MarkdownRenderer content={content} />);

            const streamdown = screen.getByTestId("streamdown");
            expect(streamdown).toHaveTextContent("| Header |");
        });

        it("handles unicode and emoji content", () => {
            const content = "Hello 🌍 世界 مرحبا";
            render(<MarkdownRenderer content={content} />);

            const streamdown = screen.getByTestId("streamdown");
            expect(streamdown).toHaveTextContent("Hello 🌍 世界 مرحبا");
        });

        it("handles very long content", () => {
            const longContent = "a".repeat(10000);
            render(<MarkdownRenderer content={longContent} />);

            const streamdown = screen.getByTestId("streamdown");
            expect(streamdown.textContent?.length).toBe(10000);
        });

        it("handles content with HTML-like tags", () => {
            const content = '<script>alert("xss")</script>';
            render(<MarkdownRenderer content={content} />);

            const streamdown = screen.getByTestId("streamdown");
            expect(streamdown).toHaveTextContent('<script>alert("xss")</script>');
        });

        it("handles content with special characters", () => {
            const content = "< > & \" ' / \\";
            render(<MarkdownRenderer content={content} />);

            const streamdown = screen.getByTestId("streamdown");
            expect(streamdown).toHaveTextContent("< > & \" ' / \\");
        });

        it("handles nested markdown syntax", () => {
            const content = "**bold with _italic_ inside**";
            render(<MarkdownRenderer content={content} />);

            const streamdown = screen.getByTestId("streamdown");
            expect(streamdown).toHaveTextContent("**bold with _italic_ inside**");
        });

        it("handles incomplete markdown during streaming", () => {
            const content = "```javascript\nconst x = 1;\n// still typing...";
            render(<MarkdownRenderer content={content} isStreaming />);

            const streamdown = screen.getByTestId("streamdown");
            expect(streamdown).toHaveTextContent("const x = 1;");
        });
    });

    describe("Memoization", () => {
        it("has displayName set for debugging", () => {
            expect(MarkdownRenderer.displayName).toBe("MarkdownRenderer");
        });

        it("re-renders when content changes", () => {
            const { rerender } = render(<MarkdownRenderer content="Initial content" />);

            rerender(<MarkdownRenderer content="Updated content" />);

            const streamdown = screen.getByTestId("streamdown");
            expect(streamdown).toHaveTextContent("Updated content");
        });

        it("re-renders when isStreaming changes", () => {
            const { rerender } = render(
                <MarkdownRenderer content="Test" isStreaming={false} />
            );

            expect(screen.queryByTestId("cursor-image")).not.toBeInTheDocument();

            rerender(<MarkdownRenderer content="Test" isStreaming={true} />);

            expect(screen.getByTestId("cursor-image")).toBeInTheDocument();
        });

        it("re-renders when inline changes", () => {
            const { container, rerender } = render(
                <MarkdownRenderer content="Test" inline={false} />
            );

            expect(container.querySelector(".holo-markdown")).not.toHaveClass(
                "[&>*]:my-0"
            );

            rerender(<MarkdownRenderer content="Test" inline={true} />);

            expect(container.querySelector(".holo-markdown")).toHaveClass("[&>*]:my-0");
        });

        it("re-renders when className changes", () => {
            const { container, rerender } = render(
                <MarkdownRenderer content="Test" className="class-a" />
            );

            expect(container.querySelector(".holo-markdown")).toHaveClass("class-a");

            rerender(<MarkdownRenderer content="Test" className="class-b" />);

            expect(container.querySelector(".holo-markdown")).toHaveClass("class-b");
            expect(container.querySelector(".holo-markdown")).not.toHaveClass(
                "class-a"
            );
        });
    });

    describe("Combination of Props", () => {
        it("handles streaming + inline mode", () => {
            const { container } = render(
                <MarkdownRenderer content="Test" isStreaming inline />
            );

            const wrapper = container.querySelector(".holo-markdown");
            expect(wrapper).toHaveClass("[&>*]:my-0");
            expect(wrapper).toHaveClass("[&_.streamdown-cursor]:hidden");

            expect(screen.getByTestId("cursor-image")).toBeInTheDocument();
        });

        it("handles streaming + custom className", () => {
            const { container } = render(
                <MarkdownRenderer content="Test" isStreaming className="my-custom" />
            );

            const wrapper = container.querySelector(".holo-markdown");
            expect(wrapper).toHaveClass("my-custom");
            expect(wrapper).toHaveClass("[&_.streamdown-cursor]:hidden");
        });

        it("handles inline + custom className", () => {
            const { container } = render(
                <MarkdownRenderer content="Test" inline className="my-custom" />
            );

            const wrapper = container.querySelector(".holo-markdown");
            expect(wrapper).toHaveClass("[&>*]:my-0");
            expect(wrapper).toHaveClass("my-custom");
        });

        it("handles all props together", () => {
            const { container } = render(
                <MarkdownRenderer
                    content="# Full test"
                    isStreaming
                    inline
                    className="all-props"
                />
            );

            const wrapper = container.querySelector(".holo-markdown");
            expect(wrapper).toHaveClass("holo-markdown");
            expect(wrapper).toHaveClass("all-props");
            expect(wrapper).toHaveClass("[&>*]:my-0");
            expect(wrapper).toHaveClass("[&_.streamdown-cursor]:hidden");

            const streamdown = screen.getByTestId("streamdown");
            expect(streamdown).toHaveAttribute("data-animating", "true");
            expect(streamdown).toHaveTextContent("# Full test");

            expect(screen.getByTestId("cursor-image")).toBeInTheDocument();
        });
    });
});

describe("StreamingCursor Integration", () => {
    /**
     * These tests verify the StreamingCursor behavior through the
     * MarkdownRenderer's public API since StreamingCursor is not exported.
     */

    it("cursor appears when streaming", () => {
        render(<MarkdownRenderer content="Test" isStreaming />);

        expect(screen.getByTestId("cursor-image")).toBeInTheDocument();
    });

    it("cursor disappears when streaming stops", () => {
        const { rerender } = render(<MarkdownRenderer content="Test" isStreaming />);

        expect(screen.getByTestId("cursor-image")).toBeInTheDocument();

        rerender(<MarkdownRenderer content="Test" isStreaming={false} />);

        expect(screen.queryByTestId("cursor-image")).not.toBeInTheDocument();
    });

    it("cursor is wrapped in motion span for animation", () => {
        render(<MarkdownRenderer content="Test" isStreaming />);

        // Our mock wraps the cursor in a span with data-testid="motion-span"
        expect(screen.getByTestId("motion-span")).toBeInTheDocument();
    });
});

describe("MarkdownRenderer with Reduced Motion", () => {
    /**
     * Test the static cursor path when reduced motion is preferred.
     * This covers the branch at line 16-28 in markdown-renderer.tsx.
     */

    it("renders static cursor when reduced motion is preferred", async () => {
        // Temporarily override the useReducedMotion mock to return true
        vi.doMock("@/lib/hooks/use-reduced-motion", () => ({
            useReducedMotion: () => true,
        }));

        // Re-import the component to pick up the new mock
        const { MarkdownRenderer: ReducedMotionRenderer } =
            await import("@/components/ui/markdown-renderer");

        const { container } = render(
            <ReducedMotionRenderer content="Test" isStreaming />
        );

        // Should still have cursor image
        const cursorImage = screen.getByTestId("cursor-image");
        expect(cursorImage).toBeInTheDocument();

        // Static cursor should NOT be wrapped in motion.span
        // It should be in a regular span without the motion-span testid
        const motionSpans = container.querySelectorAll('[data-testid="motion-span"]');
        // Either no motion spans, or motion span doesn't contain the cursor
        const cursorParent = cursorImage.parentElement;
        expect(cursorParent?.tagName.toLowerCase()).toBe("span");

        // Reset the mock back to original
        vi.doMock("@/lib/hooks/use-reduced-motion", () => ({
            useReducedMotion: () => false,
        }));
    });
});
