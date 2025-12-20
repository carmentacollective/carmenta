"use client";

import { ToolUIErrorBoundary, type ToolUIErrorBoundaryProps } from "../shared";

export function POIMapErrorBoundary(
    props: Omit<ToolUIErrorBoundaryProps, "componentName">
) {
    const { children, ...rest } = props;
    return (
        <ToolUIErrorBoundary componentName="POIMap" {...rest}>
            {children}
        </ToolUIErrorBoundary>
    );
}
