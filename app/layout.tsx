import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Outfit, JetBrains_Mono } from "next/font/google";

import "@assistant-ui/react-ui/styles/index.css";
import "./globals.css";

/**
 * Outfit - Modern, geometric with soft curves.
 * Captures the ethereal elegance of our holographic design.
 */
const outfit = Outfit({
    subsets: ["latin"],
    variable: "--font-outfit",
    display: "swap",
});

/**
 * JetBrains Mono - For code blocks and technical content.
 */
const jetbrainsMono = JetBrains_Mono({
    subsets: ["latin"],
    variable: "--font-mono",
    display: "swap",
});

export const metadata: Metadata = {
    title: "Carmenta - One Interface, All AI, Complete Memory",
    description:
        "Memory-aware AI that remembers your projects, decisions, and context. Voice-first interface with purpose-built responses, not chat bubbles.",

    openGraph: {
        type: "website",
        locale: "en_US",
        url: "https://carmenta.ai",
        siteName: "Carmenta",
        title: "Carmenta - One Interface, All AI, Complete Memory",
        description:
            "Memory-aware AI that remembers your projects, decisions, and context. Voice-first with purpose-built responses.",
        images: [
            {
                url: "https://carmenta.ai/og-image.png",
                width: 1200,
                height: 630,
                alt: "Carmenta - One Interface, All AI, Complete Memory",
            },
        ],
    },

    twitter: {
        card: "summary_large_image",
        title: "Carmenta - One Interface, All AI, Complete Memory",
        description:
            "Memory-aware AI that remembers your projects, decisions, and context. Voice-first with purpose-built responses.",
        images: ["https://carmenta.ai/og-image.png"],
    },

    keywords: [
        "AI interface",
        "AI assistant",
        "voice AI",
        "AI memory",
        "AI team",
        "heart-centered AI",
    ],

    authors: [{ name: "Carmenta Collective" }],
    creator: "Carmenta Collective",

    robots: {
        index: true,
        follow: true,
    },

    icons: {
        icon: [
            { url: "/favicon.png", sizes: "32x32", type: "image/png" },
            {
                url: "/logos/icon-transparent-512.png",
                sizes: "512x512",
                type: "image/png",
            },
        ],
        apple: "/apple-touch-icon.png",
    },
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <ClerkProvider afterSignOutUrl="/">
            <html lang="en" className={`${outfit.variable} ${jetbrainsMono.variable}`}>
                <body className="min-h-screen bg-background font-sans antialiased">
                    {children}
                </body>
            </html>
        </ClerkProvider>
    );
}
