"use client";

/**
 * Carmenta Components
 *
 * Unified interface to Carmenta through DCOS orchestration.
 * Provides consistent experience across all pages.
 *
 * Two presentation modes:
 * - modal: Centered overlay dialog (⌘K, Oracle menu, mobile)
 * - panel: Left-side drawer, first-class citizen on workbench pages
 *
 * @example Panel mode (AI Team, Knowledge Base, MCP Config)
 * ```tsx
 * const panel = useCarmentaPanel();
 *
 * <CarmentaPanel
 *   isOpen={panel.isOpen}
 *   onClose={panel.close}
 *   pageContext="User is on the AI Team page..."
 *   onChangesComplete={() => router.refresh()}
 * />
 * ```
 *
 * @example Layout mode (push-content sidebar)
 * ```tsx
 * <CarmentaLayout pageContext="...">
 *   <YourPageContent />
 * </CarmentaLayout>
 * ```
 *
 * @example Toggle button
 * ```tsx
 * const carmenta = useCarmentaLayout();
 *
 * <CarmentaToggle
 *   isOpen={carmenta.isOpen}
 *   onClick={carmenta.toggle}
 * />
 * ```
 */

import { Sparkle } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

// Export components
export { CarmentaPanel } from "./carmenta-panel";
export { CarmentaLayout, useCarmentaLayout } from "./carmenta-layout";
export { CarmentaSheet } from "./carmenta-sheet";

// Export hooks
export { useCarmenta } from "./use-carmenta";
export { useCarmentaPanel } from "./use-carmenta-panel";

// Export types
export type { CarmentaMode, CarmentaPanelProps, CarmentaLayoutProps } from "./types";

/**
 * Toggle button for Carmenta panel
 *
 * Renders a button to open/close the Carmenta panel.
 * Use with CarmentaPanel/CarmentaLayout and their hooks.
 */
interface CarmentaToggleProps {
    /** Whether the panel is currently open */
    isOpen: boolean;
    /** Toggle callback */
    onClick: () => void;
    /** Optional label to show next to icon */
    label?: string;
    /** Additional CSS classes */
    className?: string;
}

export function CarmentaToggle({
    isOpen,
    onClick,
    label,
    className,
}: CarmentaToggleProps) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "flex min-h-11 items-center gap-2 rounded-xl px-4 py-2",
                "bg-foreground/[0.03] backdrop-blur-sm",
                "border-foreground/[0.08] border",
                "text-foreground/70 hover:text-foreground",
                "hover:bg-foreground/[0.06]",
                "transition-colors duration-200",
                isOpen && "bg-primary/10 border-primary/20 text-primary",
                className
            )}
            aria-label={isOpen ? "Close Carmenta" : "Open Carmenta"}
            aria-expanded={isOpen}
        >
            <Sparkle
                className={cn("h-5 w-5", isOpen && "text-primary")}
                weight={isOpen ? "fill" : "duotone"}
            />
            {label && <span className="text-sm font-medium">{label}</span>}
        </button>
    );
}
