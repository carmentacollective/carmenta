"use client";

/**
 * Chat Scroll Hook
 *
 * Provides optimal auto-scroll behavior for streaming LLM responses.
 * Handles the surprisingly complex UX challenge of keeping the user engaged
 * while content streams in token-by-token.
 *
 * Key behaviors:
 * - Auto-scroll during streaming (instant, to keep up with rapid tokens)
 * - Smooth scroll for intentional actions (button clicks)
 * - Smart user intent detection (pauses on scroll up, resumes on return to bottom)
 * - No scroll fighting (distinguishes user scroll from content pushing)
 * - Content observation (ResizeObserver + MutationObserver for all content changes)
 * - Keyboard awareness (suppresses auto-scroll during mobile keyboard transitions)
 *
 * @see knowledge/components/chat-scroll.md
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useVirtualKeyboard } from "@/lib/hooks/use-virtual-keyboard";

const AT_BOTTOM_THRESHOLD = 100; // px from bottom to consider "at bottom"

export interface UseChatScrollOptions {
    /** Whether content is actively streaming */
    isStreaming?: boolean;
}

export interface UseChatScrollReturn {
    /** Attach to the scrollable container element */
    scrollRef: React.RefObject<HTMLDivElement | null>;
    /** Attach to the content wrapper inside the scroll container */
    contentRef: React.RefObject<HTMLDivElement | null>;
    /** Whether user is at/near the bottom */
    isAtBottom: boolean;
    /** Scroll to bottom with specified behavior */
    scrollToBottom: (behavior?: ScrollBehavior) => void;
}

/**
 * Determines if a scroll container is at the bottom within threshold
 */
function checkIsAtBottom(element: HTMLElement | null, threshold: number): boolean {
    if (!element) return true;

    // If content doesn't overflow, user is "at bottom" by definition
    if (element.scrollHeight <= element.clientHeight) {
        return true;
    }

    const { scrollTop, scrollHeight, clientHeight } = element;
    return scrollHeight - scrollTop - clientHeight < threshold;
}

export function useChatScroll({
    isStreaming = false,
}: UseChatScrollOptions = {}): UseChatScrollReturn {
    const scrollRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);

    // Track keyboard state to suppress auto-scroll during keyboard transitions
    const { isKeyboardOpen } = useVirtualKeyboard();
    const prevKeyboardOpenRef = useRef(isKeyboardOpen);
    const keyboardTransitionRef = useRef(false);

    // Exposed state - triggers re-renders for UI updates (scroll button visibility)
    const [isAtBottom, setIsAtBottom] = useState(true);

    // Use refs for high-frequency internal state to avoid re-render storms
    const isAtBottomRef = useRef(true);
    const isUserScrollingRef = useRef(false);
    const lastScrollTopRef = useRef(0);

    // Detect keyboard transitions (opening or closing)
    // During these transitions, suppress auto-scroll to prevent jarring UX
    useEffect(() => {
        if (prevKeyboardOpenRef.current !== isKeyboardOpen) {
            keyboardTransitionRef.current = true;
            prevKeyboardOpenRef.current = isKeyboardOpen;

            // Clear transition flag after keyboard animation completes (~300ms)
            const timer = setTimeout(() => {
                keyboardTransitionRef.current = false;
            }, 350);

            return () => clearTimeout(timer);
        }
    }, [isKeyboardOpen]);

    /**
     * Sync ref to state - only when value actually changes to minimize re-renders
     */
    const updateIsAtBottom = useCallback((value: boolean) => {
        if (isAtBottomRef.current !== value) {
            isAtBottomRef.current = value;
            setIsAtBottom(value);
        }
    }, []);

    /**
     * Scroll to bottom with specified behavior
     * - "instant" for streaming (keeps up with rapid content)
     * - "smooth" for user-initiated actions (polished feel)
     */
    const scrollToBottom = useCallback(
        (behavior: ScrollBehavior = "smooth") => {
            const container = scrollRef.current;
            if (!container) return;

            container.scrollTo({
                top: container.scrollHeight,
                behavior,
            });

            // Update state immediately
            updateIsAtBottom(true);
            isUserScrollingRef.current = false;
        },
        [updateIsAtBottom]
    );

    /**
     * Handle scroll events with debounce for gesture detection
     */
    const handleScroll = useCallback(() => {
        const container = scrollRef.current;
        if (!container) return;

        const currentScrollTop = container.scrollTop;
        const scrollDelta = currentScrollTop - lastScrollTopRef.current;
        lastScrollTopRef.current = currentScrollTop;

        // Detect user scrolling UP (intentionally leaving bottom)
        // Negative delta = scrolling up, and must be significant
        if (scrollDelta < -10) {
            isUserScrollingRef.current = true;
        }

        // Check if at bottom
        const atBottom = checkIsAtBottom(container, AT_BOTTOM_THRESHOLD);

        // If user scrolled back to bottom, resume auto-scroll
        if (atBottom && isUserScrollingRef.current) {
            isUserScrollingRef.current = false;
        }

        // Update ref and state
        updateIsAtBottom(atBottom);
    }, [updateIsAtBottom]);

    /**
     * Auto-scroll during streaming when user is at bottom
     *
     * Key safety checks:
     * - Only during active streaming
     * - Not when user has scrolled up
     * - Not during keyboard transitions (opening/closing)
     * - Only when already at bottom
     */
    const handleContentChange = useCallback(() => {
        if (!isStreaming) return;
        if (isUserScrollingRef.current) return;
        if (!isAtBottomRef.current) return;

        // Suppress auto-scroll during keyboard transitions
        // This prevents the jarring scroll jumps when the mobile keyboard
        // opens or closes, which resize the viewport
        if (keyboardTransitionRef.current) return;

        // Use requestAnimationFrame for smooth visual updates
        requestAnimationFrame(() => {
            scrollToBottom("instant");
        });
    }, [isStreaming, scrollToBottom]);

    // Set up scroll listener - use useLayoutEffect to ensure refs are attached
    useLayoutEffect(() => {
        const container = scrollRef.current;
        if (!container) return;

        // Immediately update state based on current scroll position
        const atBottom = checkIsAtBottom(container, AT_BOTTOM_THRESHOLD);
        setIsAtBottom(atBottom);
        isAtBottomRef.current = atBottom;
        lastScrollTopRef.current = container.scrollTop;

        container.addEventListener("scroll", handleScroll, { passive: true });

        return () => {
            container.removeEventListener("scroll", handleScroll);
        };
    }, [handleScroll]);

    // Set up content observers (ResizeObserver + MutationObserver)
    useEffect(() => {
        const content = contentRef.current;
        if (!content) return;

        // ResizeObserver for content size changes (images loading, code blocks expanding)
        const resizeObserver = new ResizeObserver(() => {
            handleContentChange();
        });

        // MutationObserver for DOM changes (new messages, streaming text)
        const mutationObserver = new MutationObserver(() => {
            handleContentChange();
        });

        resizeObserver.observe(content);
        mutationObserver.observe(content, {
            childList: true,
            subtree: true,
            characterData: true,
        });

        return () => {
            resizeObserver.disconnect();
            mutationObserver.disconnect();
        };
    }, [handleContentChange]);

    return {
        scrollRef,
        contentRef,
        isAtBottom,
        scrollToBottom,
    };
}
