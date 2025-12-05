"use client";

import { UserButton, useAuth } from "@clerk/nextjs";
import { UserCircle2 } from "lucide-react";

/**
 * UserButton that renders when signed in (works in keyless mode too).
 * Shows a custom glass morphism icon instead of the default avatar,
 * with the popup styled to match Carmenta's holographic design.
 *
 * The global clerkAppearance handles most styling - this component
 * only adds the icon overlay and hides the default avatar.
 */
export function OptionalUserButton() {
    const { isLoaded, isSignedIn } = useAuth();

    // Don't render until Clerk loads, or if not signed in
    if (!isLoaded || !isSignedIn) {
        return null;
    }

    return (
        <div className="group relative">
            {/* Glass morphism icon overlay - matches Oracle styling */}
            <div className="pointer-events-none absolute inset-0 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-md ring-1 ring-white/70 backdrop-blur-xl transition-all duration-200 group-hover:scale-105 group-hover:ring-primary/30">
                <UserCircle2 className="h-7 w-7 text-foreground/50 transition-colors group-hover:text-foreground/80" />
            </div>
            {/* Clerk UserButton - functional but avatar visually hidden */}
            <UserButton
                appearance={{
                    elements: {
                        // Hide default avatar (our custom icon shows instead)
                        avatarBox: "h-12 w-12",
                        avatarImage: "opacity-0",
                    },
                }}
            />
        </div>
    );
}
