"use client";

import Image from "next/image";
import { SignIn, useUser } from "@clerk/nextjs";
import { useEffect, useSyncExternalStore } from "react";

const EMAIL_STORAGE_KEY = "carmenta_remembered_email";

function getStoredEmail(): string | undefined {
    if (typeof window === "undefined") return undefined;
    return localStorage.getItem(EMAIL_STORAGE_KEY) ?? undefined;
}

function subscribeToStorage(callback: () => void): () => void {
    window.addEventListener("storage", callback);
    return () => window.removeEventListener("storage", callback);
}

/**
 * Wrapper around Clerk's SignIn component that:
 * 1. Pre-fills email from localStorage (remembers returning users)
 * 2. Saves email to localStorage when user signs in
 * 3. Keeps all of Clerk's auth methods (OAuth, magic links, MFA, etc.)
 */
export function EnterAuthWrapper() {
    const { user, isSignedIn } = useUser();

    // Use useSyncExternalStore for hydration-safe localStorage access
    const rememberedEmail = useSyncExternalStore(
        subscribeToStorage,
        getStoredEmail,
        () => undefined // Server snapshot
    );

    // Save email when user signs in
    useEffect(() => {
        if (isSignedIn && user?.primaryEmailAddress?.emailAddress) {
            localStorage.setItem(
                EMAIL_STORAGE_KEY,
                user.primaryEmailAddress.emailAddress
            );
        }
    }, [isSignedIn, user]);

    return (
        <>
            {/* Logo and heading */}
            <div className="mb-8 flex flex-col items-center text-center">
                <Image
                    src="/logos/icon-transparent.png"
                    alt="Carmenta"
                    width={64}
                    height={64}
                    className="mb-4 h-16 w-16"
                    priority
                />
                <h1 className="text-2xl font-semibold tracking-tight text-foreground/90">
                    Enter Carmenta
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                    {rememberedEmail ? "Welcome back" : "We remember you"}
                </p>
            </div>

            {/* Clerk SignIn with all auth methods */}
            <SignIn
                initialValues={
                    rememberedEmail ? { emailAddress: rememberedEmail } : undefined
                }
                appearance={{
                    elements: {
                        // Remove card shadow since we have HolographicBackground
                        card: "glass-card border-0 shadow-none",
                    },
                }}
                forceRedirectUrl="/connection"
            />
        </>
    );
}
