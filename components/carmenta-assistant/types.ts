/**
 * Carmenta Types
 *
 * Unified type definitions for Carmenta DCOS interface components.
 */

/**
 * Presentation mode for Carmenta
 *
 * - modal: Centered overlay dialog (⌘K, Oracle menu, mobile)
 * - panel: Left-side drawer, first-class citizen on workbench pages
 */
export type CarmentaMode = "modal" | "panel";

/**
 * Props for CarmentaPanel component
 */
export interface CarmentaPanelProps {
    /** Whether the panel is currently visible */
    isOpen: boolean;

    /** Callback to close/collapse the panel */
    onClose: () => void;

    /**
     * Page context for DCOS routing
     * Describe what page the user is on and what actions are available
     */
    pageContext: string;

    /**
     * Called after the agent makes changes that affect the page
     * Use this to refresh data, e.g., router.refresh() or refetch queries
     */
    onChangesComplete?: () => void;

    /** Custom placeholder for the input */
    placeholder?: string;

    /** Additional CSS classes */
    className?: string;
}

/**
 * Props for CarmentaLayout wrapper
 */
export interface CarmentaLayoutProps {
    children: React.ReactNode;
    /** Page context for DCOS routing */
    pageContext: string;
    /** Called after agent makes changes */
    onChangesComplete?: () => void;
    /** Custom placeholder */
    placeholder?: string;
    /** Additional classes for the content area */
    className?: string;
}
