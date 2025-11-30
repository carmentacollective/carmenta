"use client";

import { UserButton } from "@clerk/nextjs";

import { env } from "@/lib/env";

/**
 * UserButton that only renders when Clerk keys are configured
 */
export function OptionalUserButton() {
    const hasClerkKeys = !!env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

    if (!hasClerkKeys) {
        return null;
    }

    return (
        <UserButton
            appearance={{
                elements: {
                    avatarBox: "h-8 w-8",
                    userButtonPopoverCard:
                        "bg-white/80 backdrop-blur-xl border border-white/60 shadow-lg",
                    userButtonPopoverActionButton: "text-foreground hover:bg-white/50",
                    userButtonPopoverActionButtonText: "text-foreground",
                    userButtonPopoverFooter: "hidden",
                },
            }}
        />
    );
}
