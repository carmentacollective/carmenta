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
    // Start with isExiting true since sign-out begins immediately on mount
    const [isExiting, setIsExiting] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        const handleExit = async () => {
            try {
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

            <div className="z-content relative flex min-h-screen flex-col items-center justify-center px-6">
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
                    <h1 className="text-foreground/90 text-2xl font-semibold tracking-tight">
                        {error
                            ? "Something went wrong"
                            : isExiting
                              ? "Until next time"
                              : "Exiting..."}
                    </h1>
                    <p className="text-muted-foreground mt-2 text-sm">
                        {error
                            ? "Couldn't sign you out. The bots are on it. 🤖"
                            : "We'll remember where we left off"}
                    </p>
                    {error && (
                        <div className="mt-4 flex gap-3">
                            <button
                                onClick={() => {
                                    if (isExiting) return;
                                    setError(false);
                                    setIsExiting(true);
                                    signOut()
                                        .then(() => router.push("/"))
                                        .catch((err) => {
                                            logger.error(
                                                { error: err },
                                                "Sign out retry failed"
                                            );
                                            setError(true);
                                            setIsExiting(false);
                                        });
                                }}
                                disabled={isExiting}
                                className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
                            >
                                Try Again
                            </button>
                            <button
                                onClick={() => router.push("/")}
                                className="text-foreground/70 hover:text-foreground text-sm font-medium"
                            >
                                Return home
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
