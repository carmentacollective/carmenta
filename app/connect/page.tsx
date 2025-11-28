import type { Metadata } from "next";
import Link from "next/link";

import { Chat } from "@/components/connect";

export const metadata: Metadata = {
    title: "Connect | Carmenta",
    description:
        "Connect with Carmenta - a heart-centered AI interface for thinking together.",
};

export default function ConnectPage() {
    return (
        <div className="flex h-screen flex-col">
            {/* Header */}
            <header className="flex items-center justify-between border-b border-border px-6 py-4">
                <Link
                    href="/"
                    className="text-lg font-bold tracking-tight transition-colors hover:text-primary"
                >
                    CARMENTA_
                </Link>
                <div className="text-xs uppercase tracking-widest text-muted-foreground">
                    M0.5: First Connection
                </div>
            </header>

            {/* Chat */}
            <main className="flex-1 overflow-hidden">
                <Chat />
            </main>
        </div>
    );
}
