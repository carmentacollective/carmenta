import type { Metadata } from "next";
import { currentUser } from "@clerk/nextjs/server";

import { Chat, ConnectLayout } from "@/components/connection";
import { HolographicBackground } from "@/components/ui/holographic-background";
import { getRecentConnections } from "@/lib/actions/connections";
import { resetDiscoveryState } from "@/lib/discovery";
import { findUserByClerkId } from "@/lib/db/users";

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
 * Discovery: Use ?reset-discovery=true to reset discovery state for testing.
 *
 * NOTE: Intentionally uses ConnectLayout instead of standard SiteHeader/Footer.
 * The chat interface has its own header (Oracle + Connection Chooser + Account)
 * optimized for the conversational context. No footer in chat mode to maximize
 * vertical space for messages. This is a focused, distraction-free interface.
 */
export default async function ConnectionPage({ searchParams }: ConnectionPageProps) {
    // Load recent connections for the header dropdown (auth protected by middleware)
    const recentConnections = await getRecentConnections(10);

    // Handle discovery reset for testing (development only)
    const params = await searchParams;
    if (params["reset-discovery"] === "true" && process.env.NODE_ENV !== "production") {
        const user = await currentUser();
        if (user) {
            const dbUser = await findUserByClerkId(user.id);
            if (dbUser) {
                await resetDiscoveryState(dbUser.id);
            }
        }
    }

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
