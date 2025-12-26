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

/** Get time-of-day greeting */
function getTimeGreeting(): string {
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
 * Elegant greeting with time-awareness and refined typography.
 *
 * Uses Cormorant Garamond italic for the name - warm, intimate, luxurious.
 * Time-of-day greeting creates presence: "Good evening, Nick"
 *
 * Birthday: "Happy Birthday, Nick! 🎂" + celebratory subtitle
 * Logged in: "Good [time], Nick" + "What are we creating together?"
 * Logged out: "Good [time]" + landing-appropriate subtitle
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
    const timeGreeting = getTimeGreeting();

    // Adapt subtitle based on auth state and special occasions
    const defaultSubtitle = hasBirthday
        ? "Today is YOUR day. Let's make it magical. ✨"
        : isLoggedIn
          ? "What are we creating together?"
          : "AI that remembers you. Multi-model access. Your team.";

    const displaySubtitle = subtitle ?? defaultSubtitle;

    if (!isLoaded) return null;

    // Birthday gets special treatment
    if (hasBirthday) {
        return (
            <div className="greeting-container animate-greeting-enter">
                <h1 className={cn("greeting-name-only", className)}>
                    {firstName}
                    <span className="greeting-emoji">🎂</span>
                </h1>
            </div>
        );
    }

    // Logged in: Hi, Name with wave + subtitle
    if (firstName) {
        return (
            <div className="greeting-container animate-greeting-enter">
                <h1 className={cn("greeting-name-only", className)}>
                    Hi, {firstName}
                    <span className="greeting-wave">👋</span>
                </h1>
                <p className={cn("greeting-subtitle", subtitleClassName)}>
                    {displaySubtitle}
                </p>
            </div>
        );
    }

    // Logged out: Welcome message
    return (
        <div className="greeting-container animate-greeting-enter">
            <h1 className={cn("greeting-name-only", className)}>Welcome</h1>
        </div>
    );
}
