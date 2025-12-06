import { describe, it, expect, vi, beforeEach } from "vitest";
import {
    copyToClipboard,
    copyMarkdownWithFormats,
    copyMarkdown,
    copyPlainText,
} from "@/lib/copy-utils";

// Mock ClipboardItem
class MockClipboardItem {
    private types: Record<string, Blob>;

    constructor(data: Record<string, Blob>) {
        this.types = data;
    }

    async getType(type: string): Promise<Blob> {
        const blob = this.types[type];
        // Add text() method to Blob for testing
        if (blob && !(blob as any).text) {
            (blob as any).text = async () => {
                const reader = new FileReader();
                return new Promise((resolve) => {
                    reader.onload = () => resolve(reader.result as string);
                    reader.readAsText(blob);
                });
            };
        }
        return blob;
    }
}

// Make ClipboardItem available globally
global.ClipboardItem = MockClipboardItem as any;

// Mock the clipboard API
const mockWriteText = vi.fn();
const mockWrite = vi.fn();
Object.assign(navigator, {
    clipboard: {
        writeText: mockWriteText,
        write: mockWrite,
    },
});

describe("copyToClipboard", () => {
    beforeEach(() => {
        mockWriteText.mockReset();
        mockWriteText.mockResolvedValue(undefined);
        // Ensure clipboard is available for each test
        Object.assign(navigator, {
            clipboard: {
                writeText: mockWriteText,
                write: mockWrite,
            },
        });
    });

    it("successfully copies text to clipboard", async () => {
        const text = "Hello, world!";
        const result = await copyToClipboard(text);

        expect(result).toBe(true);
        expect(mockWriteText).toHaveBeenCalledWith(text);
        expect(mockWriteText).toHaveBeenCalledTimes(1);
    });

    it("copies empty string successfully", async () => {
        const result = await copyToClipboard("");

        expect(result).toBe(true);
        expect(mockWriteText).toHaveBeenCalledWith("");
    });

    it("copies multiline text correctly", async () => {
        const text = `Line 1
Line 2
Line 3`;
        const result = await copyToClipboard(text);

        expect(result).toBe(true);
        expect(mockWriteText).toHaveBeenCalledWith(text);
    });

    it("copies code with special characters", async () => {
        const text = `const regex = /[a-z]+/g;
const obj = { key: "value" };
const template = \`Hello \${name}\`;`;

        const result = await copyToClipboard(text);

        expect(result).toBe(true);
        expect(mockWriteText).toHaveBeenCalledWith(text);
    });

    it("returns false when clipboard API fails", async () => {
        mockWriteText.mockRejectedValueOnce(new Error("Permission denied"));

        const result = await copyToClipboard("test");

        expect(result).toBe(false);
        expect(mockWriteText).toHaveBeenCalled();
    });

    it("handles clipboard API not available", async () => {
        const originalClipboard = navigator.clipboard;

        Object.defineProperty(navigator, "clipboard", {
            value: undefined,
            writable: true,
        });

        const result = await copyToClipboard("test");

        // Should return false when clipboard API is not available
        expect(result).toBe(false);

        // Restore
        Object.defineProperty(navigator, "clipboard", {
            value: originalClipboard,
            writable: true,
        });
    });

    it("copies very long text without issues", async () => {
        const longText = "a".repeat(10000);
        const result = await copyToClipboard(longText);

        expect(result).toBe(true);
        expect(mockWriteText).toHaveBeenCalledWith(longText);
    });

    it("copies text with unicode characters", async () => {
        const text = "Hello 世界 🌍 émoji";
        const result = await copyToClipboard(text);

        expect(result).toBe(true);
        expect(mockWriteText).toHaveBeenCalledWith(text);
    });
});

