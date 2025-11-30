import type { MetadataRoute } from "next";

/**
 * Sitemap for Carmenta.
 * Uses actual last modified dates to prevent unnecessary re-crawls.
 */
export default function sitemap(): MetadataRoute.Sitemap {
    const baseUrl = "https://carmenta.ai";

    return [
        {
            url: baseUrl,
            lastModified: new Date("2025-11-29"), // Updated with SEO improvements
            changeFrequency: "weekly",
            priority: 1,
        },
        {
            url: `${baseUrl}/connect`,
            lastModified: new Date("2025-11-29"), // UI/UX consistency updates
            changeFrequency: "monthly",
            priority: 0.8,
        },
        {
            url: `${baseUrl}/ai-first-development`,
            lastModified: new Date("2025-11-29"), // UI/UX consistency updates
            changeFrequency: "monthly",
            priority: 0.6,
        },
        {
            url: `${baseUrl}/brand`,
            lastModified: new Date("2025-11-29"), // Brand identity system added
            changeFrequency: "monthly",
            priority: 0.5,
        },
    ];
}
