/**
 * Message Bubbles Tests
 *
 * Tests for the reusable message bubble components: UserBubble, AssistantBubble,
 * and ThinkingBubble. These components are context-agnostic building blocks
 * used by HoloThread, wizard flows, and other chat-like UIs.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import {
    UserBubble,
    AssistantBubble,
    ThinkingBubble,
} from "@/components/chat/message-bubbles";

// Clean up after each test to prevent test pollution
afterEach(() => {
    cleanup();
});

/**
 * Mock framer-motion to avoid animation issues in tests.
 * We're testing content rendering, not animation behavior.
 */
vi.mock("framer-motion", () => ({
    motion: {
        div: ({
            children,
            className,
            initial,
            animate,
            ...props
        }: React.HTMLAttributes<HTMLDivElement> & {
            initial?: unknown;
            animate?: unknown;
        }) => (
            <div className={className} {...props}>
                {children}
            </div>
        ),
        span: ({
            children,
            className,
            ...props
        }: React.HTMLAttributes<HTMLSpanElement>) => (
            <span className={className} {...props}>
                {children}
            </span>
        ),
    },
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

/**
 * Mock Next.js Image component for test environment
 */
vi.mock("next/image", () => ({
    default: ({
        src,
        alt,
        width,
        height,
        className,
        priority,
        ...props
    }: {
        src: string;
        alt: string;
        width?: number;
        height?: number;
        className?: string;
        priority?: boolean;
    } & Record<string, unknown>) => (
        <img
            src={src}
            alt={alt}
            width={width}
            height={height}
            className={className}
            {...props}
        />
    ),
}));

/**
 * Mock Streamdown to avoid complex markdown rendering in unit tests
 */
vi.mock("streamdown", () => ({
    Streamdown: ({
        children,
        mode,
        isAnimating,
    }: {
        children: string;
        mode?: string;
        isAnimating?: boolean;
    }) => (
        <div
            data-testid="streamdown-content"
            data-mode={mode}
            data-animating={String(isAnimating)}
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

describe("UserBubble", () => {
    describe("Basic Rendering", () => {
        it("renders user message content", () => {
            render(<UserBubble content="Hello, Carmenta!" />);

            expect(screen.getByText("Hello, Carmenta!")).toBeInTheDocument();
        });

        it("applies right-aligned layout", () => {
            const { container } = render(<UserBubble content="Test message" />);

            // UserBubble has justify-end class for right alignment
            const wrapper = container.firstChild as HTMLElement;
            expect(wrapper).toHaveClass("justify-end");
        });

        it("applies user-message-bubble styling", () => {
            const { container } = render(<UserBubble content="Test" />);

            const bubble = container.querySelector(".user-message-bubble");
            expect(bubble).toBeInTheDocument();
        });

        it("has right border accent", () => {
            const { container } = render(<UserBubble content="Test" />);

            const bubble = container.querySelector(".user-message-bubble");
            expect(bubble).toHaveClass("border-r-primary");
            expect(bubble).toHaveClass("border-r-[3px]");
        });

        it("preserves whitespace with whitespace-pre-wrap", () => {
            const { container } = render(<UserBubble content={"Line 1\n\nLine 2"} />);

            const paragraph = container.querySelector("p");
            expect(paragraph).toHaveClass("whitespace-pre-wrap");
        });
    });

    describe("Content Types", () => {
        it("renders plain text correctly", () => {
            render(<UserBubble content="Simple plain text message" />);

            expect(screen.getByText("Simple plain text message")).toBeInTheDocument();
        });

        it("renders multiline content", () => {
            const { container } = render(
                <UserBubble content={"First line\nSecond line"} />
            );

            // The content should be in the paragraph, whitespace preserved
            const paragraph = container.querySelector("p");
            expect(paragraph?.textContent).toBe("First line\nSecond line");
        });

        it("renders unicode characters correctly", () => {
            render(<UserBubble content="Hello 👋 世界 🌍" />);

            expect(screen.getByText("Hello 👋 世界 🌍")).toBeInTheDocument();
        });

        it("renders special characters without breaking", () => {
            const specialContent = "HTML entities: <script> & \"quotes\" 'single'";
            render(<UserBubble content={specialContent} />);

            expect(screen.getByText(specialContent)).toBeInTheDocument();
        });

        it("renders long content with max-width constraint", () => {
            const longContent = "x".repeat(1000);
            const { container } = render(<UserBubble content={longContent} />);

            // Should have max-width constraint
            const bubbleWrapper = container.querySelector(".max-w-\\[85\\%\\]");
            expect(bubbleWrapper).toBeInTheDocument();
        });

        it("renders code snippets in text (without markdown parsing)", () => {
            const codeContent = "Try using `const x = 1;` in your code";
            render(<UserBubble content={codeContent} />);

            // UserBubble renders plain text, not markdown
            expect(screen.getByText(codeContent)).toBeInTheDocument();
        });
    });

    describe("Edge Cases", () => {
        it("renders empty string content", () => {
            const { container } = render(<UserBubble content="" />);

            // Should still render the bubble structure
            expect(container.querySelector(".user-message-bubble")).toBeInTheDocument();
        });

        it("renders whitespace content", () => {
            const { container } = render(<UserBubble content="   " />);

            // Content should be present in paragraph
            const paragraph = container.querySelector("p");
            expect(paragraph?.textContent).toBe("   ");
        });

        it("handles extremely long single words", () => {
            const longWord = "a".repeat(500);
            const { container } = render(<UserBubble content={longWord} />);

            expect(container.querySelector("p")).toHaveTextContent(longWord);
        });

        it("handles content with newlines and tabs", () => {
            const content = "Line1\n\tIndented\nLine3";
            const { container } = render(<UserBubble content={content} />);

            const paragraph = container.querySelector("p");
            expect(paragraph?.textContent).toBe(content);
        });
    });

    describe("Custom Styling", () => {
        it("accepts and applies custom className", () => {
            const { container } = render(
                <UserBubble content="Test" className="custom-class" />
            );

            const wrapper = container.firstChild as HTMLElement;
            expect(wrapper).toHaveClass("custom-class");
        });

        it("preserves base classes when adding custom className", () => {
            const { container } = render(
                <UserBubble content="Test" className="custom-class" />
            );

            const wrapper = container.firstChild as HTMLElement;
            expect(wrapper).toHaveClass("flex");
            expect(wrapper).toHaveClass("justify-end");
            expect(wrapper).toHaveClass("custom-class");
        });
    });
});

describe("AssistantBubble", () => {
    describe("Basic Rendering", () => {
        it("renders assistant message content", () => {
            render(<AssistantBubble content="Hello from Carmenta!" />);

            // Content appears in Streamdown mock
            expect(screen.getByTestId("streamdown-content")).toHaveTextContent(
                "Hello from Carmenta!"
            );
        });

        it("applies left-aligned layout (no justify-end)", () => {
            const { container } = render(<AssistantBubble content="Test message" />);

            const wrapper = container.firstChild as HTMLElement;
            expect(wrapper).toHaveClass("flex");
            expect(wrapper).not.toHaveClass("justify-end");
        });

        it("applies assistant-message-bubble styling", () => {
            const { container } = render(<AssistantBubble content="Test" />);

            const bubble = container.querySelector(".assistant-message-bubble");
            expect(bubble).toBeInTheDocument();
        });

        it("has left cyan border accent", () => {
            const { container } = render(<AssistantBubble content="Test" />);

            const bubble = container.querySelector(".assistant-message-bubble");
            expect(bubble).toHaveClass("border-l-cyan-400");
            expect(bubble).toHaveClass("border-l-[3px]");
        });
    });

    describe("Empty Content Handling", () => {
        it("returns null for empty string content", () => {
            const { container } = render(<AssistantBubble content="" />);

            expect(container.firstChild).toBeNull();
        });

        it("returns null for whitespace-only content", () => {
            const { container } = render(<AssistantBubble content="   " />);

            expect(container.firstChild).toBeNull();
        });

        it("returns null for newline-only content", () => {
            const { container } = render(<AssistantBubble content={"\n\n\n"} />);

            expect(container.firstChild).toBeNull();
        });

        it("returns null for tab-only content", () => {
            const { container } = render(<AssistantBubble content={"\t\t\t"} />);

            expect(container.firstChild).toBeNull();
        });

        it("renders content with leading/trailing whitespace that has text", () => {
            render(<AssistantBubble content="  Hello  " />);

            // textContent normalizes whitespace, so verify content is present
            const streamdown = screen.getByTestId("streamdown-content");
            expect(streamdown).toBeInTheDocument();
            expect(streamdown).toHaveTextContent("Hello");
        });
    });

    describe("Streaming State", () => {
        it("passes isAnimating=false to Streamdown by default", () => {
            render(<AssistantBubble content="Test" />);

            const streamdown = screen.getByTestId("streamdown-content");
            expect(streamdown).toHaveAttribute("data-animating", "false");
        });

        it("passes isAnimating=true to Streamdown when streaming", () => {
            render(<AssistantBubble content="Test" isStreaming />);

            const streamdown = screen.getByTestId("streamdown-content");
            expect(streamdown).toHaveAttribute("data-animating", "true");
        });
    });

    describe("Avatar Display", () => {
        it("shows avatar by default", () => {
            const { container } = render(<AssistantBubble content="Test" />);

            // Avatar is rendered with Carmenta alt text
            const avatar = container.querySelector('img[alt="Carmenta"]');
            expect(avatar).toBeInTheDocument();
        });

        it("hides avatar when showAvatar=false", () => {
            const { container } = render(
                <AssistantBubble content="Test" showAvatar={false} />
            );

            const avatar = container.querySelector('img[alt="Carmenta"]');
            expect(avatar).not.toBeInTheDocument();
        });
    });

    describe("Content Types", () => {
        it("renders markdown syntax (via Streamdown)", () => {
            render(<AssistantBubble content="# Heading\n\nParagraph" />);

            const streamdown = screen.getByTestId("streamdown-content");
            expect(streamdown).toHaveTextContent("# Heading");
            expect(streamdown).toHaveTextContent("Paragraph");
        });

        it("renders code blocks in content", () => {
            const codeContent = "```typescript\nconst x = 1;\n```";
            render(<AssistantBubble content={codeContent} />);

            const streamdown = screen.getByTestId("streamdown-content");
            expect(streamdown).toHaveTextContent("const x = 1;");
        });

        it("renders unicode and emoji content", () => {
            render(<AssistantBubble content="Hello 🤖 ありがとう" />);

            expect(screen.getByTestId("streamdown-content")).toHaveTextContent(
                "Hello 🤖 ありがとう"
            );
        });
    });

    describe("Custom Styling", () => {
        it("accepts and applies custom className", () => {
            const { container } = render(
                <AssistantBubble content="Test" className="my-custom-class" />
            );

            const wrapper = container.firstChild as HTMLElement;
            expect(wrapper).toHaveClass("my-custom-class");
        });

        it("preserves base classes with custom className", () => {
            const { container } = render(
                <AssistantBubble content="Test" className="my-custom-class" />
            );

            const wrapper = container.firstChild as HTMLElement;
            expect(wrapper).toHaveClass("flex");
            expect(wrapper).toHaveClass("my-custom-class");
        });
    });
});

describe("ThinkingBubble", () => {
    describe("Basic Rendering", () => {
        it("renders default thinking message", () => {
            render(<ThinkingBubble />);

            expect(screen.getByText("Thinking...")).toBeInTheDocument();
        });

        it("renders custom message when provided", () => {
            render(<ThinkingBubble message="Processing your request..." />);

            expect(screen.getByText("Processing your request...")).toBeInTheDocument();
        });

        it("applies assistant-message-bubble styling", () => {
            const { container } = render(<ThinkingBubble />);

            const bubble = container.querySelector(".assistant-message-bubble");
            expect(bubble).toBeInTheDocument();
        });

        it("has left cyan border accent", () => {
            const { container } = render(<ThinkingBubble />);

            const bubble = container.querySelector(".assistant-message-bubble");
            expect(bubble).toHaveClass("border-l-cyan-400");
            expect(bubble).toHaveClass("border-l-[3px]");
        });
    });

    describe("Avatar Display", () => {
        it("shows avatar by default", () => {
            const { container } = render(<ThinkingBubble />);

            // Avatar has Carmenta alt text
            const avatar = container.querySelector('img[alt="Carmenta"]');
            expect(avatar).toBeInTheDocument();
        });

        it("hides avatar when showAvatar=false", () => {
            const { container } = render(<ThinkingBubble showAvatar={false} />);

            const avatar = container.querySelector('img[alt="Carmenta"]');
            expect(avatar).not.toBeInTheDocument();
        });
    });

    describe("Sparkle Icon", () => {
        it("renders SparkleIcon with pulse animation", () => {
            const { container } = render(<ThinkingBubble />);

            // SparkleIcon should have animate-pulse class
            const icon = container.querySelector(".animate-pulse");
            expect(icon).toBeInTheDocument();
        });
    });

    describe("Custom Messages", () => {
        it("renders empty message string", () => {
            const { container } = render(<ThinkingBubble message="" />);

            // Should still render the bubble structure
            expect(
                container.querySelector(".assistant-message-bubble")
            ).toBeInTheDocument();
        });

        it("renders message with emoji", () => {
            render(<ThinkingBubble message="Analyzing 🔍" />);

            expect(screen.getByText("Analyzing 🔍")).toBeInTheDocument();
        });

        it("renders message with special characters", () => {
            render(<ThinkingBubble message="Processing <data>..." />);

            expect(screen.getByText("Processing <data>...")).toBeInTheDocument();
        });
    });

    describe("Custom Styling", () => {
        it("accepts and applies custom className", () => {
            const { container } = render(
                <ThinkingBubble className="custom-thinking" />
            );

            const wrapper = container.firstChild as HTMLElement;
            expect(wrapper).toHaveClass("custom-thinking");
        });

        it("preserves base classes with custom className", () => {
            const { container } = render(
                <ThinkingBubble className="custom-thinking" />
            );

            const wrapper = container.firstChild as HTMLElement;
            expect(wrapper).toHaveClass("flex");
            expect(wrapper).toHaveClass("custom-thinking");
        });
    });
});

describe("Component Comparisons", () => {
    describe("UserBubble vs AssistantBubble", () => {
        it("UserBubble is right-aligned, AssistantBubble is left-aligned", () => {
            const { container: userContainer } = render(
                <UserBubble content="User message" />
            );
            const { container: assistantContainer } = render(
                <AssistantBubble content="Assistant message" />
            );

            const userWrapper = userContainer.firstChild as HTMLElement;
            const assistantWrapper = assistantContainer.firstChild as HTMLElement;

            expect(userWrapper).toHaveClass("justify-end");
            expect(assistantWrapper).not.toHaveClass("justify-end");
        });

        it("UserBubble has right border, AssistantBubble has left border", () => {
            const { container: userContainer } = render(<UserBubble content="User" />);
            const { container: assistantContainer } = render(
                <AssistantBubble content="Assistant" />
            );

            const userBubble = userContainer.querySelector(".user-message-bubble");
            const assistantBubble = assistantContainer.querySelector(
                ".assistant-message-bubble"
            );

            expect(userBubble).toHaveClass("border-r-[3px]");
            expect(assistantBubble).toHaveClass("border-l-[3px]");
        });

        it("UserBubble renders in <p>, AssistantBubble uses MarkdownRenderer", () => {
            const content = "# Hello";

            const { container: userContainer } = render(
                <UserBubble content={content} />
            );
            const { container: assistantContainer } = render(
                <AssistantBubble content={content} />
            );

            // UserBubble renders in a <p> tag directly
            expect(userContainer.querySelector("p")).toHaveTextContent("# Hello");

            // AssistantBubble uses MarkdownRenderer (which uses Streamdown)
            expect(
                assistantContainer.querySelector('[data-testid="streamdown-content"]')
            ).toBeInTheDocument();
        });

        it("AssistantBubble has avatar, UserBubble does not", () => {
            const { container: userContainer } = render(<UserBubble content="User" />);
            const { container: assistantContainer } = render(
                <AssistantBubble content="Assistant" />
            );

            const userAvatar = userContainer.querySelector('img[alt="Carmenta"]');
            const assistantAvatar =
                assistantContainer.querySelector('img[alt="Carmenta"]');

            expect(userAvatar).not.toBeInTheDocument();
            expect(assistantAvatar).toBeInTheDocument();
        });
    });

    describe("AssistantBubble vs ThinkingBubble", () => {
        it("both show avatar by default", () => {
            const { container: assistantContainer } = render(
                <AssistantBubble content="Test" />
            );
            const { container: thinkingContainer } = render(<ThinkingBubble />);

            const assistantAvatar =
                assistantContainer.querySelector('img[alt="Carmenta"]');
            const thinkingAvatar =
                thinkingContainer.querySelector('img[alt="Carmenta"]');

            expect(assistantAvatar).toBeInTheDocument();
            expect(thinkingAvatar).toBeInTheDocument();
        });

        it("both share same bubble styling class", () => {
            const { container: assistantContainer } = render(
                <AssistantBubble content="Test" />
            );
            const { container: thinkingContainer } = render(<ThinkingBubble />);

            const assistantBubble = assistantContainer.querySelector(
                ".assistant-message-bubble"
            );
            const thinkingBubble = thinkingContainer.querySelector(
                ".assistant-message-bubble"
            );

            expect(assistantBubble).toBeInTheDocument();
            expect(thinkingBubble).toBeInTheDocument();
        });
    });
});

describe("Memoization", () => {
    it("components are wrapped with React.memo", () => {
        // memo() preserves the function name as displayName in development
        // We verify the components exist and are functions (memo returns a new component)
        expect(typeof UserBubble).toBe("object"); // memo wraps as object
        expect(typeof AssistantBubble).toBe("object");
        expect(typeof ThinkingBubble).toBe("object");

        // memo components have a $$typeof Symbol
        expect(UserBubble).toHaveProperty("$$typeof");
        expect(AssistantBubble).toHaveProperty("$$typeof");
        expect(ThinkingBubble).toHaveProperty("$$typeof");
    });
});
