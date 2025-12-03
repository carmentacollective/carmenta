import type { Metadata } from "next";

import { Chat, ConnectLayout } from "@/components/connect";
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
                <ConnectLayout>
                    <Chat />
                </ConnectLayout>
            </div>
        </div>
    );
}
