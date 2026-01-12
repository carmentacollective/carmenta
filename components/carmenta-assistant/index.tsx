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

import Image from "next/image";
import { cn } from "@/lib/utils";

// Export components
export { CarmentaPanel } from "./carmenta-panel";
export { CarmentaLayout, useCarmentaLayout } from "./carmenta-layout";
export { CarmentaSheet } from "./carmenta-sheet";
export {
    CarmentaSidecar,
    useSidecar,
    useDesktopSidecarMargin,
    SIDECAR_WIDTH,
} from "./carmenta-sidecar";
export type { SidecarWelcomeConfig, SidecarSuggestion } from "./carmenta-sidecar";

// Export hooks
export { useCarmenta } from "./use-carmenta";
export { useCarmentaPanel } from "./use-carmenta-panel";

// Export types
export type { CarmentaMode, CarmentaPanelProps, CarmentaLayoutProps } from "./types";

/**
 * Toggle button for Carmenta panel
 *
 * Renders a button to open/close the Carmenta panel with the Carmenta logo.
 * Use with CarmentaPanel/CarmentaLayout and their hooks.
 */
interface CarmentaToggleProps {
    /** Whether the panel is currently open */
    isOpen: boolean;
    /** Toggle callback */
    onClick: () => void;
    /** Label to show next to logo (defaults to "Let Carmenta Help") */
    label?: string;
    /** Additional CSS classes */
    className?: string;
}

export function CarmentaToggle({
    isOpen,
    onClick,
    label = "Let Carmenta Help",
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
            aria-label={isOpen ? "Close Carmenta" : "Let Carmenta Help"}
            aria-expanded={isOpen}
        >
            <Image
                src="/logos/icon-transparent.png"
                alt=""
                width={20}
                height={20}
                className={cn(
                    "h-5 w-5 transition-opacity",
                    isOpen ? "opacity-100" : "opacity-70"
                )}
            />
            <span className="text-sm font-medium whitespace-nowrap">{label}</span>
        </button>
    );
}
