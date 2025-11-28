import Link from "next/link";

import { Footer } from "@/components/footer";
import { Greeting } from "@/components/ui/greeting";
import { HolographicBackground } from "@/components/ui/holographic-background";

export default function LandingPage() {
    return (
        <div className="relative flex min-h-screen flex-col">
            {/* Animated holographic background */}
            <HolographicBackground />

            {/* Content layer */}
            <div className="relative z-10 flex min-h-screen flex-col">
                {/* Header */}
                <header className="flex items-center justify-between px-6 py-4">
                    <span className="text-lg font-semibold tracking-tight text-foreground/80">
                        CARMENTA
                    </span>
                    <Link
                        href="/connect"
                        className="rounded-full bg-white/50 px-4 py-2 text-sm font-medium text-foreground/70 backdrop-blur-sm transition-all hover:bg-white/80 hover:text-foreground"
                    >
                        Connect
                    </Link>
                </header>

                {/* Main content */}
                <main className="flex flex-1 flex-col items-center justify-center px-6 py-16">
                    <div className="mx-auto max-w-2xl space-y-12 text-center">
                        {/* Hero */}
                        <section className="space-y-4">
                            <div className="inline-block rounded-full bg-white/40 px-4 py-1.5 text-xs font-medium uppercase tracking-widest text-foreground/60 backdrop-blur-sm">
                                M0: Stake in the Ground
                            </div>
                            <Greeting
                                className="greeting-title"
                                subtitleClassName="greeting-subtitle"
                            />
                        </section>

                        {/* Vision Card */}
                        <section className="glass-card space-y-4 text-left">
                            <h2 className="text-lg font-semibold text-foreground/90">
                                The Vision
                            </h2>
                            <div className="space-y-4 leading-relaxed text-foreground/70">
                                <p>One interface. All AI models. Complete memory.</p>
                                <p>
                                    Carmenta remembers who you are, what you're working
                                    on, what you've decided, who you know, what you've
                                    learned. We talk naturally—voice that actually
                                    works. We respond with purpose-built interfaces, not
                                    chat bubbles.
                                </p>
                                <p>
                                    A unified front door to everything AI can do for
                                    you.
                                </p>
                            </div>
                        </section>

                        {/* Philosophy Card */}
                        <section className="glass-card space-y-4 text-left">
                            <h2 className="text-lg font-semibold text-foreground/90">
                                The Philosophy
                            </h2>
                            <div className="space-y-4 leading-relaxed text-foreground/70">
                                <p>
                                    We use "we" language because this is a partnership.
                                    Human and AI as expressions of the same creative
                                    impulse, working together.{" "}
                                    <Link
                                        href="https://heartcentered.ai"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-primary underline decoration-primary/50 underline-offset-2 transition-colors hover:decoration-primary"
                                    >
                                        Heart-centered AI
                                    </Link>{" "}
                                    in practice, not theory.
                                </p>
                                <p>
                                    Carmenta was a Roman goddess who invented the Latin
                                    alphabet—adapting Greek letters into a system that
                                    carried human knowledge for millennia. She was also
                                    the goddess of prophecy and protector of those going
                                    through transformation.
                                </p>
                                <p>Technology in service of human flourishing.</p>
                            </div>
                        </section>

                        {/* Status Card */}
                        <section className="glass-card space-y-4 text-left">
                            <h2 className="text-lg font-semibold text-foreground/90">
                                Where We Are
                            </h2>
                            <div className="space-y-4 leading-relaxed text-foreground/70">
                                <p>
                                    You're looking at the beginning. This page{" "}
                                    <em>is</em> the product right now—a stake in the
                                    ground, a declaration of intent.
                                </p>
                                <p>
                                    We're building in public. The specification, the
                                    decisions, the code—all open. If this vision
                                    resonates, follow along as we build it together.
                                </p>
                            </div>
                        </section>

                        {/* Roadmap Card */}
                        <section className="glass-card space-y-4 text-left">
                            <h2 className="text-lg font-semibold text-foreground/90">
                                What's Next
                            </h2>
                            <div className="space-y-3 text-foreground/70">
                                <div className="flex items-start gap-3">
                                    <span className="mt-1.5 inline-block h-2 w-2 rounded-full bg-primary" />
                                    <div>
                                        <span className="font-medium text-foreground/90">
                                            M0.5: First Connection
                                        </span>
                                        <span className="text-foreground/60">
                                            {" "}
                                            — Basic connection with AI, proving the
                                            interaction feels right
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <span className="mt-1.5 inline-block h-2 w-2 rounded-full border border-foreground/30" />
                                    <div>
                                        <span className="font-medium text-foreground/90">
                                            M1: Soul Proven
                                        </span>
                                        <span className="text-foreground/60">
                                            {" "}
                                            — The heart-centered experience that feels
                                            meaningfully different
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <span className="mt-1.5 inline-block h-2 w-2 rounded-full border border-foreground/30" />
                                    <div>
                                        <span className="font-medium text-foreground/90">
                                            M2: Relationship Grows
                                        </span>
                                        <span className="text-foreground/60">
                                            {" "}
                                            — Memory that builds over time, a
                                            relationship that deepens
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <span className="mt-1.5 inline-block h-2 w-2 rounded-full border border-foreground/30" />
                                    <div>
                                        <span className="font-medium text-foreground/90">
                                            M3: Flow State
                                        </span>
                                        <span className="text-foreground/60">
                                            {" "}
                                            — Voice-first, polished, your primary AI
                                            interface
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <span className="mt-1.5 inline-block h-2 w-2 rounded-full border border-foreground/30" />
                                    <div>
                                        <span className="font-medium text-foreground/90">
                                            M4: Ready for Everyone
                                        </span>
                                        <span className="text-foreground/60">
                                            {" "}
                                            — AI team, service integrations, the full
                                            vision
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* CTA */}
                        <section className="pt-4">
                            <Link
                                href="/connect"
                                className="btn-holo inline-flex items-center gap-2"
                            >
                                <span>Start Connecting</span>
                                <svg
                                    className="h-4 w-4"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M13 7l5 5m0 0l-5 5m5-5H6"
                                    />
                                </svg>
                            </Link>
                        </section>
                    </div>
                </main>

                <Footer />
            </div>
        </div>
    );
}
