import Link from "next/link";
import type { Metadata } from "next";

import { Footer } from "@/components/footer";
import { SiteHeader } from "@/components/site-header";
import { HolographicBackground } from "@/components/ui/holographic-background";

export const metadata: Metadata = {
    title: "AI-First Development · Carmenta",
    description:
        "How products get built in the age of AI. Specification as source of truth, code as derived. Products that improve themselves.",
};

export default function AIFirstDevelopmentPage() {
    return (
        <div className="relative min-h-screen">
            <HolographicBackground />

            <div className="relative z-10 flex min-h-screen flex-col">
                <SiteHeader bordered />
                <main className="flex flex-1 flex-col items-center px-6 py-12">
                    <div className="mx-auto max-w-2xl space-y-12">
                        {/* Hero */}
                        <section className="space-y-6 text-center">
                            <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
                                AI-First Development
                            </h1>
                            <p className="text-xl leading-relaxed text-muted-foreground md:text-2xl">
                                How products get built in the age of AI.
                            </p>
                        </section>

                        {/* The Core Insight */}
                        <section className="glass-card space-y-4 text-left">
                            <h2 className="text-lg font-semibold text-foreground/90">
                                The Core Insight
                            </h2>
                            <div className="space-y-4 leading-relaxed text-foreground/80">
                                <p className="text-lg font-medium text-foreground">
                                    Products are conversations, not artifacts.
                                </p>
                                <p>
                                    A product is an ongoing dialogue between creators
                                    and users, continuously shaped by signals, never
                                    finished. The specification is a living model of
                                    intent that evolves as understanding deepens.
                                </p>
                                <p>
                                    Code is derived. The specification is the source of
                                    truth. When understanding changes, implementation
                                    follows.
                                </p>
                            </div>
                        </section>

                        {/* The Self-Improving Loop */}
                        <section className="glass-card space-y-4 text-left">
                            <h2 className="text-lg font-semibold text-foreground/90">
                                The Self-Improving Loop
                            </h2>
                            <div className="space-y-4 leading-relaxed text-foreground/80">
                                <div className="rounded border border-border bg-muted/30 p-4 font-mono text-sm">
                                    <div className="text-muted-foreground">
                                        Vision → Specification → Implementation → Usage
                                        → Signals
                                    </div>
                                    <div className="mt-2 text-primary">
                                        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;↑&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;↓
                                    </div>
                                    <div className="text-primary">
                                        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;←←←←← AI
                                        Product Intelligence ←←←←←
                                    </div>
                                </div>
                                <p>
                                    Traditional products iterate over months. User
                                    research, planning, development, launch, feedback
                                    collection, analysis, more planning. The loop takes
                                    quarters.
                                </p>
                                <p>AI-first products compress this to hours:</p>
                                <ol className="list-inside list-decimal space-y-1 pl-4">
                                    <li>
                                        AI agents test the product continuously,
                                        generating usage signals
                                    </li>
                                    <li>
                                        AI Product Manager synthesizes signals into
                                        specification updates
                                    </li>
                                    <li>AI implements approved changes</li>
                                    <li>Loop repeats</li>
                                </ol>
                                <p>
                                    The product improves while you sleep. Feedback flows
                                    directly into improvement. The structural advantage
                                    compounds.
                                </p>
                            </div>
                        </section>

                        {/* What Remains Human */}
                        <section className="glass-card space-y-4 text-left">
                            <h2 className="text-lg font-semibold text-foreground/90">
                                What Remains Human
                            </h2>
                            <div className="space-y-4 leading-relaxed text-foreground/80">
                                <p>
                                    <span className="font-medium text-foreground">
                                        Taste.
                                    </span>{" "}
                                    Knowing what is worth building. The difference
                                    between a product that technically works and one
                                    people love. AI generates variations. Someone
                                    chooses.
                                </p>
                                <p>
                                    <span className="font-medium text-foreground">
                                        Accountability.
                                    </span>{" "}
                                    When the system fails and there are consequences,
                                    someone owns the decision to ship. AI optimizes. It
                                    cannot be responsible.
                                </p>
                                <p>
                                    <span className="font-medium text-foreground">
                                        Novel insight.
                                    </span>{" "}
                                    AI works from patterns in training data. When doing
                                    something genuinely unprecedented, human creativity
                                    leads. AI accelerates execution of human insight.
                                </p>
                                <p>
                                    <span className="font-medium text-foreground">
                                        Trust and relationships.
                                    </span>{" "}
                                    People hire people. Your network, reputation,
                                    ability to understand what someone really needs.
                                    This is durable.
                                </p>
                            </div>
                        </section>

                        {/* The 2027 View */}
                        <section className="glass-card space-y-4 text-left">
                            <h2 className="text-lg font-semibold text-foreground/90">
                                The 2027 View
                            </h2>
                            <div className="space-y-4 leading-relaxed text-foreground/80">
                                <p className="text-lg font-medium text-foreground">
                                    Products become organisms, not artifacts.
                                </p>
                                <p>The team is:</p>
                                <ul className="list-inside list-disc space-y-1 pl-4">
                                    <li>Human(s) with vision and taste</li>
                                    <li>AI PM processing all signals</li>
                                    <li>AI engineers implementing changes</li>
                                    <li>AI testers validating continuously</li>
                                </ul>
                                <p>
                                    The specification is not a markdown file. It is a
                                    living model of intent, maintained by the system,
                                    viewable as documents but not limited to them.
                                </p>
                                <p>
                                    Human creative capacity to imagine what is worth
                                    building becomes the constraint. The translation to
                                    running software is nearly instantaneous. The
                                    product converges toward user needs automatically.
                                </p>
                            </div>
                        </section>

                        {/* Carmenta Is Built This Way */}
                        <section className="glass-card space-y-4 text-left">
                            <h2 className="text-lg font-semibold text-foreground/90">
                                Carmenta Is Built This Way
                            </h2>
                            <div className="space-y-4 leading-relaxed text-foreground/80">
                                <p>
                                    This isn&apos;t theory—we practice what we teach.
                                    Carmenta is built using AI-First Development. The
                                    specification lives in version control. Code is
                                    generated from it. The specification is the IP.
                                </p>
                                <p>
                                    We&apos;re building in public so you can watch the
                                    methodology in action. The flywheel—agents test, AI
                                    PM synthesizes, AI builds—is how we improve Carmenta
                                    together.
                                </p>
                                <p>
                                    The methodology and the product are the same thing.
                                </p>
                            </div>
                        </section>

                        {/* CTA */}
                        <section className="space-y-4 text-center">
                            <p className="text-muted-foreground">
                                Want to see this in practice?
                            </p>
                            <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
                                <Link
                                    href="https://github.com/carmentacollective/carmenta"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 rounded-full border border-primary bg-primary/10 px-6 py-3 text-sm font-medium text-primary transition-all hover:scale-105 hover:bg-primary/20"
                                >
                                    View the Source
                                </Link>
                                <Link
                                    href="/"
                                    className="inline-flex items-center gap-2 rounded-full border border-border bg-white/50 px-6 py-3 text-sm font-medium text-foreground backdrop-blur-sm transition-all hover:scale-105 hover:bg-white/80"
                                >
                                    Back to Carmenta
                                </Link>
                            </div>
                        </section>
                    </div>
                </main>

                <Footer />
            </div>
        </div>
    );
}
