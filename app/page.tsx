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
                    <div className="mx-auto max-w-2xl space-y-12 text-center">
                        {/* Vision Card */}
                        <article className="glass-card space-y-4 text-left">
                            <h2 className="text-lg font-semibold text-foreground/90">
                                The Vision
                            </h2>
                            <div className="space-y-4 leading-relaxed text-foreground/70">
                                <p>One interface. All AI models. Complete memory.</p>
                                <p>
                                    Carmenta remembers who you are, what you're working
                                    on, what you've decided, who you know, what you've
                                    learned. The right model for each moment, chosen
                                    automatically. An AI team—including a Digital Chief
                                    of Staff—works alongside you. Purpose-built
                                    responses, not chat bubbles.
                                </p>
                                <p>The best interface to AI that exists.</p>
                            </div>
                        </article>

                        {/* Philosophy Card */}
                        <article className="glass-card space-y-4 text-left">
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
                        </article>

                        {/* Status Card */}
                        <article className="glass-card space-y-4 text-left">
                            <h2 className="text-lg font-semibold text-foreground/90">
                                Where We Are
                            </h2>
                            <div className="space-y-4 leading-relaxed text-foreground/70">
                                <p>
                                    You can{" "}
                                    <Link
                                        href="/connection/new"
                                        className="text-primary underline decoration-primary/50 underline-offset-2 transition-colors hover:decoration-primary"
                                    >
                                        connect with Carmenta
                                    </Link>{" "}
                                    right now. Sign in, choose your model, and we pick
                                    up where we left off—conversations persist, context
                                    intact.
                                </p>
                                <p>
                                    We're open source. The specification, the decisions,
                                    the code—all{" "}
                                    <Link
                                        href="https://github.com/carmentacollective/carmenta"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-primary underline decoration-primary/50 underline-offset-2 transition-colors hover:decoration-primary"
                                    >
                                        on GitHub
                                    </Link>
                                    . Next: memory that spans conversations, so Carmenta
                                    truly knows you.
                                </p>
                            </div>
                        </article>

                        {/* Journey Section */}
                        <section className="glass-card space-y-5 text-left">
                            <div className="space-y-3">
                                <h2 className="text-lg font-semibold text-foreground/90">
                                    The Journey
                                </h2>
                                {/* Progress bar */}
                                <div className="flex gap-1">
                                    <div className="h-1.5 flex-1 rounded-full bg-primary" />
                                    <div className="h-1.5 flex-1 rounded-full bg-primary" />
                                    <div className="h-1.5 flex-1 rounded-full bg-primary" />
                                    <div className="h-1.5 flex-1 rounded-full bg-primary/30" />
                                    <div className="h-1.5 flex-1 rounded-full bg-foreground/10" />
                                    <div className="h-1.5 flex-1 rounded-full bg-foreground/10" />
                                </div>
                            </div>

                            {/* Completed milestones */}
                            <div className="space-y-1 text-sm">
                                <div className="flex items-center gap-2 text-foreground/50">
                                    <span className="text-primary">✓</span>
                                    <span>
                                        M0: Stake in the Ground — Vision articulated,
                                        building in public
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 text-foreground/50">
                                    <span className="text-primary">✓</span>
                                    <span>
                                        M0.5: First Connection — Backend-first
                                        streaming, conversation persistence, model
                                        selection
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 text-foreground/50">
                                    <span className="text-primary">✓</span>
                                    <span>
                                        M1: Soul Proven — Auth, error handling,
                                        observability, an experience worth returning to
                                    </span>
                                </div>
                            </div>

                            {/* Current milestone */}
                            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                                <div className="mb-2 flex items-center gap-2">
                                    <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-primary" />
                                    <span className="font-semibold text-foreground/90">
                                        M2: Relationship Grows
                                    </span>
                                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs uppercase tracking-wider text-primary">
                                        Now
                                    </span>
                                </div>
                                <p className="text-sm text-foreground/70">
                                    Memory that spans conversations. Extended thinking
                                    you can see. Carmenta starts to know you.
                                </p>
                            </div>

                            {/* Future milestones */}
                            <div className="space-y-3 text-sm">
                                <div>
                                    <span className="font-medium text-foreground/70">
                                        M3: Flow State
                                    </span>
                                    <p className="mt-0.5 text-foreground/50">
                                        Voice-first interaction. Intelligent model
                                        routing. Files and context. Work at the speed
                                        you think.
                                    </p>
                                </div>
                                <div>
                                    <span className="font-medium text-foreground/70">
                                        M4: Ready for Everyone
                                    </span>
                                    <p className="mt-0.5 text-foreground/50">
                                        Your AI team. Service integrations. The full
                                        vision realized.
                                    </p>
                                </div>
                            </div>
                        </section>

                        {/* CTA */}
                        <section className="pt-4">
                            <ConnectCTA />
                        </section>
                    </div>
                </main>

                <Footer />
            </div>
        </div>
    );
}
