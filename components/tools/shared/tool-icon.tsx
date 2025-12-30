"use client";

import { cn } from "@/lib/utils";
import { getToolConfig } from "@/lib/tools/tool-config";
import { IntegrationLogo } from "@/components/ui/integration-logo";

interface ToolIconProps {
    toolName: string;
    className?: string;
}

/**
 * Renders the appropriate icon for a tool (either logo or Lucide icon).
 *
 * Pulls icon from tool config - supports both:
 * - Logo paths (string) - renders using IntegrationLogo component
 * - Lucide icon components - renders as React component
 *
 * Usage:
 * ```tsx
 * <ToolIcon toolName="limitless" className="h-4 w-4" />
 * <ToolIcon toolName="webSearch" className="h-3.5 w-3.5 animate-pulse" />
 * ```
 */
export function ToolIcon({ toolName, className }: ToolIconProps) {
    const config = getToolConfig(toolName, { fallbackToDefault: true });

    if (typeof config.icon === "string") {
        // Logo path - render using IntegrationLogo component
        // Map common sizes to IntegrationLogo size variants
        const sizeMap: Record<string, "xs" | "sm"> = {
            "h-3": "xs",
            "h-3.5": "xs",
            "h-4": "xs",
            "h-5": "sm",
            "h-6": "sm",
            "h-8": "sm",
        };

        // Extract height class to determine size
        const heightMatch = className?.match(/h-([\d.]+)/);
        const heightClass = heightMatch ? `h-${heightMatch[1]}` : "h-4";
        const size = sizeMap[heightClass] || "xs";

        return (
            <IntegrationLogo
                src={config.icon}
                alt={config.displayName}
                size={size}
                className={className}
            />
        );
    } else {
        // Lucide icon component
        const Icon = config.icon;
        return <Icon className={cn("shrink-0", className)} />;
    }
}
