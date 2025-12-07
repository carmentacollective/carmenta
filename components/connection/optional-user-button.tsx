"use client";

import { useAuth, useUser, useClerk } from "@clerk/nextjs";
import { User, LogOut, Moon, Sun, UserCircle2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

import { cn } from "@/lib/utils";

// Track whether we're on the client
const subscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

/**
 * Custom user menu button matching ConnectionChooser style.
 * Glass morphism design with profile picture, theme switcher, and account management.
 */
export function OptionalUserButton() {
    const { isLoaded, isSignedIn } = useAuth();
    const { user } = useUser();
    const { signOut, openUserProfile } = useClerk();
    const [isOpen, setIsOpen] = useState(false);
    const isClient = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
    const { resolvedTheme, setTheme } = useTheme();

    // Reserve space to prevent layout shift
    if (!isLoaded || !isSignedIn || !user) {
        return <div className="h-12 w-12" aria-hidden="true" />;
    }

    const profileImageUrl = user.imageUrl;
    const displayName = user.fullName || user.firstName || "User";
    const email = user.primaryEmailAddress?.emailAddress;

    const isDark = resolvedTheme === "dark";
    const toggleTheme = () => {
        setTheme(isDark ? "light" : "dark");
    };

    return (
        <>
            {/* Trigger button - UserCircle icon */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="btn-icon-glass group relative"
                aria-label="User menu"
            >
                <UserCircle2 className="h-6 w-6 text-foreground/50 transition-colors group-hover:text-foreground/80 sm:h-7 sm:w-7" />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            className="fixed inset-0 z-40"
                            onClick={() => setIsOpen(false)}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.15 }}
                        />

                        {/* Dropdown menu */}
                        <motion.div
                            className="fixed right-2 top-20 z-50 sm:right-4 md:right-12"
                            initial={{ opacity: 0, y: -12, scale: 0.96 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -8, scale: 0.98 }}
                            transition={{
                                duration: 0.2,
                                ease: [0.16, 1, 0.3, 1],
                            }}
                        >
                            <div className="glass-container w-64 overflow-hidden rounded-2xl shadow-2xl">
                                {/* User info header */}
                                <div className="border-b border-foreground/10 px-4 py-3">
                                    <div className="flex items-center gap-3">
                                        {profileImageUrl ? (
                                            <img
                                                src={profileImageUrl}
                                                alt={displayName}
                                                className="h-10 w-10 rounded-full object-cover"
                                            />
                                        ) : (
                                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                                                {displayName.charAt(0).toUpperCase()}
                                            </div>
                                        )}
                                        <div className="flex-1 overflow-hidden">
                                            <div className="truncate text-sm font-medium text-foreground">
                                                {displayName}
                                            </div>
                                            <div className="truncate text-xs text-foreground/60">
                                                {email}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Menu items */}
                                <div className="py-1">
                                    <button
                                        onClick={() => {
                                            openUserProfile();
                                            setIsOpen(false);
                                        }}
                                        className="group relative flex w-full items-center gap-3 px-4 py-2.5 text-sm text-foreground/80 transition-all hover:text-foreground"
                                    >
                                        <div className="absolute inset-0 bg-primary/5 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                                        <User className="relative h-4 w-4 text-foreground/60" />
                                        <span className="relative">Manage account</span>
                                    </button>

                                    {/* Theme switcher */}
                                    {isClient && (
                                        <button
                                            onClick={toggleTheme}
                                            className="group relative flex w-full items-center gap-3 px-4 py-2.5 text-sm text-foreground/80 transition-all hover:text-foreground"
                                        >
                                            <div className="absolute inset-0 bg-primary/5 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                                            {isDark ? (
                                                <>
                                                    <Moon className="relative h-4 w-4 text-foreground/60" />
                                                    <span className="relative">
                                                        Dark mode
                                                    </span>
                                                </>
                                            ) : (
                                                <>
                                                    <Sun className="relative h-4 w-4 text-foreground/60" />
                                                    <span className="relative">
                                                        Light mode
                                                    </span>
                                                </>
                                            )}
                                        </button>
                                    )}

                                    <button
                                        onClick={() => {
                                            signOut();
                                            setIsOpen(false);
                                        }}
                                        className="group relative flex w-full items-center gap-3 px-4 py-2.5 text-sm text-foreground/80 transition-all hover:text-foreground"
                                    >
                                        <div className="absolute inset-0 bg-primary/5 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                                        <LogOut className="relative h-4 w-4 text-foreground/60" />
                                        <span className="relative">Sign out</span>
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    );
}
