import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { Chat, ConnectLayout } from "@/components/connection";
import { HolographicBackground } from "@/components/ui/holographic-background";
import { loadConnection, getRecentConnections } from "@/lib/actions/connections";
import { extractIdFromSlug } from "@/lib/sqids";

interface ConnectionPageProps {
    params: Promise<{ slug: string }>;
}

/**
 * Safely extract connection ID from slug.
 * Returns null if slug is malformed (triggers 404).
 */
function safeExtractId(slug: string): string | null {
    try {
        return extractIdFromSlug(slug);
    } catch {
        return null;
    }
}

/**
 * Generate dynamic metadata for SEO.
 *
 * Page title format: "{Connection Title} | Carmenta" or "Connect | Carmenta" for untitled.
 */
export async function generateMetadata({
    params,
}: ConnectionPageProps): Promise<Metadata> {
    const { slug } = await params;
    const connectionId = safeExtractId(slug);

    if (!connectionId) {
        return { title: "Not Found | Carmenta" };
    }

    const result = await loadConnection(connectionId);

    if (!result) {
        return {
            title: "Not Found | Carmenta",
        };
    }

    const title = result.connection.title
        ? `${result.connection.title} | Carmenta`
        : "Connect | Carmenta";

    return {
        title,
        description: result.connection.title
            ? `${result.connection.title} - Heart-centered AI conversation`
            : "Connect with Carmenta - a heart-centered AI interface for thinking together.",
    };
}

export default async function ConnectionPage({ params }: ConnectionPageProps) {
    const { slug } = await params;
    const connectionId = safeExtractId(slug);

    // Invalid slug format - show 404
    if (!connectionId) {
        notFound();
    }

    // Load the connection and its messages
    const result = await loadConnection(connectionId);

    if (!result) {
        notFound();
    }

    const { connection, messages } = result;

    // If the slug doesn't match the current connection slug, redirect to canonical URL
    // This handles cases where the title changed and old URLs need updating
    if (connection.slug !== slug) {
        redirect(`/connection/${connection.slug}`);
    }

    // Also load recent connections for the header dropdown
    const recentConnections = await getRecentConnections(10);

    return (
        <div className="relative h-dvh overflow-hidden">
            <HolographicBackground />

            <div className="relative z-10 h-full">
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
