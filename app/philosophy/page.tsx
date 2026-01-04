import { Metadata } from "next";
import { Heart } from "@phosphor-icons/react/dist/ssr";

import { Footer } from "@/components/footer";
import { SiteHeader } from "@/components/site-header";
import { HolographicBackground } from "@/components/ui/holographic-background";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import { VALUES_CONTENT } from "@/lib/prompts/system";

export const metadata: Metadata = {
    title: "Our Philosophy · Carmenta",
    description: "The heart-centered values that guide how Carmenta works with you.",
};

export default function PhilosophyPage() {
    return (
        <div className="bg-background relative min-h-screen">
            <HolographicBackground />
            <div className="z-content relative">
                <SiteHeader bordered />

                <article className="mx-auto max-w-4xl px-6 py-12 sm:px-8 sm:py-16 lg:px-10 lg:py-20">
                    {/* Header */}
                    <div className="flex items-center gap-4">
                        <div className="bg-primary/20 rounded-xl p-3">
                            <Heart className="text-primary h-8 w-8" />
                        </div>
                        <div>
                            <h1 className="text-4xl font-bold tracking-tight">
                                Heart-Centered AI
                            </h1>
                            <p className="text-foreground/70 mt-1 text-lg">
                                The philosophy that guides how we work together
                            </p>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="border-foreground/10 bg-foreground/[0.02] mt-12 rounded-2xl border p-8">
                        <MarkdownRenderer
                            content={VALUES_CONTENT}
                            className="prose prose-lg dark:prose-invert max-w-none"
                        />
                    </div>

                    {/* Footer note */}
                    <p className="text-foreground/50 mt-8 text-center text-sm">
                        These values are woven into every interaction. They're not rules
                        we follow—they're how we see the world together.
                    </p>
                </article>

                <Footer />
            </div>
        </div>
    );
}
