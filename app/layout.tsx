import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
    subsets: ["latin"],
    variable: "--font-inter",
    display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
    subsets: ["latin"],
    variable: "--font-mono",
    display: "swap",
});

export const metadata: Metadata = {
    title: "Carmenta - The Best Interface to AI",
    description:
        "The unified front door to artificial intelligence for people who build at the speed of thought. Memory-aware, voice-first, with purpose-built responses.",

    openGraph: {
        type: "website",
        locale: "en_US",
        url: "https://carmenta.ai",
        siteName: "Carmenta",
        title: "Carmenta - The Best Interface to AI",
        description:
            "The unified front door to artificial intelligence for people who build at the speed of thought.",
        images: [
            {
                url: "https://carmenta.ai/og-image.png",
                width: 1200,
                height: 630,
                alt: "Carmenta - The Best Interface to AI",
            },
        ],
    },

    twitter: {
        card: "summary_large_image",
        title: "Carmenta - The Best Interface to AI",
        description:
            "The unified front door to artificial intelligence for people who build at the speed of thought.",
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
        icon: "/favicon.ico",
    },
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
            <body className="min-h-screen bg-background font-mono antialiased">
                {children}
            </body>
        </html>
    );
}
