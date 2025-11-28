import { UserButton } from "@clerk/nextjs";
import type { Metadata } from "next";
import Link from "next/link";

import { Connect } from "@/components/connect";
import { CopilotKitProvider } from "@/components/providers";

export const metadata: Metadata = {
    title: "Connect | Carmenta",
    description:
        "Connect with Carmenta - a heart-centered AI interface for thinking together.",
};

export default function ConnectPage() {
    return (
        <CopilotKitProvider>
            <div className="flex h-screen flex-col">
                {/* Header */}
                <header className="flex items-center justify-between border-b border-border px-6 py-4">
                    <Link
                        href="/"
                        className="text-lg font-bold tracking-tight transition-colors hover:text-primary"
                    >
                        CARMENTA_
                    </Link>
                    <div className="flex items-center gap-4">
                        <div className="text-xs uppercase tracking-widest text-muted-foreground">
                            M0.5: First Connection
                        </div>
                        <UserButton
                            appearance={{
                                elements: {
                                    avatarBox: "h-8 w-8",
                                    userButtonPopoverCard:
                                        "bg-card border border-border",
                                    userButtonPopoverActionButton:
                                        "text-foreground hover:bg-secondary",
                                    userButtonPopoverActionButtonText:
                                        "text-foreground",
                                    userButtonPopoverFooter: "hidden",
                                },
                            }}
                        />
                    </div>
                </header>

                {/* Connection interface */}
                <main className="flex-1 overflow-hidden">
                    <Connect />
                </main>
            </div>
        </CopilotKitProvider>
    );
}
