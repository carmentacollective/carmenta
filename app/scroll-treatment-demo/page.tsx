"use client";

import { SendHorizontal } from "lucide-react";

/**
 * Demo page comparing different glass input dock styles.
 *
 * All examples use the iOS Messages content mask pattern to prevent
 * text from showing under the input. Variants show different opacity
 * and shadow combinations for the glass input dock.
 */
export default function ScrollTreatmentDemo() {
    return (
        <div className="min-h-screen bg-background px-4 py-12">
            <div className="mx-auto max-w-7xl">
                <h1 className="mb-2 text-center text-4xl font-light tracking-tight text-foreground/85">
                    Glass Input Dock Variants
                </h1>
                <p className="mb-4 text-center text-foreground/60">
                    All use iOS Messages content fade - comparing opacity & shadow
                    styles
                </p>
                <p className="mb-12 text-center text-sm text-foreground/50">
                    Content never bleeds under the input ✓
                </p>

                <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 xl:grid-cols-3">
                    <TreatmentOption
                        number={1}
                        title="Light Glass"
                        description="85% opacity with subtle shadow - airy and ethereal"
                        implementation="rgba(255, 255, 255, 0.85)"
                        pros={[
                            "Maintains translucent aesthetic",
                            "Light and elegant",
                            "Good readability",
                        ]}
                        cons={["Some background visible", "May need more opacity"]}
                        variant="light"
                    />

                    <TreatmentOption
                        number={2}
                        title="Medium Glass"
                        description="90% opacity with standard shadow - balanced approach"
                        implementation="rgba(255, 255, 255, 0.90)"
                        pros={[
                            "Great balance of glass + readability",
                            "Still has translucent feel",
                            "Works in most situations",
                        ]}
                        cons={["Slightly less ethereal than light"]}
                        variant="medium"
                    />

                    <TreatmentOption
                        number={3}
                        title="Heavy Glass"
                        description="95% opacity with strong shadow - professional polish"
                        implementation="rgba(255, 255, 255, 0.95)"
                        pros={[
                            "Excellent readability",
                            "Professional appearance",
                            "WCAG compliant",
                        ]}
                        cons={["Less translucent", "Heavier feel"]}
                        variant="heavy"
                    />

                    <TreatmentOption
                        number={4}
                        title="Maximum Opacity"
                        description="98% opacity with very strong shadow - nearly solid"
                        implementation="rgba(255, 255, 255, 0.98)"
                        pros={[
                            "Perfect readability",
                            "Zero ambiguity",
                            "Strong visual hierarchy",
                        ]}
                        cons={["Loses most glass effect", "Heavy visual weight"]}
                        variant="maximum"
                    />

                    <TreatmentOption
                        number={5}
                        title="Subtle Shadow + 92%"
                        description="92% opacity with very subtle shadow - minimal approach"
                        implementation="rgba(255, 255, 255, 0.92) + subtle shadow"
                        pros={[
                            "Minimal visual noise",
                            "Clean and modern",
                            "Good readability",
                        ]}
                        cons={["Less depth", "May feel flat"]}
                        variant="subtle"
                    />

                    <TreatmentOption
                        number={6}
                        title="Current (Reference)"
                        description="Your current 60% opacity for comparison"
                        implementation="rgba(255, 255, 255, 0.60)"
                        pros={["Maximum translucency"]}
                        cons={["Too transparent", "Readability issues without mask"]}
                        variant="current"
                    />
                </div>

                <div className="glass-card mx-auto mt-12 max-w-3xl">
                    <h2 className="mb-4 text-xl font-semibold text-foreground/90">
                        💡 Recommendation
                    </h2>
                    <p className="mb-4 text-foreground/70">
                        <strong>Option 2 (Medium Glass)</strong> or{" "}
                        <strong>Option 3 (Heavy Glass)</strong> hit the sweet spot:
                    </p>
                    <ul className="mb-6 space-y-2 text-sm text-foreground/70">
                        <li>
                            • 90-95% opacity maintains some translucency while ensuring
                            readability
                        </li>
                        <li>
                            • Content mask prevents text from bleeding under the input
                        </li>
                        <li>• Standard shadow provides depth without overwhelming</li>
                        <li>• WCAG 2.2 compliant for accessibility</li>
                    </ul>
                    <p className="text-sm text-foreground/60">
                        This matches industry standards from iOS Messages, Telegram, and
                        WhatsApp.
                    </p>
                </div>
            </div>
        </div>
    );
}

interface TreatmentOptionProps {
    number: number;
    title: string;
    description: string;
    implementation: string;
    pros: string[];
    cons: string[];
    variant: "light" | "medium" | "heavy" | "maximum" | "subtle" | "current";
}

