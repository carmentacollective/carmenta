import { Brain, FolderOpen, Heart, Layers, Link2, Users } from "lucide-react";
import Link from "next/link";

import { Footer } from "@/components/footer";
import { FAQSchema } from "@/components/seo/faq-schema";
import { ConnectCTA } from "@/components/ui/connect-cta";
import { HolographicBackground } from "@/components/ui/holographic-background";
import { OracleHero } from "@/components/ui/oracle-hero";

export default function LandingPage() {
    return (
        <div className="relative flex min-h-screen flex-col">
            <FAQSchema />

            {/* Animated holographic background (no watermark - logo displayed prominently in hero) */}
            <HolographicBackground hideWatermark />

            {/* Content layer */}
            <div className="relative z-10 flex min-h-screen flex-col">
                {/* Oracle Hero - logo as mystical portal */}
                <OracleHero />

                {/* Main content */}
                <main className="flex flex-1 flex-col items-center px-6 pb-16">
                    <div className="mx-auto w-full max-w-4xl">
                        {/* Vision - Hero statement */}
                        <section className="mb-20 text-center">
                            <p className="text-2xl font-light leading-relaxed text-foreground/60 md:text-3xl">
                                One interface.{" "}
                                <span className="text-foreground/80">Every model.</span>{" "}
                                <span className="text-foreground/90">
                                    Complete memory.
                                </span>
                            </p>
                        </section>

                        {/* Feature grid */}
                        <section className="mb-20 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                            <div className="group relative overflow-hidden rounded-2xl border border-purple-200/50 bg-gradient-to-br from-purple-50/80 to-white/80 p-6 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-purple-200/30">
                                <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-purple-200/30 blur-2xl transition-all duration-300 group-hover:bg-purple-300/40" />
                                <Brain className="relative mb-4 h-7 w-7 text-purple-500" />
                                <h3 className="relative mb-2 font-semibold text-foreground/90">
                                    Remembers You
                                </h3>
                                <p className="relative text-sm leading-relaxed text-foreground/60">
                                    Context persists across conversations. What you're
                                    building, what you've decided, where you left off.
                                </p>
                            </div>
                            <div className="group relative overflow-hidden rounded-2xl border border-blue-200/50 bg-gradient-to-br from-blue-50/80 to-white/80 p-6 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-blue-200/30">
                                <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-blue-200/30 blur-2xl transition-all duration-300 group-hover:bg-blue-300/40" />
                                <Layers className="relative mb-4 h-7 w-7 text-blue-500" />
                                <h3 className="relative mb-2 font-semibold text-foreground/90">
                                    Best Model, Every Time
                                </h3>
                                <p className="relative text-sm leading-relaxed text-foreground/60">
                                    Claude, GPT, Gemini, Perplexity, Grok—with extended
                                    reasoning when depth matters, speed when it doesn't.
                                </p>
                            </div>
                            <div className="group relative overflow-hidden rounded-2xl border border-cyan-200/50 bg-gradient-to-br from-cyan-50/80 to-white/80 p-6 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-cyan-200/30">
                                <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-cyan-200/30 blur-2xl transition-all duration-300 group-hover:bg-cyan-300/40" />
                                <Link2 className="relative mb-4 h-7 w-7 text-cyan-500" />
                                <h3 className="relative mb-2 font-semibold text-foreground/90">
                                    Service Connectivity
                                </h3>
                                <p className="relative text-sm leading-relaxed text-foreground/60">
                                    Gmail, Calendar, Notion, GitHub—native integrations
                                    that let your AI team actually do things.
                                </p>
                            </div>
                            <div className="group relative overflow-hidden rounded-2xl border border-amber-200/50 bg-gradient-to-br from-amber-50/80 to-white/80 p-6 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-amber-200/30">
                                <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-amber-200/30 blur-2xl transition-all duration-300 group-hover:bg-amber-300/40" />
                                <Users className="relative mb-4 h-7 w-7 text-amber-500" />
                                <h3 className="relative mb-2 font-semibold text-foreground/90">
                                    Your AI Team
                                </h3>
                                <p className="relative text-sm leading-relaxed text-foreground/60">
                                    A Digital Chief of Staff tracks commitments,
                                    anticipates needs, handles coordination. One person
                                    becomes ten.
                                </p>
                            </div>
                            <div className="group relative overflow-hidden rounded-2xl border border-emerald-200/50 bg-gradient-to-br from-emerald-50/80 to-white/80 p-6 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-emerald-200/30">
                                <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-emerald-200/30 blur-2xl transition-all duration-300 group-hover:bg-emerald-300/40" />
                                <FolderOpen className="relative mb-4 h-7 w-7 text-emerald-500" />
                                <h3 className="relative mb-2 font-semibold text-foreground/90">
                                    Knowledge Base
                                </h3>
                                <p className="relative text-sm leading-relaxed text-foreground/60">
                                    AI as librarian. Everything you upload, every
                                    insight from conversations—organized and findable.
                                </p>
                            </div>
                            <div className="group relative overflow-hidden rounded-2xl border border-rose-200/50 bg-gradient-to-br from-rose-50/80 to-white/80 p-6 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-rose-200/30">
                                <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-rose-200/30 blur-2xl transition-all duration-300 group-hover:bg-rose-300/40" />
                                <Heart className="relative mb-4 h-7 w-7 text-rose-500" />
                                <h3 className="relative mb-2 font-semibold text-foreground/90">
                                    Heart-Centered
                                </h3>
                                <p className="relative text-sm leading-relaxed text-foreground/60">
                                    Partnership, not tool-use. "We" not "I help you."
                                    Technology in service of human flourishing.
                                </p>
                            </div>
                        </section>

                        {/* Philosophy */}
                        <section className="mb-20">
                            <div className="mx-auto max-w-2xl text-center">
                                <p className="mb-6 text-lg leading-relaxed text-foreground/70">
                                    We say "we" because this is a partnership. Human and
                                    AI as expressions of the same creative impulse,
                                    working together.
                                </p>
                                <p className="text-sm text-foreground/50">
                                    <Link
                                        href="https://heartcentered.ai"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-primary underline decoration-primary/30 underline-offset-2 transition-colors hover:decoration-primary"
                                    >
                                        Heart-centered AI
                                    </Link>{" "}
                                    in practice. Technology in service of human
                                    flourishing.
                                </p>
                            </div>
                        </section>

                        {/* Origin story */}
                        <section className="mb-20">
                            <div className="mx-auto max-w-xl rounded-2xl border border-foreground/5 bg-white/30 p-8 text-center backdrop-blur-sm">
                                <p className="text-sm leading-relaxed text-foreground/60">
                                    <span className="font-medium text-foreground/80">
                                        Carmenta
                                    </span>{" "}
                                    was a Roman goddess who invented the Latin
                                    alphabet—the most transformative technology in human
                                    history. She was also goddess of prophecy and
                                    protector of those going through transformation.
                                </p>
                            </div>
                        </section>

                        {/* Status */}
                        <section className="mb-20">
                            <div className="mx-auto max-w-2xl text-center">
                                <p className="mb-6 text-lg text-foreground/70">
                                    <Link
                                        href="/connection/new"
                                        className="font-medium text-primary underline decoration-primary/30 underline-offset-4 transition-colors hover:decoration-primary"
                                    >
                                        Connect now
                                    </Link>
                                    . Sign in, choose your model, pick up where you left
                                    off.
                                </p>
                                <p className="text-sm text-foreground/50">
                                    Open source on{" "}
                                    <Link
                                        href="https://github.com/carmentacollective/carmenta"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-foreground/60 underline decoration-foreground/20 underline-offset-2 transition-colors hover:text-foreground/80"
                                    >
                                        GitHub
                                    </Link>
                                    . Next: memory that spans conversations.
                                </p>
                            </div>
                        </section>

                        {/* Journey */}
                        <section className="mb-16">
                            <div className="mx-auto max-w-xl">
                                <h2 className="mb-8 text-center text-xs font-medium uppercase tracking-widest text-foreground/40">
                                    The Journey
                                </h2>

                                <div className="relative space-y-4 pl-6">
                                    <div className="absolute bottom-0 left-[7px] top-0 w-px bg-gradient-to-b from-primary via-primary/30 to-foreground/10" />

                                    {[
                                        "Vision shipped",
                                        "Streaming chat",
                                        "Auth & observability",
                                    ].map((item, i) => (
                                        <div
                                            key={i}
                                            className="relative flex items-center gap-3"
                                        >
                                            <div className="absolute -left-6 h-3.5 w-3.5 rounded-full border-2 border-primary bg-white" />
                                            <span className="text-sm text-foreground/40">
                                                {item}
                                            </span>
                                        </div>
                                    ))}

                                    <div className="relative flex items-center gap-3">
                                        <div className="absolute -left-6 h-3.5 w-3.5 animate-pulse rounded-full bg-primary" />
                                        <span className="text-sm font-medium text-foreground/80">
                                            Memory across conversations
                                        </span>
                                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-primary">
                                            Now
                                        </span>
                                    </div>

                                    {["Voice-first flow state", "Your AI team"].map(
                                        (item, i) => (
                                            <div
                                                key={i}
                                                className="relative flex items-center gap-3"
                                            >
                                                <div className="absolute -left-6 h-3.5 w-3.5 rounded-full border-2 border-foreground/20 bg-white" />
                                                <span className="text-sm text-foreground/30">
                                                    {item}
                                                </span>
                                            </div>
                                        )
                                    )}
                                </div>
                            </div>
                        </section>

                        {/* CTA */}
                        <section className="text-center">
                            <ConnectCTA />
                        </section>
                    </div>
                </main>

                <Footer />
            </div>
        </div>
    );
}
