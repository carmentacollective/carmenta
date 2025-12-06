"use client";

import { useAuth, useUser, useClerk } from "@clerk/nextjs";
import { UserCircle2, User, LogOut } from "lucide-react";
import * as Popover from "@radix-ui/react-popover";

/**
 * Custom user menu button that matches the Oracle icon style.
 * Clean glass morphism design with our own menu - no Clerk styling wrestling.
 */
export function OptionalUserButton() {
    const { isLoaded, isSignedIn } = useAuth();
    const { user } = useUser();
    const { signOut, openUserProfile } = useClerk();

    // Reserve space to prevent layout shift
    if (!isLoaded || !isSignedIn || !user) {
        return <div className="h-12 w-12" aria-hidden="true" />;
    }

    return (
        <Popover.Root>
            <Popover.Trigger asChild>
                <button className="btn-icon-glass group" aria-label="User menu">
                    <UserCircle2 className="h-6 w-6 text-foreground/50 transition-colors group-hover:text-foreground/80 sm:h-7 sm:w-7" />
                </button>
            </Popover.Trigger>

            <Popover.Portal>
                <Popover.Content
                    align="end"
                    sideOffset={8}
                    className="z-50 min-w-[200px] rounded-2xl border border-white/60 bg-white/90 p-2 shadow-[0_8px_32px_rgba(180,140,200,0.25),0_0_0_1px_rgba(255,255,255,0.5)] backdrop-blur-xl"
                >
                    {/* User info */}
                    <div className="px-3 py-2 text-sm">
                        <div className="font-medium text-foreground">
                            {user.fullName || user.firstName || "User"}
                        </div>
                        <div className="text-muted-foreground">
                            {user.primaryEmailAddress?.emailAddress}
                        </div>
                    </div>

                    {/* Divider */}
                    <div className="my-1 h-px bg-foreground/5" />

                    {/* Menu items */}
                    <button
                        onClick={() => openUserProfile()}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-foreground transition-colors hover:bg-white/60"
                    >
                        <User className="h-4 w-4 text-foreground/60" />
                        Manage account
                    </button>

                    <button
                        onClick={() => signOut()}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-foreground transition-colors hover:bg-white/60"
                    >
                        <LogOut className="h-4 w-4 text-foreground/60" />
                        Sign out
                    </button>
                </Popover.Content>
            </Popover.Portal>
        </Popover.Root>
    );
}
