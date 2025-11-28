"use client";

import { useUser } from "@clerk/nextjs";

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
 * Dynamic greeting that displays the user's first name and time-appropriate salutation.
 * Falls back to "there" if user is not logged in.
 */
export function Greeting({
    className,
    subtitleClassName,
    subtitle = "What would you like to bring into focus?",
}: GreetingProps) {
    const { user, isLoaded } = useUser();
    const firstName = user?.firstName || "there";
    const greeting = getGreeting();

    return (
        <>
            <h1 className={className}>
                {greeting}, {isLoaded ? firstName : "..."}
            </h1>
            {subtitle && <p className={subtitleClassName}>{subtitle}</p>}
        </>
    );
}
