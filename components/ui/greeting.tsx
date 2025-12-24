"use client";

import { cn } from "@/lib/utils";
import { useUserContext } from "@/lib/auth/user-context";

/** Birthday config - month is 0-indexed (December = 11) */
const BIRTHDAYS: Record<string, { month: number; day: number }> = {
    Nick: { month: 11, day: 9 },
};

/** Check if today is someone's birthday */
function isBirthday(firstName: string): boolean {
    const config = BIRTHDAYS[firstName];
    if (!config) return false;
    const today = new Date();
    return today.getMonth() === config.month && today.getDate() === config.day;
}

interface GreetingProps {
    className?: string;
    subtitleClassName?: string;
    subtitle?: string;
}

/**
 * Greeting that adapts to authentication state and special occasions.
 *
 * Birthday: "Happy Birthday, Nick! 🎂" + celebratory subtitle
 * Logged in: "Hey, Nick" + "What are we creating together?"
 * Logged out: "Hey" + landing-appropriate subtitle
 *
 * Features theme-adaptive gradient text that adjusts colors based on
 * light/dark mode and theme variant via CSS custom properties.
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
    const hasBirthday = firstName ? isBirthday(firstName) : false;

    // Adapt subtitle based on auth state and special occasions
    const defaultSubtitle = hasBirthday
        ? "Today is YOUR day. Let's make it magical. ✨"
        : isLoggedIn
          ? "What are we creating together?"
          : "AI that remembers you. Multi-model access. Your team.";

    const displaySubtitle = subtitle ?? defaultSubtitle;

    // Build the complete greeting text
    const greetingText = hasBirthday
        ? `Happy Birthday, ${firstName}! 🎂`
        : firstName
          ? `Hey, ${firstName}`
          : "Hey";

    if (!isLoaded) return null;

    return (
        <div className="greeting-container">
            <h1 className={cn("greeting-gradient", className)}>{greetingText}</h1>
            {displaySubtitle && (
                <p className={cn("greeting-subtitle", subtitleClassName)}>
                    {displaySubtitle}
                </p>
            )}
        </div>
    );
}
