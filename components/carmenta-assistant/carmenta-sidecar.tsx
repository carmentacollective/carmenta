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

import {
    createContext,
    useContext,
    useCallback,
    useMemo,
    useEffect,
    type ReactNode,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trash, X } from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import Image from "next/image";
import type { UIMessage } from "@ai-sdk/react";

import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/hooks/use-media-query";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
    Sheet,
    SheetContent,
    SheetTitle,
    SheetDescription,
} from "@/components/ui/sheet";
import { PortalErrorBoundary } from "@/components/ui/portal-error-boundary";
import {
    ConnectRuntimeProvider,
    useChatContext,
    type Playbook,
} from "@/components/connection";
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
    /** API endpoint override (default: /api/dcos) */
    endpoint?: string;
    /** Initial messages to pre-fill conversation (skips welcome screen) */
    initialMessages?: UIMessage[];
    /** Content to render below messages, above composer (e.g., playbook card) */
    auxiliaryContent?: ReactNode;
    /** Callback when playbook is extracted (hire wizard) */
    onPlaybookReady?: (playbook: Playbook) => void;
}

export function CarmentaSidecar({
    open,
    onOpenChange,
    pageContext,
    onChangesComplete,
    welcomeConfig,
    title = "Carmenta",
    description = "Working together",
    endpoint = "/api/dcos",
    initialMessages,
    auxiliaryContent,
    onPlaybookReady,
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
                    endpoint={endpoint}
                    initialMessages={initialMessages}
                    auxiliaryContent={auxiliaryContent}
                    onPlaybookReady={onPlaybookReady}
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
                    endpoint={endpoint}
                    initialMessages={initialMessages}
                    auxiliaryContent={auxiliaryContent}
                    onPlaybookReady={onPlaybookReady}
                />
            )}
        </SidecarContext.Provider>
    );
}

/**
 * Desktop sidecar - fixed position panel, NO overlay
 * Automatically pushes body content by applying margin-left
 */
function DesktopSidecar({
    open,
    onClose,
    pageContext,
    onChangesComplete,
    welcomeConfig,
    title,
    description,
    endpoint,
    initialMessages,
    auxiliaryContent,
    onPlaybookReady,
}: {
    open: boolean;
    onClose: () => void;
    pageContext: string;
    onChangesComplete?: () => void;
    welcomeConfig?: SidecarWelcomeConfig;
    title: string;
    description: string;
    endpoint: string;
    initialMessages?: UIMessage[];
    auxiliaryContent?: ReactNode;
    onPlaybookReady?: (playbook: Playbook) => void;
}) {
    // Automatically push body content when sidecar opens
    useEffect(() => {
        if (!open) {
            document.body.style.marginLeft = "0px";
            return;
        }

        // Apply margin with smooth transition
        document.body.style.transition =
            "margin-left 0.3s cubic-bezier(0.16, 1, 0.3, 1)";
        document.body.style.marginLeft = `${PANEL_WIDTH}px`;

        return () => {
            document.body.style.marginLeft = "0px";
            document.body.style.transition = "";
        };
    }, [open]);

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
                    endpoint={endpoint}
                    pageContext={pageContext}
                    onChangesComplete={onChangesComplete}
                    initialMessages={initialMessages}
                    onPlaybookReady={onPlaybookReady}
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
                                auxiliaryContent={auxiliaryContent}
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
    endpoint,
    initialMessages,
    auxiliaryContent,
    onPlaybookReady,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    pageContext: string;
    onChangesComplete?: () => void;
    welcomeConfig?: SidecarWelcomeConfig;
    title: string;
    description: string;
    endpoint: string;
    initialMessages?: UIMessage[];
    auxiliaryContent?: ReactNode;
    onPlaybookReady?: (playbook: Playbook) => void;
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
                        endpoint={endpoint}
                        pageContext={pageContext}
                        onChangesComplete={onChangesComplete}
                        initialMessages={initialMessages}
                        onPlaybookReady={onPlaybookReady}
                    >
                        <SidecarInner
                            onClose={() => onOpenChange(false)}
                            title={title}
                            description={description}
                            welcomeConfig={welcomeConfig}
                            auxiliaryContent={auxiliaryContent}
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
    auxiliaryContent,
    isMobile = false,
}: {
    onClose: () => void;
    title: string;
    description: string;
    welcomeConfig?: SidecarWelcomeConfig;
    auxiliaryContent?: ReactNode;
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
                    <div className="from-primary/20 flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br to-cyan-500/20">
                        <Image
                            src="/logos/icon-transparent.png"
                            alt="Carmenta"
                            width={22}
                            height={22}
                        />
                    </div>
                    <div>
                        {isMobile ? (
                            <>
                                <SheetTitle className="text-foreground text-sm font-medium">
                                    {title}
                                </SheetTitle>
                                <SheetDescription className="text-muted-foreground text-xs">
                                    {description}
                                </SheetDescription>
                            </>
                        ) : (
                            <>
                                <h2 className="text-foreground text-sm font-medium">
                                    {title}
                                </h2>
                                <p className="text-muted-foreground text-xs">
                                    {description}
                                </p>
                            </>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-1">
                    {messages.length > 0 && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    onClick={handleClear}
                                    className="text-foreground/40 hover:bg-foreground/5 hover:text-foreground/60 flex min-h-9 min-w-9 items-center justify-center rounded-lg transition-colors"
                                    aria-label="Clear conversation"
                                >
                                    <Trash className="h-4 w-4" />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent>Clear conversation</TooltipContent>
                        </Tooltip>
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
                <SidecarThread
                    welcomeConfig={welcomeConfig}
                    auxiliaryContent={auxiliaryContent}
                />
            </div>
        </>
    );
}

/**
 * Hook to get the margin to apply when sidecar is open
 *
 * NOTE: As of the latest version, CarmentaSidecar automatically applies
 * body margin, so this hook is no longer needed for normal usage.
 * It's kept for backwards compatibility or advanced use cases.
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
