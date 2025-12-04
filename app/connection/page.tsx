import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getRecentConnections, createNewConnection } from "@/lib/actions/connections";

export const metadata: Metadata = {
    title: "Connect | Carmenta",
    description:
        "Connect with Carmenta - a heart-centered AI interface for thinking together.",
};

export default async function ConnectionsPage() {
    // Load recent connections (auth protected by middleware)
    const recentConnections = await getRecentConnections(10);

    // If there are recent connections, redirect to the most recent one using its slug
    // Otherwise, create a new connection
    if (recentConnections.length > 0) {
        redirect(`/connection/${recentConnections[0].slug}`);
    }

    // No connections exist - create one and redirect to its slug
    const { slug } = await createNewConnection();
    redirect(`/connection/${slug}`);
}
