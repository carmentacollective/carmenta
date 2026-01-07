"use client";

/**
 * CarmentaLayout
 *
 * Layout wrapper that integrates Carmenta DCOS into page structure.
 * Uses the real Chat component from /connection for full feature parity.
 *
 * Behavior by screen size:
 * - Desktop (md+): Sidebar pattern - panel pushes content to the right
 * - Mobile: Uses CarmentaModal instead (focused, intentional interaction)
 *
 * This provides the best UX for each context:
 * - Desktop: Work alongside Carmenta, see changes in real-time
 * - Mobile: Focused conversation without fighting for screen space
 */

import {
    createContext,
    useContext,
    useState,
    useCallback,
    useMemo,
    useEffect,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SparkleIcon, CaretLeftIcon, Trash } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useCarmentaModal } from "@/hooks/use-carmenta-modal";
import {
    ConnectionProvider,
    ConnectRuntimeProvider,
    useChatContext,
} from "@/components/connection";
import { HoloThread } from "@/components/connection/holo-thread";
import { HolographicBackground } from "@/components/ui/holographic-background";
import { SiteHeader } from "@/components/site-header";
import { Footer } from "@/components/footer";

/** Panel width in pixels */
const PANEL_WIDTH = 400;

/**
 * Context for Carmenta layout state
 */
interface CarmentaLayoutContextValue {
    isOpen: boolean;
    open: () => void;
    close: () => void;
    toggle: () => void;
}

const CarmentaLayoutContext = createContext<CarmentaLayoutContextValue | null>(null);

export function useCarmentaLayout() {
    const context = useContext(CarmentaLayoutContext);
    if (!context) {
        throw new Error("useCarmentaLayout must be used within CarmentaLayout");
    }
    return context;
}

interface CarmentaLayoutProps {
    children: React.ReactNode;
    /** Page context for DCOS - what page/feature the user is on */
    pageContext: string;
    /** Callback when Carmenta makes changes (tool calls complete) */
    onChangesComplete?: () => void;
    /** Additional className for the content area */
    className?: string;
    /** ClassName for the content wrapper (defaults to standard page spacing) */
    contentClassName?: string;
    /**
     * Maximum content width constraint
     * - 'narrow': 56rem (896px) — for text-heavy pages
     * - 'standard': 64rem (1024px) — for standard pages
     * - 'wide': 80rem (1280px) — for feature-rich pages
     */
    maxWidth?: "narrow" | "standard" | "wide";
}

const maxWidthClasses = {
    narrow: "max-w-4xl", // 56rem / 896px
    standard: "max-w-5xl", // 64rem / 1024px
    wide: "max-w-6xl", // 80rem / 1280px
};

/**
 * CarmentaLayout
 *
 * Wrap your page content with this to get the push-content sidebar on desktop.
 */
export function CarmentaLayout({
    children,
    pageContext,
    onChangesComplete,
    className,
    contentClassName = "space-y-8 py-12",
    maxWidth = "standard",
}: CarmentaLayoutProps) {
    const [isOpen, setIsOpen] = useState(false);
    const isDesktop = useMediaQuery("(min-width: 768px)");
    const { open: openModal } = useCarmentaModal();

    const open = useCallback(() => {
        if (isDesktop) {
            setIsOpen(true);
        } else {
            // On mobile, use the global modal instead
            openModal();
        }
    }, [isDesktop, openModal]);

    const close = useCallback(() => {
        setIsOpen(false);
    }, []);

    const toggle = useCallback(() => {
        if (isDesktop) {
            setIsOpen((prev) => !prev);
        } else {
            openModal();
        }
    }, [isDesktop, openModal]);

    const contextValue = useMemo<CarmentaLayoutContextValue>(
        () => ({
            isOpen: isDesktop ? isOpen : false, // On mobile, panel is never "open" - we use modal
            open,
            close,
            toggle,
        }),
        [isDesktop, isOpen, open, close, toggle]
    );

    return (
        <div className="bg-background relative min-h-screen">
            <HolographicBackground />
            <div className="z-content relative">
                {/* Header with safe-area padding for iPhone PWA */}
                <div className="pt-safe-top">
                    <SiteHeader bordered />
                </div>

                {/* Flex container: sidebar | content */}
                <CarmentaLayoutContext.Provider value={contextValue}>
                    <div className="flex min-h-0 flex-1">
                        {/* Desktop sidebar panel */}
                        <AnimatePresence mode="wait">
                            {isDesktop && isOpen && (
                                <ConnectionProvider key="carmenta-desktop-panel">
                                    <ConnectRuntimeProvider
                                        endpoint="/api/dcos"
                                        pageContext={pageContext}
                                        onChangesComplete={onChangesComplete}
                                    >
                                        <DesktopPanel onClose={close} />
                                    </ConnectRuntimeProvider>
                                </ConnectionProvider>
                            )}
                        </AnimatePresence>

                        {/* Main content - constrained width, no centering */}
                        <main
                            className={cn(
                                "w-full px-6 sm:px-8 lg:px-10",
                                maxWidthClasses[maxWidth],
                                className
                            )}
                        >
                            <div className={contentClassName}>{children}</div>
                        </main>
                    </div>
                </CarmentaLayoutContext.Provider>

                {/* Footer with safe-area padding for iPhone PWA */}
                <div className="pb-safe-bottom">
                    <Footer />
                </div>
            </div>
        </div>
    );
}

/**
 * Desktop sidebar panel (not fixed - pushes content)
 * Uses the real HoloThread for full feature parity with /connection
 */
function DesktopPanel({ onClose }: { onClose: () => void }) {
    const { messages, setMessages, stop } = useChatContext();

    const handleClear = () => {
        stop();
        setMessages([]);
    };

    // Handle escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                onClose();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [onClose]);

    return (
        <motion.aside
            className={cn(
                "flex flex-col overflow-hidden",
                // Styling
                "bg-background/60 backdrop-blur-xl",
                "border-foreground/[0.08] border-r"
            )}
            style={{ width: PANEL_WIDTH, minWidth: PANEL_WIDTH }}
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: PANEL_WIDTH, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{
                type: "spring",
                damping: 28,
                stiffness: 320,
            }}
        >
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
                        <h2 className="text-foreground text-sm font-medium">
                            Carmenta
                        </h2>
                        <p className="text-foreground/50 text-[10px]">
                            Working together
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {messages.length > 0 && (
                        <button
                            onClick={handleClear}
                            className="text-foreground/40 hover:bg-foreground/5 hover:text-foreground/60 flex min-h-11 min-w-11 items-center justify-center rounded-lg transition-colors"
                            aria-label="Clear conversation"
                            title="Clear conversation"
                        >
                            <Trash className="h-4 w-4" />
                        </button>
                    )}
                    <button
                        onClick={onClose}
                        className="text-foreground/40 hover:bg-foreground/5 hover:text-foreground/60 flex min-h-11 min-w-11 items-center justify-center rounded-lg transition-colors"
                        aria-label="Collapse panel"
                    >
                        <CaretLeftIcon className="h-4 w-4" />
                    </button>
                </div>
            </header>

            {/* Chat interface - same as /connection but narrower */}
            <div className="min-h-0 flex-1 overflow-hidden">
                <HoloThread />
            </div>
        </motion.aside>
    );
}
