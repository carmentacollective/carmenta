import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { Chat, ConnectLayout } from "@/components/connection";
import { HolographicBackground } from "@/components/ui/holographic-background";
import { loadConnection, getRecentConnections } from "@/lib/actions/connections";
import { isValidConnectionId, generateSlug } from "@/lib/sqids";

interface ConnectionPageProps {
    params: Promise<{ slug: string; id: string }>;
}

/**
 * Generate dynamic metadata for SEO.
 *
 * Page title format: "{Connection Title} · Carmenta" or "Create · Carmenta" for untitled.
 */
export async function generateMetadata({
    params,
}: ConnectionPageProps): Promise<Metadata> {
    const { id } = await params;

    if (!isValidConnectionId(id)) {
        return { title: "Lost · Carmenta" };
    }

    const result = await loadConnection(id);

    if (!result) {
        return {
            title: "Lost · Carmenta",
        };
    }

    const title = result.connection.title
        ? `${result.connection.title} · Carmenta`
        : "Create · Carmenta";

    return {
        title,
        description: result.connection.title
            ? `${result.connection.title} - Heart-centered AI conversation`
            : "Connect with Carmenta - a heart-centered AI interface for thinking together.",
    };
}

export default async function ConnectionPage({ params }: ConnectionPageProps) {
    const { slug, id } = await params;

    // Invalid ID format - show 404
    if (!isValidConnectionId(id)) {
        notFound();
    }

    // Load the connection, messages, and concierge data
    const result = await loadConnection(id);

    if (!result) {
        notFound();
    }

    const { connection, messages, concierge } = result;

    // If the slug doesn't match the current connection slug, redirect to canonical URL
    // This handles cases where the title changed and old URLs need updating
    const expectedSlug = generateSlug(connection.title);
    if (slug !== expectedSlug) {
        redirect(`/connection/${expectedSlug}/${id}`);
    }

    // Also load recent connections for the header dropdown
    const recentConnections = await getRecentConnections(10);

    return (
        <div className="fixed inset-0 overflow-hidden">
            <HolographicBackground />

            <div className="relative z-10 h-full">
                <ConnectLayout
                    initialConnections={recentConnections}
                    activeConnection={connection}
                    initialMessages={messages}
                    initialConcierge={concierge}
                >
                    <Chat />
                </ConnectLayout>
            </div>
        </div>
    );
}
