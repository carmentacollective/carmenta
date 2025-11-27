import { Github } from "lucide-react";
import Link from "next/link";

export default function LandingPage() {
    return (
        <div className="flex min-h-screen flex-col">
            {/* Main content */}
            <main className="flex flex-1 flex-col items-center justify-center px-6 py-16">
                <div className="mx-auto max-w-2xl space-y-12 text-center">
                    {/* Hero */}
                    <section className="space-y-6">
                        <div className="inline-block border border-primary/50 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-primary">
                            M0: Stake in the Ground
                        </div>
                        <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
                            CARMENTA_
                        </h1>
                        <p className="text-xl leading-relaxed text-muted-foreground md:text-2xl">
                            The best interface to AI for people who build at the speed
                            of thought.
                        </p>
                    </section>

                    {/* The Vision */}
                    <section className="blueprint-box space-y-4 text-left">
                        <h2 className="text-lg font-bold uppercase tracking-widest text-primary">
                            [00] The Vision
                        </h2>
                        <div className="space-y-4 leading-relaxed text-foreground/80">
                            <p>One interface. All AI models. Complete memory.</p>
                            <p>
                                Carmenta remembers who you are, what you're working on,
                                what you've decided, who you know, what you've learned.
                                We talk naturally—voice that actually works. We respond
                                with purpose-built interfaces, not chat bubbles.
                            </p>
                            <p>A unified front door to everything AI can do for you.</p>
                        </div>
                    </section>

                    {/* The Philosophy */}
                    <section className="blueprint-box space-y-4 text-left">
                        <h2 className="text-lg font-bold uppercase tracking-widest text-primary">
                            [01] The Philosophy
                        </h2>
                        <div className="space-y-4 leading-relaxed text-foreground/80">
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
                                carried human knowledge for millennia. She was also the
                                goddess of prophecy and protector of those going through
                                transformation.
                            </p>
                            <p>Technology in service of human flourishing.</p>
                        </div>
                    </section>

                    {/* Where We Are */}
                    <section className="blueprint-box space-y-4 text-left">
                        <h2 className="text-lg font-bold uppercase tracking-widest text-primary">
                            [02] Where We Are
                        </h2>
                        <div className="space-y-4 leading-relaxed text-foreground/80">
                            <p>
                                You're looking at the blueprint. This page <em>is</em>{" "}
                                the product right now—a stake in the ground, a
                                declaration of intent.
                            </p>
                            <p>
                                We're building in public. The specification, the
                                decisions, the code—all open. If this vision resonates,
                                follow along as we build it together.
                            </p>
                        </div>
                    </section>

                    {/* What's Next */}
                    <section className="blueprint-box space-y-4 text-left">
                        <h2 className="text-lg font-bold uppercase tracking-widest text-primary">
                            [03] What's Next
                        </h2>
                        <div className="space-y-4 text-foreground/80">
                            <div className="grid gap-3 text-sm">
                                <div className="flex items-start gap-3">
                                    <span className="mt-0.5 inline-block h-2 w-2 bg-primary" />
                                    <div>
                                        <span className="font-bold text-foreground">
                                            M1: Soul Proven
                                        </span>
                                        <span className="text-muted-foreground">
                                            {" "}
                                            — The heart-centered experience that feels
                                            meaningfully different
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <span className="mt-0.5 inline-block h-2 w-2 border border-muted-foreground/50" />
                                    <div>
                                        <span className="font-bold text-foreground">
                                            M2: Relationship Grows
                                        </span>
                                        <span className="text-muted-foreground">
                                            {" "}
                                            — Memory that builds over time, a
                                            relationship that deepens
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <span className="mt-0.5 inline-block h-2 w-2 border border-muted-foreground/50" />
                                    <div>
                                        <span className="font-bold text-foreground">
                                            M3: Flow State
                                        </span>
                                        <span className="text-muted-foreground">
                                            {" "}
                                            — Voice-first, polished, your primary AI
                                            interface
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <span className="mt-0.5 inline-block h-2 w-2 border border-muted-foreground/50" />
                                    <div>
                                        <span className="font-bold text-foreground">
                                            M4: Ready for Everyone
                                        </span>
                                        <span className="text-muted-foreground">
                                            {" "}
                                            — AI team, service integrations, the full
                                            vision
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>
                </div>
            </main>

            {/* Footer */}
            <footer className="border-t border-border px-6 py-8">
                <div className="mx-auto flex max-w-2xl items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                        Carmenta Collective
                    </span>
                    <Link
                        href="https://github.com/carmentacollective/carmenta"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                        aria-label="View source on GitHub"
                    >
                        <span className="hidden sm:inline">Building in public</span>
                        <Github className="h-5 w-5" />
                    </Link>
                </div>
            </footer>
        </div>
    );
}
