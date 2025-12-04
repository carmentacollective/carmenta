import type { Metadata } from "next";
import { Outfit, JetBrains_Mono } from "next/font/google";

import { ClerkProvider } from "@clerk/nextjs";
import { UserProvider } from "@/lib/auth/user-context";
import { PWARegistration } from "@/components/pwa-registration";
import { StructuredData } from "@/components/seo/structured-data";
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

export const viewport = {
    width: "device-width",
    initialScale: 1,
    maximumScale: 5,
    userScalable: true,
    viewportFit: "cover",
    themeColor: [
        { media: "(prefers-color-scheme: light)", color: "#F8F4F8" },
        { media: "(prefers-color-scheme: dark)", color: "#1A0F20" },
    ],
};

export const metadata: Metadata = {
    title: "Carmenta - One Interface, All AI, Complete Memory",
    description:
        "Unified AI interface with complete memory, multi-model access, AI team, and purpose-built responses. Heart-centered AI for builders working at the speed of thought.",

    appleWebApp: {
        capable: true,
        statusBarStyle: "black-translucent",
        title: "Carmenta",
    },

    formatDetection: {
        telephone: false,
        email: false,
        address: false,
    },

    openGraph: {
        type: "website",
        locale: "en_US",
        url: "https://carmenta.ai",
        siteName: "Carmenta",
        title: "Carmenta - One Interface, All AI, Complete Memory",
        description:
            "Unified AI interface with complete memory, multi-model access, AI team, and purpose-built responses. Heart-centered AI for builders.",
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
            "Unified AI interface with complete memory, multi-model access, AI team, and purpose-built responses. Heart-centered AI for builders.",
        images: ["https://carmenta.ai/og-image.png"],
    },

    keywords: [
        "Carmenta",
        "Carmenta AI",
        "unified AI interface",
        "AI with memory",
        "AI team",
        "multi-model AI",
        "heart-centered AI",
        "AI interface with memory",
        "purpose-built AI responses",
        "AI digital chief of staff",
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
            <UserProvider>
                <html
                    lang="en"
                    className={`${outfit.variable} ${jetbrainsMono.variable}`}
                >
                    <body className="min-h-screen bg-background font-sans antialiased">
                        <PWARegistration />
                        <StructuredData />
                        {children}
                    </body>
                </html>
            </UserProvider>
        </ClerkProvider>
    );
}
