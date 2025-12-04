import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getRecentConnections } from "@/lib/actions/connections";

export const metadata: Metadata = {
    title: "Connect | Carmenta",
    description:
        "Connect with Carmenta - a heart-centered AI interface for thinking together.",
};

/**
 * Connection Index Page
 *
 * Routes users to the appropriate connection:
 * - If they have recent connections, go to the most recent one
 * - Otherwise, go to /connection/new for a fresh start
 *
 * No connections are created here - that happens lazily on first message.
 */
export default async function ConnectionsPage() {
    // Load recent connections (auth protected by middleware)
    const recentConnections = await getRecentConnections(10);

    // If there are recent connections, redirect to the most recent one
    if (recentConnections.length > 0) {
        redirect(`/connection/${recentConnections[0].slug}`);
    }

    // No connections exist - go to new connection page
    redirect("/connection/new");
}
