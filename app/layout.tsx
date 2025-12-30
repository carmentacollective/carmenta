import type { Metadata } from "next";
import { Outfit, Source_Code_Pro, Cormorant_Garamond } from "next/font/google";

import { ViewTransitions } from "next-view-transitions";
import { ClerkProvider } from "@clerk/nextjs";
import { UserProvider } from "@/lib/auth/user-context";
import { ThemeProvider } from "@/lib/theme";
import { PWARegistration } from "@/components/pwa-registration";
import { InstallPrompt } from "@/components/pwa";
import { StructuredData } from "@/components/seo/structured-data";
import { clerkAppearance } from "@/lib/clerk-appearance";
import { PostHogProvider } from "@/components/analytics/posthog-provider";
import { MarkerProvider } from "@/components/feedback/marker-provider";
import { FloatingEmojiProvider } from "@/components/delight/floating-emoji";
import { Toaster } from "sonner";
import { GlobalTooltip } from "@/components/ui/global-tooltip";
import "./globals.css";

/**
 * Critical inline CSS that renders before any external CSS loads.
 * Prevents flash of white by setting background color immediately.
 * Must match the theme colors defined in viewport.themeColor.
 */
const criticalCss = `html{background:#F8F4F8}@media(prefers-color-scheme:dark){html{background:#1A0F20}}`;

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
 * Source Code Pro - For code blocks and technical content.
 * Adobe's monospace with excellent readability at all sizes.
 */
const sourceCodePro = Source_Code_Pro({
    subsets: ["latin"],
    variable: "--font-mono",
    display: "swap",
});

/**
 * Cormorant Garamond - Elegant serif for greetings and display text.
 * The italic forms feel intimate and warm, perfect for "coming home."
 */
const cormorant = Cormorant_Garamond({
    subsets: ["latin"],
    variable: "--font-serif",
    weight: ["300", "400", "500", "600"],
    style: ["normal", "italic"],
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
    metadataBase: new URL("https://carmenta.ai"),
    title: "Carmenta · Create at the Speed of Thought",
    description:
        "Create at the speed of thought. Every frontier model—Claude, GPT, Gemini, Grok—unified. Memory that persists. An AI team that works alongside you. Partnership, not tool-use.",

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
        title: "Carmenta · Create at the Speed of Thought",
        description:
            "Create at the speed of thought. Every frontier model—Claude, GPT, Gemini, Grok—unified. Memory that persists. An AI team that works alongside you. Partnership, not tool-use.",
    },

    twitter: {
        card: "summary_large_image",
        title: "Carmenta · Create at the Speed of Thought",
        description:
            "Create at the speed of thought. Every frontier model—Claude, GPT, Gemini, Grok—unified. Memory that persists. An AI team that works alongside you. Partnership, not tool-use.",
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
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <ClerkProvider
            signInUrl="/enter"
            afterSignOutUrl="/"
            appearance={clerkAppearance}
        >
            <UserProvider>
                <PostHogProvider>
                    <ViewTransitions>
                        <html
                            lang="en"
                            className={`${outfit.variable} ${sourceCodePro.variable} ${cormorant.variable}`}
                            suppressHydrationWarning
                        >
                            <head>
                                <style
                                    dangerouslySetInnerHTML={{ __html: criticalCss }}
                                />
                            </head>
                            <body className="min-h-screen bg-background font-sans antialiased">
                                <ThemeProvider>
                                    <MarkerProvider>
                                        <FloatingEmojiProvider>
                                            <PWARegistration />
                                            <InstallPrompt />
                                            <StructuredData />
                                            <Toaster />
                                            <GlobalTooltip />
                                            {children}
                                        </FloatingEmojiProvider>
                                    </MarkerProvider>
                                </ThemeProvider>
                            </body>
                        </html>
                    </ViewTransitions>
                </PostHogProvider>
            </UserProvider>
        </ClerkProvider>
    );
}
