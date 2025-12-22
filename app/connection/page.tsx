import type { Metadata } from "next";

import { Chat, ConnectLayout } from "@/components/connection";
import { HolographicBackground } from "@/components/ui/holographic-background";
import { getRecentConnections } from "@/lib/actions/connections";
import { getOnboardingStatus, OnboardingProvider } from "@/lib/onboarding";

export const metadata: Metadata = {
    title: "Create · Carmenta",
    description: "Start a connection. We'll think through it together.",
};

interface ConnectionPageProps {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

/**
 * Connection Page - New Chat Interface
 *
 * Renders an empty chat interface without creating a database record.
 * The connection is created lazily when the user sends their first message.
 *
 * This is the canonical URL for starting a new conversation.
 * /connection/new redirects here for fresh page loads.
 *
 * Onboarding: If the user hasn't completed onboarding, they'll see Carmenta's
 * welcome prompts instead of the empty chat. Use ?reset-onboarding=true to
 * reset onboarding for testing.
 *
 * NOTE: Intentionally uses ConnectLayout instead of standard SiteHeader/Footer.
 * The chat interface has its own header (Oracle + Connection Chooser + Account)
 * optimized for the conversational context. No footer in chat mode to maximize
 * vertical space for messages. This is a focused, distraction-free interface.
 */
export default async function ConnectionPage({ searchParams }: ConnectionPageProps) {
    // Load recent connections and onboarding status in parallel
    const [recentConnections, onboardingStatus] = await Promise.all([
        getRecentConnections(10),
        getOnboardingStatus(),
    ]);

    // Check for reset flag (handled by client component)
    const params = await searchParams;
    const shouldReset = params["reset-onboarding"] === "true";

    return (
        <div className="fixed inset-0 overflow-hidden">
            <HolographicBackground />

            <div className="relative z-10 h-full">
                <OnboardingProvider
                    initialStatus={onboardingStatus}
                    key={shouldReset ? "resetting" : "normal"}
                >
                    <ConnectLayout
                        initialConnections={recentConnections}
                        activeConnection={null}
                        initialMessages={[]}
                    >
                        <Chat shouldResetOnboarding={shouldReset} />
                    </ConnectLayout>
                </OnboardingProvider>
            </div>
        </div>
    );
}
