"use client";

import { useUserContext } from "@/lib/auth/user-context";

/**
 * Get time-appropriate greeting.
 */
function getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
}

interface GreetingProps {
    className?: string;
    subtitleClassName?: string;
    subtitle?: string;
}

/**
 * Dynamic greeting that adapts to authentication state.
 *
 * Logged in: "Good morning, Nick" + custom or default subtitle
 * Logged out: "Good morning" (no awkward "there") + landing-appropriate subtitle
 */
export function Greeting({ className, subtitleClassName, subtitle }: GreetingProps) {
    const { user, isLoaded } = useUserContext();
    const isLoggedIn = isLoaded && !!user;
    const firstName = user?.firstName;
    const greeting = getGreeting();

    // Adapt subtitle based on auth state if not explicitly provided
    const defaultSubtitle = isLoggedIn
        ? "What are we creating together?"
        : "AI that remembers you. Multi-model access. Your team.";

    const displaySubtitle = subtitle ?? defaultSubtitle;

    return (
        <>
            <h1 className={className}>
                {greeting}
                {isLoaded && firstName ? `, ${firstName}` : ""}
            </h1>
            {displaySubtitle && <p className={subtitleClassName}>{displaySubtitle}</p>}
        </>
    );
}
