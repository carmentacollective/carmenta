"use client";

import { UserButton } from "@clerk/nextjs";
import { UserCircle2 } from "lucide-react";

import { env } from "@/lib/env";

/**
 * UserButton that only renders when Clerk keys are configured.
 * Shows a User icon instead of profile picture for consistent UI.
 */
export function OptionalUserButton() {
    const hasClerkKeys = !!env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

    if (!hasClerkKeys) {
        return null;
    }

    return (
        <div className="group relative">
            {/* Glass morphism icon overlay - matches Oracle styling */}
            <div className="pointer-events-none absolute inset-0 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-md ring-1 ring-white/70 backdrop-blur-xl transition-all duration-200 group-hover:scale-105 group-hover:ring-primary/30">
                <UserCircle2 className="h-7 w-7 text-foreground/50 transition-colors group-hover:text-foreground/80" />
            </div>
            {/* Clerk UserButton - underneath, functional but visually hidden */}
            <UserButton
                appearance={{
                    elements: {
                        avatarBox: "h-12 w-12",
                        avatarImage: "opacity-0",
                        userButtonPopoverCard:
                            "bg-white/80 backdrop-blur-xl border border-white/60 shadow-lg",
                        userButtonPopoverActionButton:
                            "text-foreground hover:bg-white/50",
                        userButtonPopoverActionButtonText: "text-foreground",
                        userButtonPopoverFooter: "hidden",
                    },
                }}
            />
        </div>
    );
}