function TreatmentOption({
    number,
    title,
    description,
    implementation,
    pros,
    cons,
    variant,
}: TreatmentOptionProps) {
    return (
        <div className="glass-card flex flex-col">
            <div className="mb-4">
                <div className="mb-1 text-sm font-medium text-primary">
                    Option {number}
                </div>
                <h2 className="mb-2 text-xl font-semibold text-foreground/90">
                    {title}
                </h2>
                <p className="mb-2 text-sm text-foreground/60">{description}</p>
                <p className="rounded bg-foreground/5 px-2 py-1 font-mono text-xs text-foreground/50">
                    {implementation}
                </p>
            </div>

            {/* Interactive demo */}
            <ChatDemo variant={variant} />

            {/* Pros and cons */}
            <div className="mt-4 space-y-3">
                <div>
                    <h3 className="mb-2 text-sm font-semibold text-green-700/80">
                        ✓ Pros
                    </h3>
                    <ul className="space-y-1 text-sm text-foreground/70">
                        {pros.map((pro, i) => (
                            <li key={i}>• {pro}</li>
                        ))}
                    </ul>
                </div>
                <div>
                    <h3 className="mb-2 text-sm font-semibold text-orange-700/80">
                        ⚠ Cons
                    </h3>
                    <ul className="space-y-1 text-sm text-foreground/70">
                        {cons.map((con, i) => (
                            <li key={i}>• {con}</li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );
}

interface ChatDemoProps {
    variant: "light" | "medium" | "heavy" | "maximum" | "subtle" | "current";
}

function ChatDemo({ variant }: ChatDemoProps) {
    const getInputStyle = (): React.CSSProperties => {
        const baseStyle = {
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
        };

        switch (variant) {
            case "light":
                return {
                    ...baseStyle,
                    background: "rgba(255, 255, 255, 0.85)",
                    boxShadow:
                        "0 4px 20px rgba(180, 140, 200, 0.15), 0 0 0 1px rgba(255, 255, 255, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.7)",
                };
            case "medium":
                return {
                    ...baseStyle,
                    background: "rgba(255, 255, 255, 0.90)",
                    boxShadow:
                        "0 6px 28px rgba(180, 140, 200, 0.2), 0 0 0 1px rgba(255, 255, 255, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.8)",
                };
            case "heavy":
                return {
                    ...baseStyle,
                    background: "rgba(255, 255, 255, 0.95)",
                    boxShadow:
                        "0 8px 32px rgba(180, 140, 200, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.9)",
                };
            case "maximum":
                return {
                    ...baseStyle,
                    background: "rgba(255, 255, 255, 0.98)",
                    boxShadow:
                        "0 12px 40px rgba(180, 140, 200, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.95)",
                };
            case "subtle":
                return {
                    ...baseStyle,
                    background: "rgba(255, 255, 255, 0.92)",
                    boxShadow:
                        "0 2px 12px rgba(180, 140, 200, 0.12), 0 0 0 1px rgba(255, 255, 255, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.7)",
                };
            case "current":
            default:
                return {
                    ...baseStyle,
                    background: "rgba(255, 255, 255, 0.60)",
                    boxShadow:
                        "0 8px 32px rgba(180, 140, 200, 0.2), 0 0 0 1px rgba(255, 255, 255, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.8)",
                };
        }
    };

    return (
        <div className="relative h-[400px] overflow-hidden rounded-xl bg-background">
            {/* Scrollable messages area with iOS Messages mask */}
            <div
                className="scrollbar-thin h-full overflow-y-auto px-4 pb-4 pt-4"
                style={{
                    maskImage:
                        "linear-gradient(to bottom, black 65%, transparent 100%)",
                    WebkitMaskImage:
                        "linear-gradient(to bottom, black 65%, transparent 100%)",
                }}
            >
                <DemoMessage type="assistant">
                    Three-month planning deserves our deepest thinking - we'll work
                    through the nuances, tradeoffs, and possibilities together with
                    extended reasoning 🧠
                </DemoMessage>

                <DemoMessage type="user">
                    Let's do some deep thinking about how I should do a 3 month plan
                </DemoMessage>

                <DemoMessage type="assistant">
                    This is an open-ended, thoughtful request. I should engage warmly
                    and help them think through this - asking clarifying questions to
                    understand their context.
                </DemoMessage>

                <DemoMessage type="assistant">
                    I shouldn't assume what domain this is for - could be personal
                    goals, business, career, health, a project, etc. Let me ask some
                    guiding questions.
                </DemoMessage>

                <DemoMessage type="assistant" last>
                    A three-month horizon is perfect for meaningful progress. Before we
                    dive into structure, let's clarify what matters most - what area of
                    life or work are we planning for?
                </DemoMessage>
            </div>

            {/* Chat input dock with variant-specific styling */}
            <div className="absolute bottom-0 left-0 right-0 flex items-center justify-center bg-transparent px-4 pb-4 pt-4">
                <div
                    className="flex w-full max-w-[700px] items-center rounded-[28px] p-2"
                    style={getInputStyle()}
                >
                    <input
                        type="text"
                        placeholder="What's on your mind?"
                        className="min-h-12 flex-1 resize-none border-none bg-transparent px-4 py-3 text-sm text-foreground/95 outline-none placeholder:text-foreground/40"
                        disabled
                    />
                    <button
                        className="mr-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[rgba(200,160,220,0.9)] via-[rgba(160,200,220,0.9)] to-[rgba(220,180,200,0.9)] text-white opacity-70 shadow-md transition-all hover:scale-105 hover:opacity-100"
                        disabled
                    >
                        <SendHorizontal className="h-5 w-5" />
                    </button>
                </div>
            </div>
        </div>
    );
}

interface DemoMessageProps {
    type: "user" | "assistant";
    children: React.ReactNode;
    last?: boolean;
}

function DemoMessage({ type, children, last = false }: DemoMessageProps) {
    if (type === "user") {
        return (
            <div className={`flex w-full justify-end ${last ? "" : "mb-4"}`}>
                <div className="user-message-bubble max-w-[80%] rounded-2xl rounded-br-md px-4 py-3 text-sm">
                    {children}
                </div>
            </div>
        );
    }

    return (
        <div className={`flex w-full justify-start ${last ? "" : "mb-4"}`}>
            <div className="assistant-message-bubble max-w-[85%] rounded-2xl rounded-bl-md px-4 py-3 text-sm">
                {children}
            </div>
        </div>
    );
}
