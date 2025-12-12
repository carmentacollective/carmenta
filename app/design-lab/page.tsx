import Link from "next/link";
import { HolographicBackground } from "@/components/ui/holographic-background";

/**
 * Design Lab Index - Landing page for design explorations
 *
 * Lists active explorations and provides instructions for creating new ones.
 * Each exploration lives at /design-lab/[topic]
 *
 * NOTE: Intentionally omits SiteHeader and Footer - this is a design laboratory
 * for exploring UI patterns. The centered layout with holographic background serves
 * as the interface. Navigation back to the main site is provided through the
 * design patterns being tested.
 */
export default function DesignLabIndex() {
    return (
        <div className="relative min-h-screen">
            <HolographicBackground />

            <div className="relative z-10 flex min-h-screen flex-col items-center justify-center p-6">
                <div className="w-full max-w-2xl space-y-8">
                    {/* Header */}
                    <div className="text-center">
                        <h1 className="text-4xl font-light text-foreground/90">
                            Design Lab
                        </h1>
                        <p className="mt-2 text-lg text-foreground/60">
                            Interactive exploration of UI patterns and components
                        </p>
                    </div>

                    {/* Instructions */}
                    <div className="glass-card space-y-4">
                        <h2 className="text-lg font-medium text-foreground/80">
                            Create an Exploration
                        </h2>
                        <p className="text-sm leading-relaxed text-foreground/70">
                            Use the{" "}
                            <code className="rounded bg-foreground/10 px-1.5 py-0.5">
                                /design-lab
                            </code>{" "}
                            command to generate design options for any UI pattern:
                        </p>
                        <div className="space-y-2 rounded-lg bg-foreground/5 p-4 font-mono text-sm">
                            <p className="text-foreground/70">
                                /design-lab expand/collapse patterns
                            </p>
                            <p className="text-foreground/70">
                                /design-lab button states
                            </p>
                            <p className="text-foreground/70">
                                /design-lab copy button feedback
                            </p>
                        </div>
                        <p className="text-sm leading-relaxed text-foreground/70">
                            Each exploration creates a dedicated page where you can
                            navigate options, view code, and provide feedback for
                            iteration.
                        </p>
                    </div>

                    {/* How it works */}
                    <div className="glass-card space-y-4">
                        <h2 className="text-lg font-medium text-foreground/80">
                            How It Works
                        </h2>
                        <ol className="space-y-3 text-sm text-foreground/70">
                            <li className="flex gap-3">
                                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-medium text-primary">
                                    1
                                </span>
                                <span>
                                    Run{" "}
                                    <code className="rounded bg-foreground/10 px-1.5 py-0.5">
                                        /design-lab [topic]
                                    </code>{" "}
                                    to generate 8-10 genuinely varied options
                                </span>
                            </li>
                            <li className="flex gap-3">
                                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-medium text-primary">
                                    2
                                </span>
                                <span>
                                    Navigate options with arrow keys, view code with
                                    'c', jump with 1-9
                                </span>
                            </li>
                            <li className="flex gap-3">
                                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-medium text-primary">
                                    3
                                </span>
                                <span>
                                    Iterate: "I like 3 and 7 - iterate with softer
                                    transitions"
                                </span>
                            </li>
                        </ol>
                    </div>

                    {/* Keyboard shortcuts */}
                    <div className="glass-card">
                        <h2 className="text-lg font-medium text-foreground/80">
                            Keyboard Shortcuts
                        </h2>
                        <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <dt className="text-foreground/60">Navigate options</dt>
                                <dd className="font-mono text-foreground/80">
                                    ← → or h l
                                </dd>
                            </div>
                            <div>
                                <dt className="text-foreground/60">Jump to option</dt>
                                <dd className="font-mono text-foreground/80">1-9</dd>
                            </div>
                            <div>
                                <dt className="text-foreground/60">Toggle code view</dt>
                                <dd className="font-mono text-foreground/80">c</dd>
                            </div>
                        </dl>
                    </div>
                </div>
            </div>
        </div>
    );
}
