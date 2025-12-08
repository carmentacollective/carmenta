import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MarkdownRenderer } from "./markdown-renderer";

describe("MarkdownRenderer", () => {
	describe("Basic Markdown", () => {
		it("renders paragraphs", () => {
			render(<MarkdownRenderer content="Hello world" />);
			expect(screen.getByText("Hello world")).toBeInTheDocument();
		});

		it("renders headings", () => {
			render(
				<MarkdownRenderer content="# Heading 1\n## Heading 2\n### Heading 3" />
			);
			expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
				"Heading 1"
			);
			expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
				"Heading 2"
			);
			expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent(
				"Heading 3"
			);
		});

		it("renders bold and italic", () => {
			render(<MarkdownRenderer content="**bold** and *italic*" />);
			expect(screen.getByText("bold")).toBeInTheDocument();
			expect(screen.getByText("italic")).toBeInTheDocument();
		});

		it("renders lists", () => {
			const content = `
- Item 1
- Item 2
- Item 3

1. First
2. Second
3. Third
`;
			render(<MarkdownRenderer content={content} />);
			expect(screen.getByText("Item 1")).toBeInTheDocument();
			expect(screen.getByText("First")).toBeInTheDocument();
		});

		it("renders links", () => {
			render(<MarkdownRenderer content="[Google](https://google.com)" />);
			const link = screen.getByRole("link", { name: "Google" });
			expect(link).toHaveAttribute("href", "https://google.com");
		});

		it("renders blockquotes", () => {
			render(<MarkdownRenderer content="> This is a quote" />);
			expect(screen.getByText("This is a quote")).toBeInTheDocument();
		});

		it("renders horizontal rule", () => {
			const { container } = render(<MarkdownRenderer content="---" />);
			expect(container.querySelector("hr")).toBeInTheDocument();
		});
	});

	describe("Code Blocks", () => {
		it("renders inline code", () => {
			render(<MarkdownRenderer content="Here is some `inline code`" />);
			expect(screen.getByText("inline code")).toBeInTheDocument();
		});

		it("renders code blocks", () => {
			const content = "```\nconst x = 42;\n```";
			const { container } = render(<MarkdownRenderer content={content} />);
			expect(container.querySelector("pre")).toBeInTheDocument();
			expect(container.querySelector("code")).toBeInTheDocument();
		});

		it("renders code blocks with language", () => {
			const content = "```typescript\nconst x: number = 42;\n```";
			const { container } = render(<MarkdownRenderer content={content} />);
			expect(container.querySelector("pre")).toBeInTheDocument();
		});
	});

	describe("GitHub Flavored Markdown", () => {
		it("renders simple tables", () => {
			const content = `
| Header 1 | Header 2 |
|----------|----------|
| Cell 1   | Cell 2   |
| Cell 3   | Cell 4   |
`;
			const { container } = render(<MarkdownRenderer content={content} />);
			expect(container.querySelector("table")).toBeInTheDocument();
			expect(screen.getByText("Header 1")).toBeInTheDocument();
			expect(screen.getByText("Cell 1")).toBeInTheDocument();
		});

		it("renders tables with alignment", () => {
			const content = `
| Left | Center | Right |
|:-----|:------:|------:|
| L1   | C1     | R1    |
| L2   | C2     | R2    |
`;
			const { container } = render(<MarkdownRenderer content={content} />);
			expect(container.querySelector("table")).toBeInTheDocument();
			expect(screen.getByText("Left")).toBeInTheDocument();
		});

		it("renders strikethrough", () => {
			render(
				<MarkdownRenderer content="This is ~~deleted~~ text" />
			);
			const strikethrough = screen.getByText("deleted");
			expect(strikethrough.parentElement?.tagName).toBe("DEL");
		});

		it("renders task lists", () => {
			const content = `
- [x] Completed task
- [ ] Incomplete task
`;
			const { container } = render(
				<MarkdownRenderer content={content} />
			);
			expect(container.querySelectorAll("input[type='checkbox']")).toHaveLength(2);
		});
	});

	describe("Table Styling", () => {
		it("wraps tables in scrollable container", () => {
			const content = `
| Col1 | Col2 | Col3 | Col4 | Col5 |
|------|------|------|------|------|
| A    | B    | C    | D    | E    |
`;
			const { container } = render(
				<MarkdownRenderer content={content} />
			);
			const wrapper = container.querySelector(".scrollbar-holo");
			expect(wrapper).toBeInTheDocument();
			expect(wrapper).toHaveClass("overflow-x-auto");
		});

		it("applies table styling classes", () => {
			const content = `
| Header |
|--------|
| Data   |
`;
			const { container } = render(
				<MarkdownRenderer content={content} />
			);
			expect(container.querySelector("table")).toBeInTheDocument();
		});
	});

	describe("Memoization", () => {
		it("renders with memoization (does not error)", () => {
			const { rerender } = render(
				<MarkdownRenderer content="# Test" />
			);
			expect(screen.getByRole("heading")).toBeInTheDocument();

			// Re-render with same content
			rerender(<MarkdownRenderer content="# Test" />);
			expect(screen.getByRole("heading")).toBeInTheDocument();
		});

		it("updates when content changes", () => {
			const { rerender } = render(
				<MarkdownRenderer content="# First" />
			);
			expect(screen.getByText("First")).toBeInTheDocument();

			rerender(<MarkdownRenderer content="# Second" />);
			expect(screen.getByText("Second")).toBeInTheDocument();
		});
	});

	describe("Complex Content", () => {
		it("renders mixed markdown content", () => {
			const content = `
# Title

Here's a paragraph with **bold** and *italic* text.

- List item 1
- List item 2

\`\`\`typescript
const greeting = "Hello, Markdown!";
\`\`\`

| Type | Example |
|------|---------|
| Code | \`const x = 42;\` |
| Link | [Carmenta](https://carmenta.ai) |

> A thoughtful quote

[Learn more](https://example.com)
`;
			const { container } = render(
				<MarkdownRenderer content={content} />
			);
			expect(screen.getByRole("heading")).toBeInTheDocument();
			expect(container.querySelector("table")).toBeInTheDocument();
			expect(container.querySelector("pre")).toBeInTheDocument();
		});
	});

	describe("Edge Cases", () => {
		it("renders empty content", () => {
			const { container } = render(<MarkdownRenderer content="" />);
			expect(container.querySelector(".holo-markdown")).toBeInTheDocument();
		});

		it("handles whitespace-only content", () => {
			const { container } = render(
				<MarkdownRenderer content="   \n\n   " />
			);
			expect(container.querySelector(".holo-markdown")).toBeInTheDocument();
		});

		it("applies custom className", () => {
			const { container } = render(
				<MarkdownRenderer content="Test" className="custom-class" />
			);
			const wrapper = container.querySelector(".holo-markdown");
			expect(wrapper).toHaveClass("custom-class");
		});

		it("renders with special characters", () => {
			render(
				<MarkdownRenderer content="Special chars: `<>&\"'`" />
			);
			expect(screen.getByText("Special chars:")).toBeInTheDocument();
		});
	});
});
