"use client";

import { Oracle } from "@/components/ui/oracle";

/**
 * Oracle Showcase
 *
 * Shows how Carmenta's Oracle icon appears across the application.
 */
export function OracleShowcase() {
    return (
        <section className="space-y-12">
            <div>
                <h2 className="text-foreground/90 text-lg font-semibold">Oracle</h2>
                <p className="text-foreground/70 mt-2">
                    Visual communication of Carmenta's activity across the application.
                </p>
            </div>

            {/* Header Context - how it appears in navigation */}
            <div className="glass-card space-y-6">
                <div>
                    <h3 className="text-foreground/90 text-lg font-medium">Header</h3>
                    <p className="text-foreground/60 text-sm">Navigation bar context</p>
                </div>
                <div className="flex items-center gap-8">
                    <div className="flex flex-col items-center gap-3">
                        <Oracle state="breathing" size="sm" />
                        <div className="text-center">
                            <span className="text-foreground/70 block text-xs font-medium">
                                Idle
                            </span>
                            <span className="text-foreground/40 block text-xs">
                                Breathing
                            </span>
                        </div>
                    </div>
                    <div className="flex flex-col items-center gap-3">
                        <Oracle state="working" size="sm" />
                        <div className="text-center">
                            <span className="text-foreground/70 block text-xs font-medium">
                                Concierge
                            </span>
                            <span className="text-foreground/40 block text-xs">
                                Analyzing
                            </span>
                        </div>
                    </div>
                    <div className="flex flex-col items-center gap-3">
                        <Oracle state="idle" size="sm" />
                        <div className="text-center">
                            <span className="text-foreground/70 block text-xs font-medium">
                                Idle
                            </span>
                            <span className="text-foreground/40 block text-xs">
                                Static
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Hero Context - how it appears on landing */}
            <div className="glass-card space-y-6">
                <div>
                    <h3 className="text-foreground/90 text-lg font-medium">
                        Landing Page
                    </h3>
                    <p className="text-foreground/60 text-sm">Hero section context</p>
                </div>
                <div className="flex items-center gap-12">
                    <div className="flex flex-col items-center gap-4">
                        <Oracle state="breathing" size="lg" />
                        <div className="text-center">
                            <span className="text-foreground/70 block text-xs font-medium">
                                Welcome
                            </span>
                            <span className="text-foreground/40 block text-xs">
                                Container swell (8s)
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Animation Specs */}
            <div className="glass-card space-y-4">
                <h3 className="text-foreground/90 text-lg font-medium">
                    Animation Specs
                </h3>
                <div className="text-foreground/70 space-y-2 text-sm">
                    <p>
                        <strong>Idle:</strong> Static, no animation
                    </p>
                    <p>
                        <strong>Breathing:</strong> Container scales 0.9 → 1.1 over 8s
                        (ease-in-out)
                    </p>
                    <p>
                        <strong>Working:</strong> Holographic ring spins over 2s
                    </p>
                </div>
            </div>
        </section>
    );
}
