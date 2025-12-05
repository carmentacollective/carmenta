import type { MetadataRoute } from "next";

/**
 * PWA Web App Manifest
 *
 * Defines how Carmenta appears when installed as a Progressive Web App.
 * Supports installation on iOS 16.4+, Android, and desktop platforms.
 *
 * @see knowledge/components/pwa.md for implementation details
 */
export default function manifest(): MetadataRoute.Manifest {
    return {
        name: "Carmenta - Heart-Centered AI",
        short_name: "Carmenta",
        description:
            "Unified AI interface with complete memory, multi-model access, AI team, and purpose-built responses. Heart-centered AI for builders working at the speed of thought.",
        start_url: "/",
        display: "standalone",
        background_color: "#0a0a0a",
        theme_color: "#6366f1",
        orientation: "portrait-primary",
        categories: ["productivity", "business", "utilities"],
        icons: [
            {
                src: "/logos/icon-transparent-192.png",
                sizes: "192x192",
                type: "image/png",
                purpose: "any",
            },
            {
                src: "/logos/icon-transparent-512.png",
                sizes: "512x512",
                type: "image/png",
                purpose: "any",
            },
            {
                src: "/logos/icon-transparent-512.png",
                sizes: "512x512",
                type: "image/png",
                purpose: "maskable",
            },
        ],
        shortcuts: [
            {
                name: "New Conversation",
                short_name: "New Chat",
                description: "Start a new conversation with Carmenta",
                url: "/connection/new",
                icons: [
                    {
                        src: "/logos/icon-transparent-192.png",
                        sizes: "192x192",
                    },
                ],
            },
        ],
    };
}
