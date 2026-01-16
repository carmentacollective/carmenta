"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { UploadIcon } from "@phosphor-icons/react";

import { StandardPageLayout } from "@/components/layouts/standard-page-layout";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ImportWidget } from "@/components/import/import-widget";

/**
 * Import page for bringing data from other AI platforms into Carmenta
 *
 * Supports two modes:
 * - Full import: conversations + knowledge extraction
 * - Knowledge-only: extract knowledge without importing conversations
 *
 * The default mode is "full" for the dedicated import page.
 */
export default function ImportPage() {
    const router = useRouter();
    const { isLoaded, isSignedIn } = useAuth();

    // Redirect to sign-in if not authenticated
    useEffect(() => {
        if (isLoaded && !isSignedIn) {
            router.push("/sign-in?redirect_url=/import");
        }
    }, [isLoaded, isSignedIn, router]);

    // Show loading while checking auth, or nothing if not signed in (redirect in progress)
    if (!isLoaded || !isSignedIn) {
        return (
            <StandardPageLayout maxWidth="standard" verticalPadding="normal">
                <div className="flex min-h-[50vh] items-center justify-center">
                    <LoadingSpinner size={32} />
                </div>
            </StandardPageLayout>
        );
    }

    return (
        <StandardPageLayout maxWidth="standard" verticalPadding="normal">
            <div className="space-y-6">
                {/* Header */}
                <div className="space-y-2">
                    <div className="flex items-center gap-3">
                        <div className="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-lg">
                            <UploadIcon className="h-5 w-5" weight="duotone" />
                        </div>
                        <h1 className="text-2xl font-semibold tracking-tight">
                            Bring your AI history home
                        </h1>
                    </div>
                    <p className="text-muted-foreground">
                        Your past connections become the foundation we build on
                        together.
                    </p>
                </div>

                {/* Import Widget - Full Mode */}
                <ImportWidget mode="full" showStepper />
            </div>
        </StandardPageLayout>
    );
}
