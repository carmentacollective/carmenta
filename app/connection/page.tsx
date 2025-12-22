import type { Metadata } from "next";

import { Chat, ConnectLayout } from "@/components/connection";
import { HolographicBackground } from "@/components/ui/holographic-background";
import { getRecentConnections } from "@/lib/actions/connections";

export const metadata: Metadata = {
    title: "Create · Carmenta",
    description: "Start a connection. We'll think through it together.",
};

/**
 * Connection Page - New Chat Interface
 *
 * Renders an empty chat interface without creating a database record.
 * The connection is created lazily when the user sends their first message.
 *
 * This is the canonical URL for starting a new conversation.
 * /connection/new redirects here for fresh page loads.
 *
 * NOTE: Intentionally uses ConnectLayout instead of standard SiteHeader/Footer.
 * The chat interface has its own header (Oracle + Connection Chooser + Account)
 * optimized for the conversational context. No footer in chat mode to maximize
 * vertical space for messages. This is a focused, distraction-free interface.
 */
export default async function ConnectionPage() {
    // Load recent connections for the header dropdown (auth protected by middleware)
    const recentConnections = await getRecentConnections(10);

    return (
        <div className="fixed inset-0 overflow-hidden">
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
