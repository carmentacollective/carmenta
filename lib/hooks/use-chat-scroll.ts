/**
 * Chat Scroll Hook - Optimal auto-scroll for streaming LLM chat
 *
 * This hook provides the best-in-class scrolling experience for chat interfaces,
 * combining patterns from assistant-ui and Vercel's ai-chatbot:
 *
 * Key behaviors:
 * 1. Auto-scroll during streaming (instant, keeps up with fast tokens)
 * 2. Smooth scroll for intentional actions (scroll-to-bottom button)
 * 3. User intent detection - pauses when user scrolls UP (reading back)
 * 4. Resumes auto-scroll when user scrolls back to bottom
 * 5. Content observation via ResizeObserver + MutationObserver
 *
 * The magic: We track scroll direction to distinguish user scrolling from
 * content pushing them. If they scroll UP, we pause. If content grows and
 * pushes them (scroll position doesn't change relative to top), we continue.
 */

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Threshold in pixels for "at bottom" detection.
 * 100px is forgiving enough for minor variations while being responsive.
 */
const AT_BOTTOM_THRESHOLD = 100;

/**
 * Debounce time in ms to detect when user stops scrolling.
 * 150ms matches natural scroll gesture endings.
 */
const SCROLL_DEBOUNCE_MS = 150;

export interface UseChatScrollOptions {
    /**
     * Whether streaming is currently active. When true, auto-scroll uses
     * instant behavior to keep up with rapid token streams.
     */
    isStreaming?: boolean;

    /**
     * Callback when scroll-to-bottom is requested. Optional, for analytics.
     */
    onScrollToBottom?: () => void;
}

export interface UseChatScrollReturn {
    /**
     * Ref to attach to the scrollable container.
     */
    containerRef: React.RefObject<HTMLDivElement>;

    /**
     * Whether the user is currently at the bottom of the scroll area.
     * Use this to show/hide the scroll-to-bottom button.
     */
    isAtBottom: boolean;

    /**
     * Scroll to the bottom of the container.
     * @param behavior - 'smooth' for button clicks, 'instant' for streaming
     */
    scrollToBottom: (behavior?: ScrollBehavior) => void;
}

