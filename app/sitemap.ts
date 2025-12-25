import type { MetadataRoute } from "next";

/**
 * Sitemap for Carmenta.
 *
 * Omits lastModified field rather than using fake/dynamic dates.
 * Search engines will use their own crawl heuristics.
 *
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap
 */
export default function sitemap(): MetadataRoute.Sitemap {
    const baseUrl = "https://carmenta.ai";

    return [
        {
            url: baseUrl,
            changeFrequency: "weekly",
            priority: 1,
        },
        {
            url: `${baseUrl}/home`,
            changeFrequency: "weekly",
            priority: 0.9, // Alternative landing page for authenticated users
        },
        {
            url: `${baseUrl}/connection/new`,
            changeFrequency: "monthly",
            priority: 0.8,
        },
        {
            url: `${baseUrl}/ai-first-development`,
            changeFrequency: "monthly",
            priority: 0.6,
        },
        {
            url: `${baseUrl}/brand`,
            changeFrequency: "monthly",
            priority: 0.5,
        },
        {
            url: `${baseUrl}/guide`,
            changeFrequency: "weekly",
            priority: 0.7,
        },
        {
            url: `${baseUrl}/benchmarks`,
            changeFrequency: "weekly",
            priority: 0.7,
        },
    ];
}
