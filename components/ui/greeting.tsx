"use client";

import { useOptionalUser } from "@/lib/hooks/use-optional-user";

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
    const { user, isLoaded } = useOptionalUser();
    const isLoggedIn = isLoaded && !!user;
    const firstName = user?.firstName;
    const greeting = getGreeting();

    // Adapt subtitle based on auth state if not explicitly provided
    const defaultSubtitle = isLoggedIn
        ? "What shall we bring into focus?"
        : "AI that remembers. Multi-model access. Your AI team ready to help.";

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
