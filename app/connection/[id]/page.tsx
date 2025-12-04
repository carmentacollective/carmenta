import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Chat, ConnectLayout } from "@/components/connection";
import { HolographicBackground } from "@/components/ui/holographic-background";
import { loadConnection, getRecentConnections } from "@/lib/actions/connections";

export const metadata: Metadata = {
    title: "Connect | Carmenta",
    description:
        "Connect with Carmenta - a heart-centered AI interface for thinking together.",
};

interface ConnectionPageProps {
    params: Promise<{ id: string }>;
}

export default async function ConnectionPage({ params }: ConnectionPageProps) {
    const { id } = await params;

    // Load the connection and its messages
    const result = await loadConnection(id);

    if (!result) {
        notFound();
    }

    const { connection, messages } = result;

    // Also load recent connections for the header dropdown
    const recentConnections = await getRecentConnections(10);

    return (
        <div className="relative h-screen overflow-hidden">
            <HolographicBackground />

            <div className="relative z-10 flex h-full flex-col">
                <ConnectLayout
                    initialConnections={recentConnections}
                    activeConnection={connection}
                    initialMessages={messages}
                >
                    <Chat />
                </ConnectLayout>
            </div>
        </div>
    );
}
