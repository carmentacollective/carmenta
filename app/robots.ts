import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
    return {
        rules: {
            userAgent: "*",
            allow: ["/", "/connection/"],
            disallow: "/api/",
        },
        sitemap: "https://carmenta.ai/sitemap.xml",
    };
}
