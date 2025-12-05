import type { Metadata } from "next";

import { Chat, ConnectLayout } from "@/components/connection";
import { HolographicBackground } from "@/components/ui/holographic-background";
import { getRecentConnections } from "@/lib/actions/connections";

export const metadata: Metadata = {
    title: "New Connection | Carmenta",
    description:
        "Start a new connection with Carmenta - a heart-centered AI interface for thinking together.",
};

/**
 * New Connection Page
 *
 * Renders an empty chat interface without creating a database record.
 * The connection is created lazily when the user sends their first message.
 *
 * This follows the pattern used by Vercel's ai-chatbot and LibreChat:
 * - /connection/new shows empty chat (no DB record)
 * - First message creates connection with title from concierge
 * - URL updates to /connection/[slug] via replaceState
 */
export default async function NewConnectionPage() {
    // Load recent connections for the header dropdown
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
