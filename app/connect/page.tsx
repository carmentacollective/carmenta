import type { Metadata } from "next";

import { Chat } from "@/components/connect";
import { OptionalUserButton } from "@/components/connect/optional-user-button";
import { SiteHeader } from "@/components/site-header";
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
                <SiteHeader
                    rightContent={
                        <>
                            <div className="rounded-full bg-white/40 px-3 py-1 text-xs font-medium uppercase tracking-widest text-foreground/60 backdrop-blur-sm">
                                M0.5: First Connection
                            </div>
                            <OptionalUserButton />
                        </>
                    }
                />

                <main className="flex-1 overflow-hidden">
                    <Chat />
                </main>
            </div>
        </div>
    );
}
