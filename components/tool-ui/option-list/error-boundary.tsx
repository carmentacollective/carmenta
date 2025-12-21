"use client";

import { ToolUIErrorBoundary, type ToolUIErrorBoundaryProps } from "../shared";

export function OptionListErrorBoundary(
    props: Omit<ToolUIErrorBoundaryProps, "componentName">
) {
    const { children, ...rest } = props;
    return (
        <ToolUIErrorBoundary componentName="OptionList" {...rest}>
            {children}
        </ToolUIErrorBoundary>
    );
}
