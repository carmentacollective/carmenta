import { UserButton } from "@clerk/nextjs";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { Chat } from "@/components/connect";
import { HolographicBackground } from "@/components/ui/holographic-background";

export const metadata: Metadata = {
    title: "Connect | Carmenta",
    description:
        "Connect with Carmenta - a heart-centered AI interface for thinking together.",
};

export default function ConnectPage() {
    return (
        <div className="relative h-screen overflow-hidden">
            <HolographicBackground />

            <div className="relative z-10 flex h-full flex-col">
                <header className="flex items-center justify-between px-6 py-4">
                    <Link
                        href="/"
                        className="flex items-center gap-3 transition-opacity hover:opacity-80"
                    >
                        <Image
                            src="/logos/icon-transparent.png"
                            alt="Carmenta"
                            width={48}
                            height={48}
                            className="h-12 w-12"
                            priority
                        />
                        <span className="text-xl font-semibold tracking-tight text-foreground/90">
                            Carmenta
                        </span>
                    </Link>
                    <div className="flex items-center gap-4">
                        <div className="rounded-full bg-white/40 px-3 py-1 text-xs font-medium uppercase tracking-widest text-foreground/60 backdrop-blur-sm">
                            M0.5: First Connection
                        </div>
                        <UserButton
                            appearance={{
                                elements: {
                                    avatarBox: "h-8 w-8",
                                    userButtonPopoverCard:
                                        "bg-white/80 backdrop-blur-xl border border-white/60 shadow-lg",
                                    userButtonPopoverActionButton:
                                        "text-foreground hover:bg-white/50",
                                    userButtonPopoverActionButtonText:
                                        "text-foreground",
                                    userButtonPopoverFooter: "hidden",
                                },
                            }}
                        />
                    </div>
                </header>

                <main className="flex-1 overflow-hidden">
                    <Chat />
                </main>
            </div>
        </div>
    );
}
