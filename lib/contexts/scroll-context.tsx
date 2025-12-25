/**
 * Scroll Context
 *
 * Shares scroll state between components. Allows scroll containers
 * to report their position and consumers (like headers) to react.
 *
 * @see knowledge/components/pwa-mobile-enhancements.md
 */

"use client";

import {
    createContext,
    useContext,
    useState,
    useCallback,
    useMemo,
    type ReactNode,
} from "react";

interface ScrollState {
    /** Current scroll position */
    scrollY: number;
    /** Whether scrolling down */
    isScrollingDown: boolean;
    /** Whether at top of scroll container */
    isAtTop: boolean;
    /** Whether header should be visible (hides on scroll down, shows on scroll up) */
    shouldShowHeader: boolean;
}

interface ScrollContextValue extends ScrollState {
    /** Report scroll position from a scroll container */
    reportScroll: (scrollY: number) => void;
}

const ScrollContext = createContext<ScrollContextValue | null>(null);

const SCROLL_THRESHOLD = 10;

export function ScrollProvider({ children }: { children: ReactNode }) {
    const [state, setState] = useState<ScrollState>({
        scrollY: 0,
        isScrollingDown: false,
        isAtTop: true,
        shouldShowHeader: true,
    });

    const reportScroll = useCallback((newScrollY: number) => {
        setState((prev) => {
            const delta = newScrollY - prev.scrollY;
            const isAtTop = newScrollY <= 0;

            // Always show header at top
            if (isAtTop) {
                return {
                    scrollY: newScrollY,
                    isScrollingDown: false,
                    isAtTop: true,
                    shouldShowHeader: true,
                };
            }

            // Determine direction with threshold
            const isScrollingDown = delta > SCROLL_THRESHOLD;
            const isScrollingUp = delta < -SCROLL_THRESHOLD / 2;

            // Only update header visibility on significant scroll
            let shouldShowHeader = prev.shouldShowHeader;
            if (isScrollingDown) {
                shouldShowHeader = false;
            } else if (isScrollingUp) {
                shouldShowHeader = true;
            }

            return {
                scrollY: newScrollY,
                isScrollingDown,
                isAtTop,
                shouldShowHeader,
            };
        });
    }, []);

    const value = useMemo(
        () => ({
            ...state,
            reportScroll,
        }),
        [state, reportScroll]
    );

    return <ScrollContext.Provider value={value}>{children}</ScrollContext.Provider>;
}

export function useScrollState(): ScrollContextValue {
    const context = useContext(ScrollContext);
    if (!context) {
        // Return sensible defaults when used outside provider
        return {
            scrollY: 0,
            isScrollingDown: false,
            isAtTop: true,
            shouldShowHeader: true,
            reportScroll: () => {},
        };
    }
    return context;
}
