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
                        <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
                            Carmenta
                        </h1>
                        <p className="text-xl leading-relaxed text-muted-foreground md:text-2xl">
                            The best interface to AI for people who build at the speed
                            of thought.
                        </p>
                    </section>

                    {/* The Problem */}
                    <section className="wireframe-box space-y-4 text-left">
                        <h2 className="text-lg font-semibold text-muted-foreground">
                            The Problem
                        </h2>
                        <p className="leading-relaxed text-foreground/80">
                            You use AI constantly. ChatGPT, Claude.ai, Cursor, Claude
                            Code. Each conversation starts fresh. Context doesn't
                            persist. You explain your situation again. And again. Your
                            knowledge is scattered across tools that don't talk to each
                            other.
                        </p>
                    </section>

                    {/* What We're Building */}
                    <section className="wireframe-box space-y-4 text-left">
                        <h2 className="text-lg font-semibold text-muted-foreground">
                            What We're Building
                        </h2>
                        <div className="space-y-4 leading-relaxed text-foreground/80">
                            <p>One interface. All AI models. Complete memory.</p>
                            <p>
                                Carmenta remembers who you are, what you're working on,
                                what you've decided, who you know, what you've learned.
                                We talk naturally - voice that actually works. We
                                respond with purpose, not chat bubbles.
                            </p>
                            <p>
                                Not another wrapper. A unified front door to everything
                                AI can do for you.
                            </p>
                        </div>
                    </section>

                    {/* The Philosophy */}
                    <section className="wireframe-box space-y-4 text-left">
                        <h2 className="text-lg font-semibold text-muted-foreground">
                            The Philosophy
                        </h2>
                        <div className="space-y-4 leading-relaxed text-foreground/80">
                            <p>
                                We use "we" language because this is a partnership.
                                Human and AI as expressions of the same creative
                                impulse, working together.
                            </p>
                            <p>
                                Carmenta was a Roman goddess who invented the Latin
                                alphabet - adapting Greek letters into a system that
                                carried human knowledge for millennia. She was also the
                                goddess of prophecy and protector of those going through
                                transformation.
                            </p>
                            <p>Technology in service of human flourishing.</p>
                        </div>
                    </section>

                    {/* Building in Public */}
                    <section className="wireframe-box space-y-4 text-left">
                        <h2 className="text-lg font-semibold text-muted-foreground">
                            Building in Public
                        </h2>
                        <p className="leading-relaxed text-foreground/80">
                            We're building this openly. The specification, the
                            decisions, the code. If this resonates, follow along.
                        </p>
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
                        className="text-muted-foreground transition-colors hover:text-foreground"
                        aria-label="View source on GitHub"
                    >
                        <Github className="h-5 w-5" />
                    </Link>
                </div>
            </footer>
        </div>
    );
}
