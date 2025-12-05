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
                <h2 className="text-lg font-semibold text-foreground/90">Oracle</h2>
                <p className="mt-2 text-foreground/70">
                    Visual communication of Carmenta's activity across the application.
                </p>
            </div>

            {/* Header Context - how it appears in navigation */}
            <div className="glass-card space-y-6">
                <div>
                    <h3 className="text-lg font-medium text-foreground/90">Header</h3>
                    <p className="text-sm text-foreground/60">Navigation bar context</p>
                </div>
                <div className="flex items-center gap-8">
                    <div className="flex flex-col items-center gap-3">
                        <Oracle state="breathing" size="sm" />
                        <div className="text-center">
                            <span className="block text-xs font-medium text-foreground/70">
                                Idle
                            </span>
                            <span className="block text-xs text-foreground/40">
                                Breathing
                            </span>
                        </div>
                    </div>
                    <div className="flex flex-col items-center gap-3">
                        <Oracle state="working" size="sm" />
                        <div className="text-center">
                            <span className="block text-xs font-medium text-foreground/70">
                                Concierge
                            </span>
                            <span className="block text-xs text-foreground/40">
                                Analyzing
                            </span>
                        </div>
                    </div>
                    <div className="flex flex-col items-center gap-3">
                        <Oracle state="notification" size="sm" />
                        <div className="text-center">
                            <span className="block text-xs font-medium text-foreground/70">
                                Notification
                            </span>
                            <span className="block text-xs text-foreground/40">
                                Thinking
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Hero Context - how it appears on landing */}
            <div className="glass-card space-y-6">
                <div>
                    <h3 className="text-lg font-medium text-foreground/90">
                        Landing Page
                    </h3>
                    <p className="text-sm text-foreground/60">Hero section context</p>
                </div>
                <div className="flex items-center gap-12">
                    <div className="flex flex-col items-center gap-4">
                        <Oracle state="breathing" size="lg" />
                        <div className="text-center">
                            <span className="block text-xs font-medium text-foreground/70">
                                Welcome
                            </span>
                            <span className="block text-xs text-foreground/40">
                                Container swell (8s)
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Animation Specs */}
            <div className="glass-card space-y-4">
                <h3 className="text-lg font-medium text-foreground/90">
                    Animation Specs
                </h3>
                <div className="space-y-2 text-sm text-foreground/70">
                    <p>
                        <strong>Breathing:</strong> Container scales 1.0 → 1.08 over 8s
                        (ease-in-out)
                    </p>
                    <p>
                        <strong>Working:</strong> Rainbow ring spins + glow pulses over
                        3s
                    </p>
                    <p>
                        <strong>Notification:</strong> Icon badge with subtle glow
                    </p>
                </div>
            </div>
        </section>
    );
}
