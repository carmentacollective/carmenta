"use client";

/**
 * CarmentaSidecar
 *
 * A contextual Carmenta assistant that appears alongside page content.
 *
 * Behavior by screen size:
 * - Desktop (lg+, ≥1024px): True sidecar - pushes content, no overlay, user can
 *   still interact with the page. Panel is position-fixed, content gets margin.
 * - Mobile/Tablet: Sheet with overlay - focused interaction since there's not
 *   enough screen real estate for side-by-side work.
 *
 * Key differences from CarmentaSheet:
 * - Desktop shows NO overlay - you can work with both panels simultaneously
 * - Supports context-aware welcome with custom heading, suggestions, placeholder
 * - Designed for workbench pages where the sidecar helps with the page's task
 */

import { createContext, useContext, useCallback, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SparkleIcon, Trash, X } from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/hooks/use-media-query";
import {
    Sheet,
    SheetContent,
    SheetTitle,
    SheetDescription,
} from "@/components/ui/sheet";
import { PortalErrorBoundary } from "@/components/ui/portal-error-boundary";
import { ConnectRuntimeProvider, useChatContext } from "@/components/connection";
import { SidecarThread } from "./sidecar-thread";

/** Panel width in pixels */
const PANEL_WIDTH = 420;

/**
 * Suggestion for the welcome screen
 */
export interface SidecarSuggestion {
    id: string;
    label: string;
    prompt: string;
    icon?: Icon;
    /** If true, auto-submit the prompt on click */
    autoSubmit?: boolean;
}

/**
 * Configuration for context-aware welcome
 */
export interface SidecarWelcomeConfig {
    /** Custom heading instead of "Hi, Nick" */
    heading: string;
    /** Subtitle under the heading */
    subtitle?: string;
    /** Context-specific suggestions */
    suggestions: SidecarSuggestion[];
    /** Placeholder for the input */
    placeholder?: string;
}

/**
 * Context for sidecar state
 */
interface SidecarContextValue {
    isOpen: boolean;
    isDesktop: boolean;
    open: () => void;
    close: () => void;
    toggle: () => void;
}

const SidecarContext = createContext<SidecarContextValue | null>(null);

export function useSidecar() {
    const context = useContext(SidecarContext);
    if (!context) {
        throw new Error("useSidecar must be used within CarmentaSidecar");
    }
    return context;
}

interface CarmentaSidecarProps {
    /** Whether the sidecar is open */
    open: boolean;
    /** Callback when open state changes */
    onOpenChange: (open: boolean) => void;
    /** Page context for DCOS - what page/feature the user is on */
    pageContext: string;
    /** Callback when Carmenta makes changes (tool calls complete) */
    onChangesComplete?: () => void;
    /** Context-aware welcome configuration */
    welcomeConfig?: SidecarWelcomeConfig;
    /** Title shown in the header */
    title?: string;
    /** Description shown below the title */
    description?: string;
}

export function CarmentaSidecar({
    open,
    onOpenChange,
    pageContext,
    onChangesComplete,
    welcomeConfig,
    title = "Carmenta",
    description = "Working together",
}: CarmentaSidecarProps) {
    // lg breakpoint = 1024px - enough room for meaningful side-by-side
    const isDesktop = useMediaQuery("(min-width: 1024px)");

    const handleOpen = useCallback(() => onOpenChange(true), [onOpenChange]);
    const handleClose = useCallback(() => onOpenChange(false), [onOpenChange]);
    const handleToggle = useCallback(() => onOpenChange(!open), [onOpenChange, open]);

    const contextValue = useMemo<SidecarContextValue>(
        () => ({
            isOpen: open,
            isDesktop,
            open: handleOpen,
            close: handleClose,
            toggle: handleToggle,
        }),
        [open, isDesktop, handleOpen, handleClose, handleToggle]
    );

    // Desktop: Show as fixed sidecar with no overlay
    // Mobile: Show as Sheet with overlay
    return (
        <SidecarContext.Provider value={contextValue}>
            {isDesktop ? (
                <DesktopSidecar
                    open={open}
                    onClose={handleClose}
                    pageContext={pageContext}
                    onChangesComplete={onChangesComplete}
                    welcomeConfig={welcomeConfig}
                    title={title}
                    description={description}
                />
            ) : (
                <MobileSheet
                    open={open}
                    onOpenChange={onOpenChange}
                    pageContext={pageContext}
                    onChangesComplete={onChangesComplete}
                    welcomeConfig={welcomeConfig}
                    title={title}
                    description={description}
                />
            )}
        </SidecarContext.Provider>
    );
}

/**
 * Desktop sidecar - fixed position panel, NO overlay
 * Pushes main content via useDesktopSidecarMargin hook
 */
