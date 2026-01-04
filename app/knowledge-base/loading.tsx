import { Book, Sparkle } from "@phosphor-icons/react/dist/ssr";

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

            <div className="z-content relative flex flex-1 flex-col">
                <SiteHeader bordered />

                <main className="flex-1 px-6 py-8">
                    <div className="mx-auto flex h-full max-w-5xl flex-col gap-8">
                        {/* Header */}
                        <section className="space-y-2">
                            <div className="flex items-center gap-3">
                                <div className="bg-primary/20 rounded-xl p-3">
                                    <Book className="text-primary h-6 w-6" />
                                </div>
                                <div>
                                    <h1 className="text-foreground text-3xl font-light tracking-tight">
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
                                <Sparkle className="text-primary h-8 w-8 animate-pulse" />
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
