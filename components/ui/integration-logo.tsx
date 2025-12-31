"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

interface IntegrationLogoProps {
    src: string;
    alt: string;
    /** Size variant - defaults to "md" */
    size?: "xs" | "sm" | "md" | "lg";
    className?: string;
}

/**
 * Standardized integration logo component.
 *
 * Displays integration logos with consistent styling across the app:
 * - White background (works in dark mode)
 * - Rounded corners with border
 * - Proper padding and object-contain for aspect ratio
 * - Size variants for different contexts
 *
 * Usage:
 * ```tsx
 * <IntegrationLogo src="/logos/notion.svg" alt="Notion" size="md" />
 * <IntegrationLogo src="/logos/slack.svg" alt="Slack" size="xs" />
 * ```
 */
export function IntegrationLogo({
    src,
    alt,
    size = "md",
    className,
}: IntegrationLogoProps) {
    const sizeClasses = {
        xs: "h-4 w-4 rounded-md border p-0.5",
        sm: "h-8 w-8 rounded-lg border p-1.5",
        md: "h-16 w-16 rounded-2xl border-2 p-3",
        lg: "h-24 w-24 rounded-3xl border-2 p-4",
    };

    return (
        <div
            className={cn(
                "border-border/40 relative flex-shrink-0 overflow-hidden bg-white shadow-sm dark:bg-gray-50",
                sizeClasses[size],
                className
            )}
        >
            <Image src={src} alt={alt} fill className="object-contain p-0.5" />
        </div>
    );
}
