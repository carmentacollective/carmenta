"use client";

import { LinkPreview } from "@/components/tool-ui/link-preview";
import type { ToolStatus } from "@/lib/tools/tool-config";
import { ToolRenderer } from "../shared";

interface LinkPreviewInput {
    url?: string;
}

interface LinkPreviewOutput {
    href?: string;
    url?: string;
    title?: string;
    description?: string;
    image?: string;
    domain?: string;
    favicon?: string;
}

interface LinkPreviewResultProps {
    toolCallId: string;
    status: ToolStatus;
    toolName: string;
    input?: LinkPreviewInput;
    output?: LinkPreviewOutput;
    error?: string;
}

/**
 * Link preview result component for displaying URL card previews.
 *
 * Shows title, description, image, and domain for linked content.
 */
export function LinkPreviewResult({
    toolCallId,
    status,
    toolName,
    input,
    output,
    error,
}: LinkPreviewResultProps) {
    const href = output?.href || output?.url || input?.url;
    const hasPreview = status === "completed" && output;

    return (
        <ToolRenderer
            toolName={toolName}
            toolCallId={toolCallId}
            status={status}
            input={input as Record<string, unknown>}
            output={output as Record<string, unknown>}
            error={error}
        >
            {hasPreview && (
                <LinkPreview
                    id={`link-preview-${toolCallId}`}
                    href={href ?? ""}
                    title={output.title}
                    description={output.description}
                    image={output.image}
                    domain={output.domain}
                    favicon={output.favicon}
                />
            )}
        </ToolRenderer>
    );
}
