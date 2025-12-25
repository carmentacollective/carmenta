"use server";

import { logger } from "@/lib/logger";
import { getRecentConnections, getStarredConnections } from "@/lib/actions/connections";
import { getServicesWithStatus } from "@/lib/actions/integrations";

import type { GenerateSparksInput, RecentThread, StarredThread } from "./generator";

/**
 * Fetch all data needed to generate sparks for the current user
 *
 * Returns null if user is not authenticated
 */
export async function getSparkData(): Promise<GenerateSparksInput | null> {
    try {
        // Fetch data in parallel for performance
        // These server actions handle auth internally
        const [recentConnections, starredConnections, servicesResult] =
            await Promise.all([
                getRecentConnections(1).catch((error) => {
                    logger.error(
                        { error },
                        "Failed to fetch recent connections for sparks"
                    );
                    return [];
                }),
                getStarredConnections(3).catch((error) => {
                    logger.error(
                        { error },
                        "Failed to fetch starred connections for sparks"
                    );
                    return [];
                }),
                getServicesWithStatus().catch((error) => {
                    logger.error({ error }, "Failed to fetch services for sparks");
                    return { connected: [], available: [] };
                }),
            ]);

        // Transform recent connection to RecentThread
        const recentThread: RecentThread | null =
            recentConnections.length > 0
                ? {
                      id: recentConnections[0].id,
                      slug: recentConnections[0].slug,
                      title: recentConnections[0].title,
                  }
                : null;

        // Transform starred connections to StarredThread[]
        const starredThreads: StarredThread[] = starredConnections.map((conn) => ({
            id: conn.id,
            slug: conn.slug,
            title: conn.title,
        }));

        // Extract connected service IDs
        const connectedServices = servicesResult.connected.map((s) => s.service.id);

        return {
            connectedServices,
            recentThread,
            starredThreads,
        };
    } catch (error) {
        logger.error({ error }, "Failed to get spark data");
        return null;
    }
}
