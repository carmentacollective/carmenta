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
            "Partnership, not tool-use. Claude, GPT, Gemini, Perplexity, Grok—with memory that persists, service connectivity that works, and an AI team that anticipates your needs.",
        start_url: "/",
        display: "standalone",
        // Window Controls Overlay for native desktop titlebar experience
        // Falls back to standalone on unsupported browsers
        display_override: ["window-controls-overlay"],
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
                url: "/connection?new",
                icons: [
                    {
                        src: "/logos/icon-transparent-192.png",
                        sizes: "192x192",
                    },
                ],
            },
        ],
        // PWA Share Target: Receive content shared from other apps
        // Users can share text, URLs, images, and PDFs directly to Carmenta
        share_target: {
            action: "/api/share",
            method: "POST",
            enctype: "multipart/form-data",
            params: {
                title: "title",
                text: "text",
                url: "url",
                files: [
                    {
                        name: "files",
                        accept: [
                            "image/jpeg",
                            "image/png",
                            "image/gif",
                            "image/webp",
                            "application/pdf",
                        ],
                    },
                ],
            },
        },
    };
}
