"use client";

import { AnimatePresence, motion } from "framer-motion";

import { useUserContext } from "@/lib/auth/user-context";

interface GreetingProps {
    className?: string;
    subtitleClassName?: string;
    subtitle?: string;
}

/**
 * Greeting that adapts to authentication state.
 *
 * Logged in: "Hey, Nick" + "What are we creating together?"
 * Logged out: "Hey" + landing-appropriate subtitle
 *
 * Waits for auth state to load before rendering, so the greeting animates in
 * with the complete content—no awkward "Hey" → "Hey, Nick" flash.
 */
export function Greeting({ className, subtitleClassName, subtitle }: GreetingProps) {
    // Safely get user context - may be null during SSR
    let user = null;
    let isLoaded = false;
    try {
        const context = useUserContext();
        user = context.user;
        isLoaded = context.isLoaded;
    } catch {
        // During SSR or if context not available, use defaults
        isLoaded = false;
        user = null;
    }

    const isLoggedIn = isLoaded && !!user;
    const firstName = user?.firstName;

    // Adapt subtitle based on auth state if not explicitly provided
    const defaultSubtitle = isLoggedIn
        ? "What are we creating together?"
        : "AI that remembers you. Multi-model access. Your team.";

    const displaySubtitle = subtitle ?? defaultSubtitle;

    // Build the complete greeting text
    const greetingText = firstName ? `Hey, ${firstName}` : "Hey";

    return (
        <AnimatePresence mode="wait">
            {isLoaded && (
                <motion.div
                    key="greeting"
                    initial="hidden"
                    animate="visible"
                    variants={{
                        hidden: {},
                        visible: {
                            transition: {
                                staggerChildren: 0.15,
                            },
                        },
                    }}
                >
                    <motion.h1
                        className={className}
                        variants={{
                            hidden: { opacity: 0, y: 12 },
                            visible: {
                                opacity: 1,
                                y: 0,
                                transition: {
                                    duration: 0.5,
                                    ease: [0.25, 0.46, 0.45, 0.94],
                                },
                            },
                        }}
                    >
                        {greetingText}
                    </motion.h1>
                    {displaySubtitle && (
                        <motion.p
                            className={subtitleClassName}
                            variants={{
                                hidden: { opacity: 0, y: 8 },
                                visible: {
                                    opacity: 1,
                                    y: 0,
                                    transition: {
                                        duration: 0.5,
                                        ease: [0.25, 0.46, 0.45, 0.94],
                                    },
                                },
                            }}
                        >
                            {displaySubtitle}
                        </motion.p>
                    )}
                </motion.div>
            )}
        </AnimatePresence>
    );
}
