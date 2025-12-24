"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useClerk } from "@clerk/nextjs";
import { useEffect, useState } from "react";

import { HolographicBackground } from "@/components/ui/holographic-background";
import { logger } from "@/lib/client-logger";

/**
 * Exit page - handles signing out with a graceful transition
 */
export default function ExitPage() {
    const router = useRouter();
    const { signOut } = useClerk();
    const [isExiting, setIsExiting] = useState(false);
    const [error, setError] = useState(false);

    useEffect(() => {
        const handleExit = async () => {
            try {
                setIsExiting(true);
                await signOut();
                // Short delay for the animation to show
                setTimeout(() => {
                    router.push("/");
                }, 500);
            } catch (err) {
                logger.error({ error: err }, "Sign out failed");
                setError(true);
                setIsExiting(false);
            }
        };

        handleExit();
    }, [signOut, router]);

    return (
        <div className="relative flex min-h-screen flex-col">
            <HolographicBackground />

            <div className="relative z-content flex min-h-screen flex-col items-center justify-center px-6">
                <div className="flex flex-col items-center text-center">
                    <Image
                        src="/logos/icon-transparent.png"
                        alt="Carmenta"
                        width={64}
                        height={64}
                        className={`mb-4 h-16 w-16 transition-opacity duration-500 ${
                            isExiting ? "opacity-50" : "opacity-100"
                        }`}
                        priority
                    />
                    <h1 className="text-2xl font-semibold tracking-tight text-foreground/90">
                        {error
                            ? "Something went wrong"
                            : isExiting
                              ? "Until next time"
                              : "Exiting..."}
                    </h1>
                    <p className="mt-2 text-sm text-muted-foreground">
                        {error
                            ? "We couldn't sign you out. Please try again."
                            : "We'll remember where we left off"}
                    </p>
                    {error && (
                        <button
                            onClick={() => router.push("/")}
                            className="mt-4 text-sm font-medium text-primary hover:text-primary/80"
                        >
                            Return home
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
