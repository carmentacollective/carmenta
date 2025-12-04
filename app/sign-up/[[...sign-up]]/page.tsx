import Image from "next/image";
import { SignUp } from "@clerk/nextjs";
import type { Metadata } from "next";

import { HolographicBackground } from "@/components/ui/holographic-background";

export const metadata: Metadata = {
    title: "Sign Up | Carmenta",
    description: "Start building together. Create your account.",
    robots: { index: false, follow: false },
};

export default function SignUpPage() {
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
                        Start building together
                    </p>
                </div>
                <SignUp
                    appearance={{
                        elements: {
                            rootBox: "mx-auto",
                            card: "glass-card border-0 shadow-none",
                            headerTitle: "text-foreground",
                            headerSubtitle: "text-muted-foreground",
                            socialButtonsBlockButton:
                                "bg-white/50 text-foreground hover:bg-white/80 border border-foreground/10 backdrop-blur-sm",
                            socialButtonsBlockButtonText: "text-foreground font-medium",
                            dividerLine: "bg-foreground/10",
                            dividerText: "text-muted-foreground",
                            formFieldLabel: "text-foreground",
                            formFieldInput:
                                "bg-white/50 border-foreground/10 text-foreground focus:ring-primary backdrop-blur-sm",
                            formButtonPrimary: "btn-holo border-0",
                            footerActionLink: "text-primary hover:text-primary/80",
                            identityPreviewEditButton: "text-primary",
                        },
                    }}
                    forceRedirectUrl="/connection"
                />
            </div>
        </div>
    );
}
