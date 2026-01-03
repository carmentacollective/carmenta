import type { Metadata } from "next";

import { HolographicBackground } from "@/components/ui/holographic-background";
import { EnterAuthWrapper } from "./enter-auth-wrapper";

export const metadata: Metadata = {
    title: "Enter · Carmenta",
    description: "Enter Carmenta. Your AI partner awaits.",
    robots: { index: false, follow: false },
};

export default function EnterPage() {
    return (
        <div className="relative flex min-h-screen flex-col">
            <HolographicBackground />

            <div className="z-content relative flex min-h-screen flex-col items-center justify-center px-6">
                <EnterAuthWrapper />
            </div>
        </div>
    );
}
