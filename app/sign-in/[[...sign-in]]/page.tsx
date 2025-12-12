import Image from "next/image";
import { SignIn } from "@clerk/nextjs";
import type { Metadata } from "next";

import { HolographicBackground } from "@/components/ui/holographic-background";

export const metadata: Metadata = {
    title: "Welcome Back · Carmenta",
    description: "Welcome back. Pick up where we left off.",
    robots: { index: false, follow: false },
};

export default function SignInPage() {
    return (
        <div className="relative flex min-h-screen flex-col">
            <HolographicBackground />

            <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6">
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
                        Carmenta
                    </h1>
                    <p className="mt-2 text-sm text-muted-foreground">
                        Welcome back. Pick up where we left off.
                    </p>
                </div>
                <SignIn
                    appearance={{
                        elements: {
                            // Page-specific: remove card shadow since we have HolographicBackground
                            card: "glass-card border-0 shadow-none",
                        },
                    }}
                    forceRedirectUrl="/connection"
                />
            </div>
        </div>
    );
}