export function useChatScroll({
    isStreaming = false,
    onScrollToBottom,
}: UseChatScrollOptions = {}): UseChatScrollReturn {
    const containerRef = useRef<HTMLDivElement>(null);

    // State
    const [isAtBottom, setIsAtBottom] = useState(true);

    // Refs for tracking without triggering re-renders
    const isAtBottomRef = useRef(true);
    const lastScrollTopRef = useRef(0);
    const isUserScrollingRef = useRef(false);
    const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
        undefined
    );

    // Tracks current scroll animation to continue during resize
    const scrollingBehaviorRef = useRef<ScrollBehavior | null>(null);

    /**
     * Check if scroll position is at/near bottom.
     */
    const checkIfAtBottom = useCallback((): boolean => {
        const container = containerRef.current;
        if (!container) return true;

        const { scrollTop, scrollHeight, clientHeight } = container;
        // At bottom if: content fits without scroll, OR we're within threshold of bottom
        return (
            scrollHeight <= clientHeight ||
            scrollHeight - scrollTop - clientHeight < AT_BOTTOM_THRESHOLD
        );
    }, []);

    /**
     * Scroll to the bottom of the container.
     */
    const scrollToBottom = useCallback(
        (behavior: ScrollBehavior = "smooth") => {
            const container = containerRef.current;
            if (!container) return;

            // Track that we're scrolling to bottom (for resize continuation)
            scrollingBehaviorRef.current = behavior;

            container.scrollTo({
                top: container.scrollHeight,
                behavior,
            });

            // Update state immediately for responsive UI
            setIsAtBottom(true);
            isAtBottomRef.current = true;

            onScrollToBottom?.();
        },
        [onScrollToBottom]
    );

    /**
     * Handle scroll events - detect user intent and update state.
     */
    const handleScroll = useCallback(() => {
        const container = containerRef.current;
        if (!container) return;

        const { scrollTop } = container;
        const wasAtBottom = isAtBottomRef.current;
        const nowAtBottom = checkIfAtBottom();
        const scrolledUp = scrollTop < lastScrollTopRef.current;

        // Mark as user scrolling
        isUserScrollingRef.current = true;
        clearTimeout(scrollTimeoutRef.current);

        // Key insight: Only count as "left bottom" if user scrolled UP.
        // Content growth pushes scrollTop up, but that's not user intent to leave.
        if (scrolledUp && !nowAtBottom) {
            // User scrolled up - they want to read previous content
            if (wasAtBottom) {
                scrollingBehaviorRef.current = null; // Cancel any ongoing scroll
            }
            setIsAtBottom(false);
            isAtBottomRef.current = false;
        } else if (nowAtBottom) {
            // At bottom (either never left, or scrolled back down)
            if (!wasAtBottom) {
                // Clear scroll behavior - user returned to bottom manually
                scrollingBehaviorRef.current = null;
            }
            setIsAtBottom(true);
            isAtBottomRef.current = true;
        }

        lastScrollTopRef.current = scrollTop;

        // Debounce to detect when user stops scrolling
        scrollTimeoutRef.current = setTimeout(() => {
            isUserScrollingRef.current = false;
        }, SCROLL_DEBOUNCE_MS);
    }, [checkIfAtBottom]);

    /**
     * Handle content changes - auto-scroll if we should.
     */
    const handleContentChange = useCallback(() => {
        const container = containerRef.current;
        if (!container) return;

        // If we have an ongoing scroll animation, continue it
        const currentBehavior = scrollingBehaviorRef.current;
        if (currentBehavior) {
            container.scrollTo({
                top: container.scrollHeight,
                behavior: currentBehavior,
            });
            return;
        }

        // Only auto-scroll if:
        // 1. User is at bottom (was watching the stream)
        // 2. User is not actively scrolling (would fight with them)
        if (isAtBottomRef.current && !isUserScrollingRef.current) {
            // Use requestAnimationFrame for smooth visual update
            requestAnimationFrame(() => {
                container.scrollTo({
                    top: container.scrollHeight,
                    // Instant during streaming (keeps up with fast tokens)
                    // Smooth otherwise (feels more natural)
                    behavior: isStreaming ? "instant" : "auto",
                });

                // Verify we're still at bottom after scroll
                setIsAtBottom(true);
                isAtBottomRef.current = true;
            });
        }
    }, [isStreaming]);

    /**
     * Set up scroll listener and content observers.
     */
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        // Scroll listener
        container.addEventListener("scroll", handleScroll, { passive: true });

        // ResizeObserver for container and content size changes
        const resizeObserver = new ResizeObserver(handleContentChange);
        resizeObserver.observe(container);

        // Also observe children for individual element size changes
        // (e.g., images loading, code blocks expanding)
        for (const child of container.children) {
            resizeObserver.observe(child);
        }

        // MutationObserver for DOM structure changes
        // (new messages, text streaming in character by character)
        const mutationObserver = new MutationObserver(handleContentChange);
        mutationObserver.observe(container, {
            childList: true,
            subtree: true,
            characterData: true,
        });

        return () => {
            container.removeEventListener("scroll", handleScroll);
            resizeObserver.disconnect();
            mutationObserver.disconnect();
            clearTimeout(scrollTimeoutRef.current);
        };
    }, [handleScroll, handleContentChange]);

    /**
     * When streaming starts, scroll to bottom to show the new response.
     * Uses requestAnimationFrame to defer scroll outside React's render cycle,
     * avoiding the "setState in effect" anti-pattern.
     */
    useEffect(() => {
        if (isStreaming && isAtBottomRef.current) {
            scrollingBehaviorRef.current = "instant";
            // Defer scroll to next frame to avoid setState cascade
            const frameId = requestAnimationFrame(() => {
                const container = containerRef.current;
                if (container) {
                    container.scrollTo({
                        top: container.scrollHeight,
                        behavior: "instant",
                    });
                }
            });
            return () => cancelAnimationFrame(frameId);
        }
    }, [isStreaming]);

    return {
        containerRef: containerRef as React.RefObject<HTMLDivElement>,
        isAtBottom,
        scrollToBottom,
    };
}
