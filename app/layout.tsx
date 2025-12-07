import type { Metadata } from "next";
import { Outfit, JetBrains_Mono } from "next/font/google";

import { ClerkProvider } from "@clerk/nextjs";
import { UserProvider } from "@/lib/auth/user-context";
import { ThemeProvider } from "@/lib/theme";
import { PWARegistration } from "@/components/pwa-registration";
import { StructuredData } from "@/components/seo/structured-data";
import { clerkAppearance } from "@/lib/clerk-appearance";
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
    metadataBase: new URL("https://carmenta.ai"),
    title: "Carmenta - One Interface. Every Model. Complete Memory.",
    description:
        "Partnership, not tool-use. Claude, GPT, Gemini, Perplexity, Grok—with memory that persists, service connectivity that works, and an AI team that anticipates your needs. Heart-centered AI for builders who work at the speed of thought.",

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
        title: "Carmenta - One Interface. Every Model. Complete Memory.",
        description:
            "Partnership, not tool-use. Claude, GPT, Gemini, Perplexity, Grok—with memory that persists, service connectivity that works, and an AI team that anticipates your needs.",
    },

    twitter: {
        card: "summary_large_image",
        title: "Carmenta - One Interface. Every Model. Complete Memory.",
        description:
            "Partnership, not tool-use. Claude, GPT, Gemini, Perplexity, Grok—with memory that persists, service connectivity that works, and an AI team that anticipates your needs.",
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
            signInUrl="/sign-in"
            signUpUrl="/sign-up"
            afterSignOutUrl="/"
            appearance={clerkAppearance}
        >
            <UserProvider>
                <html
                    lang="en"
                    className={`${outfit.variable} ${jetbrainsMono.variable}`}
                    suppressHydrationWarning
                >
                    <body className="min-h-screen bg-background font-sans antialiased">
                        <ThemeProvider>
                            <PWARegistration />
                            <StructuredData />
                            {children}
                        </ThemeProvider>
                    </body>
                </html>
            </UserProvider>
        </ClerkProvider>
    );
}
