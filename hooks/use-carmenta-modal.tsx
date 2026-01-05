/**
 * Carmenta Modal Hook
 *
 * Global state and keyboard handler for the universal Carmenta modal.
 * Opens with Cmd+K (or Ctrl+K on Windows).
 */

import {
    useState,
    useEffect,
    useCallback,
    createContext,
    useContext,
    type ReactNode,
} from "react";
import { usePathname } from "next/navigation";

interface CarmentaModalContextType {
    isOpen: boolean;
    pageContext: string | undefined;
    open: () => void;
    close: () => void;
    toggle: () => void;
}

const CarmentaModalContext = createContext<CarmentaModalContextType | null>(null);

/**
 * Get page context string based on current pathname
 */
function getPageContext(pathname: string): string | undefined {
    if (pathname === "/knowledge-base") {
        return "User is viewing their knowledge base. The Librarian can search, organize, and extract knowledge here.";
    }
    if (pathname.startsWith("/integrations/mcp")) {
        return "User is on the MCP server configuration page. We can help set up and manage MCP servers.";
    }
    if (pathname.startsWith("/integrations")) {
        return "User is viewing their connected integrations and services.";
    }
    if (pathname === "/chat" || pathname.startsWith("/chat/")) {
        return "User is in a chat conversation.";
    }
    if (pathname === "/") {
        return "User is on the home dashboard.";
    }
    return undefined;
}

/**
 * Provider for Carmenta modal state
 *
 * Wrap your app in this provider to enable the Carmenta modal globally.
 */
export function CarmentaModalProvider({ children }: { children: ReactNode }) {
    const [isOpen, setIsOpen] = useState(false);
    const pathname = usePathname();
    const pageContext = pathname ? getPageContext(pathname) : undefined;

    const open = useCallback(() => setIsOpen(true), []);
    const close = useCallback(() => setIsOpen(false), []);
    const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

    // Global keyboard handler
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            // Open on Cmd+K or Ctrl+K
            if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                toggle();
            }

            // Close on Escape
            if (e.key === "Escape" && isOpen) {
                e.preventDefault();
                close();
            }
        };

        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [isOpen, toggle, close]);

    return (
        <CarmentaModalContext.Provider
            value={{ isOpen, pageContext, open, close, toggle }}
        >
            {children}
        </CarmentaModalContext.Provider>
    );
}

/**
 * Hook to access Carmenta modal state
 *
 * Must be used within a CarmentaModalProvider.
 */
export function useCarmentaModal() {
    const context = useContext(CarmentaModalContext);
    if (!context) {
        throw new Error("useCarmentaModal must be used within a CarmentaModalProvider");
    }
    return context;
}
