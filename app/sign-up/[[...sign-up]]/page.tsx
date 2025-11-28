import { SignUp } from "@clerk/nextjs";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Sign Up | Carmenta",
    description: "Start building together. Create your account.",
    robots: { index: false, follow: false },
};

export default function SignUpPage() {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-background">
            <div className="mb-8 text-center">
                <h1 className="text-2xl font-bold tracking-tight">CARMENTA_</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                    Start building together
                </p>
            </div>
            <SignUp
                appearance={{
                    elements: {
                        rootBox: "mx-auto",
                        card: "bg-card border border-border shadow-none",
                        headerTitle: "text-foreground",
                        headerSubtitle: "text-muted-foreground",
                        socialButtonsBlockButton:
                            "bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border",
                        socialButtonsBlockButtonText: "text-foreground font-medium",
                        dividerLine: "bg-border",
                        dividerText: "text-muted-foreground",
                        formFieldLabel: "text-foreground",
                        formFieldInput:
                            "bg-background border-border text-foreground focus:ring-primary",
                        formButtonPrimary:
                            "bg-primary text-primary-foreground hover:bg-primary/90",
                        footerActionLink: "text-primary hover:text-primary/80",
                        identityPreviewEditButton: "text-primary",
                    },
                }}
                forceRedirectUrl="/connect"
            />
        </div>
    );
}
