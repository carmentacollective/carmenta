"use client";

import Image from "next/image";
import { SignIn, useUser } from "@clerk/nextjs";
import { useEffect, useSyncExternalStore, useRef } from "react";
import { analytics } from "@/lib/analytics/events";

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
    const hasTrackedPageView = useRef(false);
    const hasTrackedSignIn = useRef(false);

    // Use useSyncExternalStore for hydration-safe localStorage access
    const rememberedEmail = useSyncExternalStore(
        subscribeToStorage,
        getStoredEmail,
        () => undefined // Server snapshot
    );

    // Track page view once on mount
    useEffect(() => {
        if (!hasTrackedPageView.current) {
            hasTrackedPageView.current = true;
            analytics.auth.signInPageViewed({
                isReturningUser: !!rememberedEmail,
            });

            if (rememberedEmail) {
                analytics.auth.returningUserDetected();
            }
        }
    }, [rememberedEmail]);

    // Save email when user signs in and track completion
    useEffect(() => {
        if (isSignedIn && user?.primaryEmailAddress?.emailAddress) {
            localStorage.setItem(
                EMAIL_STORAGE_KEY,
                user.primaryEmailAddress.emailAddress
            );

            // Track sign-in completion once
            if (!hasTrackedSignIn.current) {
                hasTrackedSignIn.current = true;
                analytics.auth.signInCompleted({
                    isReturningUser: !!rememberedEmail,
                });
            }
        }
    }, [isSignedIn, user, rememberedEmail]);

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
                <h1 className="text-foreground/90 text-2xl font-semibold tracking-tight">
                    Enter Carmenta
                </h1>
                {rememberedEmail && (
                    <p className="text-muted-foreground mt-2 text-sm">
                        Ready to continue.
                    </p>
                )}
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