function DesktopSidecar({
    open,
    onClose,
    pageContext,
    onChangesComplete,
    welcomeConfig,
    title,
    description,
}: {
    open: boolean;
    onClose: () => void;
    pageContext: string;
    onChangesComplete?: () => void;
    welcomeConfig?: SidecarWelcomeConfig;
    title: string;
    description: string;
}) {
    // Handle escape key
    useEffect(() => {
        if (!open) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            // Only close if escape wasn't already handled (e.g., by composer stopping generation)
            if (e.key === "Escape" && !e.defaultPrevented) {
                onClose();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [open, onClose]);

    return (
        <AnimatePresence>
            {open && (
                <ConnectRuntimeProvider
                    endpoint="/api/dcos"
                    pageContext={pageContext}
                    onChangesComplete={onChangesComplete}
                >
                    <motion.aside
                        className={cn(
                            "z-modal fixed inset-y-0 left-0 flex flex-col overflow-hidden",
                            // Styling - glass effect
                            "bg-background/80 backdrop-blur-xl",
                            "border-foreground/[0.08] border-r",
                            // Shadow for depth
                            "shadow-2xl shadow-black/10"
                        )}
                        style={{ width: PANEL_WIDTH }}
                        initial={{ x: -PANEL_WIDTH, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: -PANEL_WIDTH, opacity: 0 }}
                        transition={{
                            type: "spring",
                            damping: 28,
                            stiffness: 320,
                        }}
                    >
                        <PortalErrorBoundary
                            portalName="CarmentaSidecar"
                            onDismiss={onClose}
                        >
                            <SidecarInner
                                onClose={onClose}
                                title={title}
                                description={description}
                                welcomeConfig={welcomeConfig}
                            />
                        </PortalErrorBoundary>
                    </motion.aside>
                </ConnectRuntimeProvider>
            )}
        </AnimatePresence>
    );
}

/**
 * Mobile sheet - uses Radix Sheet for proper modal behavior
 * This is appropriate for mobile where side-by-side isn't practical
 */
function MobileSheet({
    open,
    onOpenChange,
    pageContext,
    onChangesComplete,
    welcomeConfig,
    title,
    description,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    pageContext: string;
    onChangesComplete?: () => void;
    welcomeConfig?: SidecarWelcomeConfig;
    title: string;
    description: string;
}) {
    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                side="left"
                className={cn(
                    "flex flex-col p-0",
                    // Full width on phones, max on tablets
                    "w-full sm:w-[400px] sm:max-w-[400px]"
                )}
                hideClose
            >
                <PortalErrorBoundary
                    portalName="CarmentaSidecar"
                    onDismiss={() => onOpenChange(false)}
                >
                    <ConnectRuntimeProvider
                        endpoint="/api/dcos"
                        pageContext={pageContext}
                        onChangesComplete={onChangesComplete}
                    >
                        <SidecarInner
                            onClose={() => onOpenChange(false)}
                            title={title}
                            description={description}
                            welcomeConfig={welcomeConfig}
                            isMobile
                        />
                    </ConnectRuntimeProvider>
                </PortalErrorBoundary>
            </SheetContent>
        </Sheet>
    );
}

/**
 * Inner content - shared between desktop and mobile
 */
function SidecarInner({
    onClose,
    title,
    description,
    welcomeConfig,
    isMobile = false,
}: {
    onClose: () => void;
    title: string;
    description: string;
    welcomeConfig?: SidecarWelcomeConfig;
    isMobile?: boolean;
}) {
    const { messages, setMessages, stop } = useChatContext();

    const handleClear = () => {
        stop();
        setMessages([]);
    };

    return (
        <>
            {/* Header */}
            <header className="border-foreground/[0.08] flex shrink-0 items-center justify-between border-b px-4 py-3">
                <div className="flex items-center gap-2.5">
                    <div className="bg-primary/20 flex h-8 w-8 items-center justify-center rounded-full">
                        <SparkleIcon
                            className="text-primary h-4 w-4"
                            weight="duotone"
                        />
                    </div>
                    <div>
                        {isMobile ? (
                            <>
                                <SheetTitle className="text-foreground text-sm font-medium">
                                    {title}
                                </SheetTitle>
                                <SheetDescription className="text-foreground/50 text-[10px]">
                                    {description}
                                </SheetDescription>
                            </>
                        ) : (
                            <>
                                <h2 className="text-foreground text-sm font-medium">
                                    {title}
                                </h2>
                                <p className="text-foreground/50 text-[10px]">
                                    {description}
                                </p>
                            </>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-1">
                    {messages.length > 0 && (
                        <button
                            onClick={handleClear}
                            className="text-foreground/40 hover:bg-foreground/5 hover:text-foreground/60 flex min-h-9 min-w-9 items-center justify-center rounded-lg transition-colors"
                            aria-label="Clear conversation"
                            title="Clear conversation"
                        >
                            <Trash className="h-4 w-4" />
                        </button>
                    )}
                    <button
                        onClick={onClose}
                        className="text-foreground/40 hover:bg-foreground/5 hover:text-foreground/60 flex min-h-9 min-w-9 items-center justify-center rounded-lg transition-colors"
                        aria-label="Close panel"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
            </header>

            {/* Chat interface with context-aware welcome */}
            <div className="@container min-h-0 flex-1 overflow-hidden">
                <SidecarThread welcomeConfig={welcomeConfig} />
            </div>
        </>
    );
}

/**
 * Hook to get the margin to apply when sidecar is open
 * Use this to push your main content when the desktop sidecar is open
 *
 * @example
 * ```tsx
 * const margin = useDesktopSidecarMargin(isOpen);
 * <main style={{ marginLeft: margin }}>...</main>
 * ```
 */
export function useDesktopSidecarMargin(isOpen: boolean): number {
    const context = useContext(SidecarContext);
    // Always call hook (rules of hooks), but only use if context is null
    const mediaQueryResult = useMediaQuery("(min-width: 1024px)");

    // Prefer context value if available (avoids duplicate subscription when inside provider)
    const isDesktop = context?.isDesktop ?? mediaQueryResult;

    return isDesktop && isOpen ? PANEL_WIDTH : 0;
}

export { PANEL_WIDTH as SIDECAR_WIDTH };