describe("copyMarkdownWithFormats", () => {
    beforeEach(() => {
        mockWrite.mockReset();
        mockWrite.mockResolvedValue(undefined);
        // Ensure clipboard is available for each test
        Object.assign(navigator, {
            clipboard: {
                writeText: mockWriteText,
                write: mockWrite,
            },
        });
    });

    it("successfully copies markdown with multiple formats", async () => {
        const markdown = "# Hello\n\nThis is **bold** text.";
        const result = await copyMarkdownWithFormats(markdown);

        expect(result).toBe(true);
        expect(mockWrite).toHaveBeenCalledTimes(1);

        // Verify ClipboardItem was created with both formats
        const clipboardItem = mockWrite.mock.calls[0][0][0];
        expect(clipboardItem).toBeInstanceOf(ClipboardItem);
    });

    it("converts markdown to HTML correctly", async () => {
        const markdown = "**bold** and *italic*";
        await copyMarkdownWithFormats(markdown);

        const clipboardItem = mockWrite.mock.calls[0][0][0];
        const htmlBlob = await clipboardItem.getType("text/html");
        const htmlText = await htmlBlob.text();

        // HTML should contain tags, not markdown syntax
        expect(htmlText).toContain("<strong>");
        expect(htmlText).toContain("<em>");
        expect(htmlText).not.toContain("**");
        expect(htmlText).not.toContain("*italic*");
    });

    it("includes plain text markdown in clipboard", async () => {
        const markdown = "# Heading\n\nSome **text**";
        await copyMarkdownWithFormats(markdown);

        const clipboardItem = mockWrite.mock.calls[0][0][0];
        const plainBlob = await clipboardItem.getType("text/plain");
        const plainText = await plainBlob.text();

        // Plain text should be the original markdown
        expect(plainText).toBe(markdown);
    });

    it("handles code blocks in markdown", async () => {
        const markdown = "```typescript\nconst x = 1;\n```";
        const result = await copyMarkdownWithFormats(markdown);

        expect(result).toBe(true);
        expect(mockWrite).toHaveBeenCalled();
    });

    it("returns false when clipboard API fails", async () => {
        mockWrite.mockRejectedValueOnce(new Error("Permission denied"));

        const result = await copyMarkdownWithFormats("test");

        expect(result).toBe(false);
        expect(mockWrite).toHaveBeenCalled();
    });

    it("handles empty markdown", async () => {
        const result = await copyMarkdownWithFormats("");

        expect(result).toBe(true);
        expect(mockWrite).toHaveBeenCalled();
    });

    it("handles markdown with special characters", async () => {
        const markdown = "Hello 世界 🌍\n\n**émoji** test";
        const result = await copyMarkdownWithFormats(markdown);

        expect(result).toBe(true);

        const clipboardItem = mockWrite.mock.calls[0][0][0];
        const plainBlob = await clipboardItem.getType("text/plain");
        const plainText = await plainBlob.text();

        expect(plainText).toContain("世界");
        expect(plainText).toContain("🌍");
        expect(plainText).toContain("émoji");
    });
});

describe("copyMarkdown", () => {
    beforeEach(() => {
        mockWriteText.mockReset();
        mockWriteText.mockResolvedValue(undefined);
        Object.assign(navigator, {
            clipboard: {
                writeText: mockWriteText,
                write: mockWrite,
            },
        });
    });

    it("copies markdown syntax as plain text", async () => {
        const markdown = "## Heading\n\nThis is **bold**";
        const result = await copyMarkdown(markdown);

        expect(result).toBe(true);
        expect(mockWriteText).toHaveBeenCalledWith(markdown);
    });

    it("handles code blocks in markdown", async () => {
        const markdown = "```typescript\nconst x = 1;\n```";
        const result = await copyMarkdown(markdown);

        expect(result).toBe(true);
        expect(mockWriteText).toHaveBeenCalledWith(markdown);
    });

    it("returns false on error", async () => {
        mockWriteText.mockRejectedValueOnce(new Error("Failed"));
        const result = await copyMarkdown("test");

        expect(result).toBe(false);
    });
});

describe("copyPlainText", () => {
    beforeEach(() => {
        mockWriteText.mockReset();
        mockWriteText.mockResolvedValue(undefined);
        Object.assign(navigator, {
            clipboard: {
                writeText: mockWriteText,
                write: mockWrite,
            },
        });

        // Mock document.createElement for DOM manipulation
        if (typeof document === "undefined") {
            (global as any).document = {};
        }

        (document as any).createElement = vi.fn((tagName: string) => {
            const element = {
                innerHTML: "",
                textContent: "",
            } as any;

            // When innerHTML is set, simulate text extraction
            Object.defineProperty(element, "innerHTML", {
                set(html: string) {
                    // Simple HTML to text conversion for tests
                    element.textContent = html
                        .replace(/<[^>]+>/g, " ") // Remove HTML tags
                        .replace(/\s+/g, " ") // Normalize whitespace
                        .trim();
                },
                get() {
                    return element._innerHTML || "";
                },
            });

            return element;
        });
    });

    it("strips markdown formatting", async () => {
        const markdown = "This is **bold** and *italic*";
        const result = await copyPlainText(markdown);

        expect(result).toBe(true);

        const copiedText = mockWriteText.mock.calls[0][0];
        expect(copiedText).not.toContain("**");
        expect(copiedText).not.toContain("*");
        expect(copiedText).toContain("bold");
        expect(copiedText).toContain("italic");
    });

    it("removes heading markers", async () => {
        const markdown = "# Heading\n\nSome text";
        const result = await copyPlainText(markdown);

        expect(result).toBe(true);

        const copiedText = mockWriteText.mock.calls[0][0];
        expect(copiedText).not.toContain("#");
        expect(copiedText).toContain("Heading");
        expect(copiedText).toContain("Some text");
    });

    it("removes code block syntax", async () => {
        const markdown = "```typescript\nconst x = 1;\n```";
        const result = await copyPlainText(markdown);

        expect(result).toBe(true);

        const copiedText = mockWriteText.mock.calls[0][0];
        expect(copiedText).not.toContain("```");
        expect(copiedText).not.toContain("typescript");
        expect(copiedText).toContain("const x = 1");
    });

    it("returns false on error", async () => {
        mockWriteText.mockRejectedValueOnce(new Error("Failed"));
        const result = await copyPlainText("test");

        expect(result).toBe(false);
    });
});
