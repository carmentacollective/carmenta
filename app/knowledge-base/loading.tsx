import { Book, Sparkles } from "lucide-react";

import { SiteHeader } from "@/components/site-header";
import { HolographicBackground } from "@/components/ui/holographic-background";

/**
 * Loading state for Knowledge Base page
 *
 * Shown while Server Component data is being fetched.
 * Mirrors page structure for smooth transition.
 */
export default function KnowledgeBaseLoading() {
    return (
        <div className="relative flex min-h-screen flex-col">
            <HolographicBackground />

            <div className="relative z-content flex flex-1 flex-col">
                <SiteHeader bordered />

                <main className="flex-1 px-6 py-8">
                    <div className="mx-auto flex h-full max-w-5xl flex-col gap-8">
                        {/* Header */}
                        <section className="space-y-2">
                            <div className="flex items-center gap-3">
                                <div className="rounded-xl bg-primary/20 p-3">
                                    <Book className="h-6 w-6 text-primary" />
                                </div>
                                <div>
                                    <h1 className="text-3xl font-light tracking-tight text-foreground">
                                        Knowledge Base
                                    </h1>
                                    <p className="text-foreground/70">
                                        What Carmenta knows about you
                                    </p>
                                </div>
                            </div>
                        </section>

                        {/* Loading state */}
                        <section className="flex min-h-[500px] flex-1 items-center justify-center">
                            <div className="flex flex-col items-center gap-4">
                                <Sparkles className="h-8 w-8 animate-pulse text-primary" />
                                <p className="text-foreground/60">
                                    Loading your knowledge base...
                                </p>
                            </div>
                        </section>
                    </div>
                </main>
            </div>
        </div>
    );
}
