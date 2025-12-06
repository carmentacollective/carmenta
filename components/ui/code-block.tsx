"use client";

import { type ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { CopyButton } from "./copy-button";

interface CodeBlockProps extends ComponentProps<"code"> {
    /**
     * Inline code vs code block (passed by ReactMarkdown)
     */
    inline?: boolean;
}

/**
 * Code block component with syntax highlighting and copy button
 *
 * Renders inline code as simple styled text, and code blocks with
 * a copy button in the top-right corner. The copy button copies
 * just the code content without language identifiers or backticks.
 *
 * Integrates with ReactMarkdown's component override system.
 */
export function CodeBlock({ children, className, inline, ...props }: CodeBlockProps) {
    // Extract language from className (ReactMarkdown sets className="language-{lang}")
    const language = className?.replace(/language-/, "") || "";
    const codeContent = String(children).replace(/\n$/, ""); // Remove trailing newline

    // Inline code - simple styled span
    if (inline) {
        return (
            <code
                className={cn(
                    "rounded bg-foreground/10 px-1.5 py-0.5 font-mono text-sm",
                    className
                )}
                {...props}
            >
                {children}
            </code>
        );
    }

    // Code block with copy button
    return (
        <div className="group relative my-4">
            <div className="overflow-x-auto rounded-lg border border-foreground/10 bg-foreground/5">
                {/* Language label */}
                {language && (
                    <div className="border-b border-foreground/10 px-4 py-2 text-xs text-foreground/60">
                        {language}
                    </div>
                )}

                {/* Code content */}
                <pre className="p-4">
                    <code className={cn("font-mono text-sm", className)} {...props}>
                        {codeContent}
                    </code>
                </pre>
            </div>

            {/* Copy button - appears on hover */}
            <div className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100">
                <CopyButton
                    text={codeContent}
                    ariaLabel={`Copy ${language || "code"}`}
                    variant="glass"
                    size="sm"
                />
            </div>
        </div>
    );
}
