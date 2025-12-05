import type { Metadata } from "next";

import { Chat, ConnectLayout } from "@/components/connection";
import { HolographicBackground } from "@/components/ui/holographic-background";
import { getRecentConnections } from "@/lib/actions/connections";

export const metadata: Metadata = {
    title: "Connect | Carmenta",
    description:
        "Connect with Carmenta - a heart-centered AI interface for thinking together.",
};

/**
 * Connection Page - New Chat Interface
 *
 * Renders an empty chat interface without creating a database record.
 * The connection is created lazily when the user sends their first message.
 *
 * This is the canonical URL for starting a new conversation.
 * /connection/new redirects here for fresh page loads.
 */
export default async function ConnectionPage() {
    // Load recent connections for the header dropdown (auth protected by middleware)
    const recentConnections = await getRecentConnections(10);

    return (
        <div className="relative h-screen overflow-hidden">
            <HolographicBackground />

            <div className="relative z-10 h-full">
                <ConnectLayout
                    initialConnections={recentConnections}
                    activeConnection={null}
                    initialMessages={[]}
                >
                    <Chat />
                </ConnectLayout>
            </div>
        </div>
    );
}
