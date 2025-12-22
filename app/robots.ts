import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
    return {
        rules: {
            userAgent: "*",
            allow: ["/", "/home", "/connection/"],
            disallow: ["/api/", "/design-lab/"],
        },
        sitemap: "https://carmenta.ai/sitemap.xml",
    };
}
