"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Brain, Search, Loader2, Check } from "lucide-react";
import { DesignLabShell, type DesignOption } from "@/components/design-lab";
import { cn } from "@/lib/utils";

const TOPIC = "Chat Response Anatomy";
const ITERATION = 1;

/**
 * Iteration 1: Building on Unified Response Card
 *
 * Key insights from feedback:
 * - Concierge should appear EARLY (before selection completes)
 * - Clear visual distinction: Concierge (Carmenta) vs LLM (model output)
 * - Tools/reasoning are NESTED inside LLM response
 * - Think through all states: sending → selecting → streaming → complete
 */

const OPTIONS: DesignOption[] = [
    {
        id: 1,
        name: "Split Identity",
        rationale:
            "Clear visual split between Carmenta (concierge) and LLM output. Carmenta appears immediately when message is sent with 'Choosing...' state. Her zone is warm purple, LLM zone is neutral. Tools and reasoning nest inside the LLM zone as expandable sections.",
        characteristics: {
            conciergeIdentity: "Warm purple zone, avatar prominent",
            llmIdentity: "Neutral/glass, content-focused",
            hierarchy: "Concierge outside, LLM contains all",
            states: "Choosing → Selected → Streaming → Complete",
        },
        code: `// Split Identity - Concierge vs LLM zones
<div className="response-container">
  {/* CONCIERGE ZONE - Carmenta's identity */}
  <div className="concierge-zone bg-purple-500/5 border-purple-500/20">
    <CarmentaAvatar state={isSelecting ? "thinking" : "idle"} />
    {isSelecting ? (
      <span>Choosing the best model...</span>
    ) : (
      <span>Claude Sonnet · thoughtful</span>
    )}
  </div>

  {/* LLM ZONE - Model's output (appears after selection) */}
  {hasSelected && (
    <div className="llm-zone bg-white/60 dark:bg-black/40">
      {/* Reasoning - nested, collapsible */}
      {reasoning && <ReasoningSection />}

      {/* Tools - nested, inline */}
      {tools.map(t => <ToolCard key={t.id} />)}

      {/* Content - primary */}
      <Content />
    </div>
  )}
</div>`,
    },
    {
        id: 2,
        name: "Progressive Reveal",
        rationale:
            "Concierge zone animates through states: appears immediately, pulses while choosing, settles when selected. LLM response slides in below with smooth transition. Emphasizes the temporal sequence - user sees Carmenta working before content arrives.",
        characteristics: {
            conciergeIdentity: "Animated states, breathing pulse",
            llmIdentity: "Slides in after selection",
            hierarchy: "Sequential reveal, time-based",
            states: "Appear → Pulse → Settle → Content slides in",
        },
        code: `// Progressive Reveal - Temporal sequence
<div className="response-container">
  {/* CONCIERGE - Always visible, animates through states */}
  <motion.div
    className="concierge-zone"
    animate={conciergeState}
    variants={{
      choosing: { scale: [1, 1.02, 1], transition: { repeat: Infinity } },
      selected: { scale: 1 },
    }}
  >
    <CarmentaAvatar state={isSelecting ? "thinking" : "speaking"} />
    <AnimatePresence mode="wait">
      {isSelecting ? (
        <motion.span key="choosing" exit={{ opacity: 0 }}>
          Finding the right approach...
        </motion.span>
      ) : (
        <motion.span key="selected" initial={{ opacity: 0 }}>
          Claude Sonnet · thoughtful
        </motion.span>
      )}
    </AnimatePresence>
  </motion.div>

  {/* LLM ZONE - Slides in after concierge settles */}
  <AnimatePresence>
    {hasSelected && (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="llm-zone"
      >
        {/* Nested content */}
      </motion.div>
    )}
  </AnimatePresence>
</div>`,
    },
    {
        id: 3,
        name: "Inline Concierge",
        rationale:
            "Concierge is a compact inline element that transforms. Starts as 'Carmenta is thinking...' pill, expands to show selection, then becomes a subtle header for the LLM response. Minimal visual footprint but clear presence.",
        characteristics: {
            conciergeIdentity: "Compact pill → expanded → header",
            llmIdentity: "Flows directly below concierge header",
            hierarchy: "Concierge transforms, LLM appears under",
            states: "Pill thinking → Expand → Settle as header",
        },
        code: `// Inline Concierge - Transforming element
<div className="response-container">
  {/* CONCIERGE - Transforms based on state */}
  <motion.div
    className="concierge-inline"
    layout
    animate={{
      width: isSelecting ? "auto" : "100%",
      borderRadius: isSelecting ? "9999px" : "12px 12px 0 0",
    }}
  >
    <CarmentaAvatar size="xs" />
    <span>{isSelecting ? "Thinking..." : "Claude Sonnet"}</span>
    {!isSelecting && (
      <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        · thoughtful
      </motion.span>
    )}
  </motion.div>

  {/* LLM ZONE - Appears connected to concierge */}
  {hasSelected && (
    <div className="llm-zone rounded-t-none border-t-0">
      {/* Content flows naturally */}
    </div>
  )}
</div>`,
    },
];

// ============================================================================
// Demo Components
// ============================================================================

const DEMO_REASONING = `Let me analyze the user's request...

They're asking about revenue trends, which means I should:
1. Focus on quantitative data
2. Highlight comparisons between periods
3. Keep it concise but insightful`;

const DEMO_TOOLS = [
    {
        id: 1,
        name: "webSearch",
        query: "Q3 2024 revenue trends enterprise",
        status: "completed" as const,
    },
];

// ============================================================================
// Option 1: Split Identity
// ============================================================================

function SplitIdentityDemo() {
    const [state, setState] = useState<
        "idle" | "choosing" | "selected" | "streaming" | "complete"
    >("idle");
    const [reasoningOpen, setReasoningOpen] = useState(false);
    const [toolsOpen, setToolsOpen] = useState(true);

    const runDemo = () => {
        setState("choosing");
        setTimeout(() => setState("selected"), 1500);
        setTimeout(() => setState("streaming"), 2000);
        setTimeout(() => setState("complete"), 3500);
    };

    const reset = () => setState("idle");

    const isSelecting = state === "choosing";
    const hasSelected = state !== "idle" && state !== "choosing";
    const isStreaming = state === "streaming";

    return (
        <div className="w-full max-w-2xl space-y-4">
            {/* Controls */}
            <div className="flex gap-2">
                <button
                    onClick={runDemo}
                    disabled={state !== "idle"}
                    className="rounded-lg bg-primary/20 px-3 py-1.5 text-sm text-primary transition-colors hover:bg-primary/30 disabled:opacity-50"
                >
                    Run demo
                </button>
                <button
                    onClick={reset}
                    className="rounded-lg bg-foreground/10 px-3 py-1.5 text-sm text-foreground/70 transition-colors hover:bg-foreground/20"
                >
                    Reset
                </button>
            </div>

            {/* Response container */}
            {state !== "idle" && (
                <div className="space-y-0">
                    {/* CONCIERGE ZONE - Carmenta's identity */}
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={cn(
                            "flex items-center gap-3 rounded-t-2xl border border-b-0 px-4 py-3",
                            "bg-gradient-to-r from-purple-500/10 via-purple-500/5 to-transparent",
                            "border-purple-500/20"
                        )}
                    >
                        {/* Carmenta avatar */}
                        <div className="relative">
                            <motion.div
                                animate={
                                    isSelecting
                                        ? {
                                              scale: [1, 1.1, 1],
                                              opacity: [0.7, 1, 0.7],
                                          }
                                        : { scale: 1, opacity: 1 }
                                }
                                transition={
                                    isSelecting
                                        ? {
                                              duration: 1.5,
                                              repeat: Infinity,
                                              ease: "easeInOut",
                                          }
                                        : { duration: 0.3 }
                                }
                            >
                                <Image
                                    src="/logos/icon-transparent.png"
                                    alt="Carmenta"
                                    width={24}
                                    height={24}
                                    className="drop-shadow-sm"
                                />
                            </motion.div>
                            {isSelecting && (
                                <motion.div
                                    className="absolute inset-0 rounded-full bg-purple-400/30 blur-md"
                                    animate={{
                                        scale: [1, 1.3, 1],
                                        opacity: [0.5, 0.8, 0.5],
                                    }}
                                    transition={{ duration: 1.5, repeat: Infinity }}
                                />
                            )}
                        </div>

                        {/* Status text */}
                        <AnimatePresence mode="wait">
                            {isSelecting ? (
                                <motion.div
                                    key="choosing"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="flex items-center gap-2"
                                >
                                    <span className="text-sm text-purple-700 dark:text-purple-300">
                                        Choosing the best model...
                                    </span>
                                    <Loader2 className="h-3.5 w-3.5 animate-spin text-purple-500/70" />
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="selected"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="flex items-center gap-2"
                                >
                                    <span className="text-sm font-medium text-foreground/80">
                                        Claude Sonnet
                                    </span>
                                    <span className="text-foreground/30">·</span>
                                    <span className="flex items-center gap-1 text-sm text-purple-600/70 dark:text-purple-400/70">
                                        <Brain className="h-3 w-3" />
                                        thoughtful
                                    </span>
                                    <Check className="h-3.5 w-3.5 text-green-500/70" />
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>

                    {/* LLM ZONE - Model's output */}
                    <AnimatePresence>
                        {hasSelected && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                className="overflow-hidden rounded-b-2xl border border-foreground/10 bg-white/60 backdrop-blur-xl dark:bg-black/40"
                            >
                                {/* Reasoning - nested, collapsible */}
                                <div className="border-b border-foreground/10 bg-blue-500/[0.03]">
                                    <button
                                        onClick={() => setReasoningOpen(!reasoningOpen)}
                                        className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-foreground/60 transition-colors hover:bg-foreground/5"
                                    >
                                        <Brain className="h-3.5 w-3.5 text-blue-500/70" />
                                        <span>Reasoning</span>
                                        <ChevronDown
                                            className={cn(
                                                "ml-auto h-4 w-4 transition-transform",
                                                reasoningOpen && "rotate-180"
                                            )}
                                        />
                                    </button>
                                    <AnimatePresence>
                                        {reasoningOpen && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: "auto", opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                className="overflow-hidden"
                                            >
                                                <div className="px-4 pb-3 text-sm leading-relaxed text-foreground/60">
                                                    {DEMO_REASONING}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>

                                {/* Tools - nested, inline */}
                                <div className="border-b border-foreground/10">
                                    <button
                                        onClick={() => setToolsOpen(!toolsOpen)}
                                        className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-foreground/60 transition-colors hover:bg-foreground/5"
                                    >
                                        <Search className="h-3.5 w-3.5 text-amber-500/70" />
                                        <span>Web Search</span>
                                        <span className="ml-1 text-xs text-foreground/40">
                                            {DEMO_TOOLS[0].query}
                                        </span>
                                        <span className="ml-auto rounded-full bg-green-500/20 px-1.5 py-0.5 text-xs text-green-600">
                                            done
                                        </span>
                                        <ChevronDown
                                            className={cn(
                                                "h-4 w-4 transition-transform",
                                                toolsOpen && "rotate-180"
                                            )}
                                        />
                                    </button>
                                    <AnimatePresence>
                                        {toolsOpen && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: "auto", opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                className="overflow-hidden"
                                            >
                                                <div className="px-4 pb-3 text-xs text-foreground/50">
                                                    Found 12 results about enterprise
                                                    revenue growth...
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>

                                {/* Content */}
                                <div className="px-4 py-4 text-foreground/90">
                                    <div className="prose prose-sm dark:prose-invert">
                                        {isStreaming ? (
                                            <p>
                                                Here&apos;s what I found about the
                                                quarterly revenue trends
                                                <motion.span
                                                    animate={{ opacity: [1, 0, 1] }}
                                                    transition={{
                                                        duration: 0.8,
                                                        repeat: Infinity,
                                                    }}
                                                >
                                                    ...
                                                </motion.span>
                                            </p>
                                        ) : (
                                            <>
                                                <p>
                                                    Here&apos;s what I found about the
                                                    quarterly revenue trends:
                                                </p>
                                                <p>
                                                    <strong>Key Highlights:</strong>
                                                </p>
                                                <ul>
                                                    <li>
                                                        Q3 showed 23% growth over Q2
                                                    </li>
                                                    <li>
                                                        Primary driver was the
                                                        enterprise segment
                                                    </li>
                                                    <li>
                                                        APAC region outperformed
                                                        expectations
                                                    </li>
                                                </ul>
                                                <p>
                                                    The data suggests continued momentum
                                                    heading into Q4.
                                                </p>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            )}

            {state === "idle" && (
                <div className="flex h-64 items-center justify-center rounded-2xl border border-dashed border-foreground/20 text-foreground/40">
                    Click &quot;Run demo&quot; to see the response flow
                </div>
            )}
        </div>
    );
}

// ============================================================================
// Option 2: Progressive Reveal
// ============================================================================

function ProgressiveRevealDemo() {
    const [state, setState] = useState<
        "idle" | "choosing" | "selected" | "streaming" | "complete"
    >("idle");
    const [reasoningOpen, setReasoningOpen] = useState(false);

    const runDemo = () => {
        setState("choosing");
        setTimeout(() => setState("selected"), 2000);
        setTimeout(() => setState("streaming"), 2500);
        setTimeout(() => setState("complete"), 4000);
    };

    const reset = () => setState("idle");

    const isSelecting = state === "choosing";
    const hasSelected = state !== "idle" && state !== "choosing";
    const isStreaming = state === "streaming";

    return (
        <div className="w-full max-w-2xl space-y-4">
            {/* Controls */}
            <div className="flex gap-2">
                <button
                    onClick={runDemo}
                    disabled={state !== "idle"}
                    className="rounded-lg bg-primary/20 px-3 py-1.5 text-sm text-primary transition-colors hover:bg-primary/30 disabled:opacity-50"
                >
                    Run demo
                </button>
                <button
                    onClick={reset}
                    className="rounded-lg bg-foreground/10 px-3 py-1.5 text-sm text-foreground/70 transition-colors hover:bg-foreground/20"
                >
                    Reset
                </button>
            </div>

            {state !== "idle" && (
                <div className="space-y-3">
                    {/* CONCIERGE - Animated through states */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className={cn(
                            "overflow-hidden rounded-2xl border transition-colors duration-500",
                            isSelecting
                                ? "border-purple-400/40 bg-purple-500/10"
                                : "border-purple-500/20 bg-purple-500/5"
                        )}
                    >
                        <motion.div
                            className="flex items-center gap-3 px-4 py-3"
                            animate={
                                isSelecting
                                    ? {
                                          backgroundColor: [
                                              "rgba(168, 85, 247, 0.1)",
                                              "rgba(168, 85, 247, 0.15)",
                                              "rgba(168, 85, 247, 0.1)",
                                          ],
                                      }
                                    : {}
                            }
                            transition={
                                isSelecting ? { duration: 2, repeat: Infinity } : {}
                            }
                        >
                            {/* Breathing avatar */}
                            <motion.div
                                animate={
                                    isSelecting
                                        ? {
                                              scale: [1, 1.15, 1],
                                          }
                                        : { scale: 1 }
                                }
                                transition={
                                    isSelecting
                                        ? {
                                              duration: 2,
                                              repeat: Infinity,
                                              ease: "easeInOut",
                                          }
                                        : { duration: 0.3 }
                                }
                                className="relative"
                            >
                                <Image
                                    src="/logos/icon-transparent.png"
                                    alt="Carmenta"
                                    width={28}
                                    height={28}
                                />
                                {isSelecting && (
                                    <motion.div
                                        className="absolute inset-0 rounded-full bg-purple-400/40 blur-lg"
                                        animate={{
                                            scale: [1, 1.5, 1],
                                            opacity: [0.4, 0.7, 0.4],
                                        }}
                                        transition={{ duration: 2, repeat: Infinity }}
                                    />
                                )}
                            </motion.div>

                            {/* Text with transition */}
                            <div className="flex-1">
                                <AnimatePresence mode="wait">
                                    {isSelecting ? (
                                        <motion.div
                                            key="choosing"
                                            initial={{ opacity: 0, y: 5 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -5 }}
                                            className="flex items-center gap-2"
                                        >
                                            <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
                                                Finding the right approach...
                                            </span>
                                            <motion.div
                                                className="flex gap-1"
                                                animate={{ opacity: [0.5, 1, 0.5] }}
                                                transition={{
                                                    duration: 1.5,
                                                    repeat: Infinity,
                                                }}
                                            >
                                                <span className="h-1.5 w-1.5 rounded-full bg-purple-500" />
                                                <span className="h-1.5 w-1.5 rounded-full bg-purple-500" />
                                                <span className="h-1.5 w-1.5 rounded-full bg-purple-500" />
                                            </motion.div>
                                        </motion.div>
                                    ) : (
                                        <motion.div
                                            key="selected"
                                            initial={{ opacity: 0, y: 5 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="flex items-center gap-2"
                                        >
                                            <span className="text-sm font-medium text-foreground/80">
                                                Claude Sonnet
                                            </span>
                                            <motion.span
                                                initial={{ opacity: 0, scale: 0.8 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                transition={{ delay: 0.2 }}
                                                className="flex items-center gap-1 rounded-full bg-purple-500/20 px-2 py-0.5 text-xs text-purple-600 dark:text-purple-400"
                                            >
                                                <Brain className="h-3 w-3" />
                                                thoughtful
                                            </motion.span>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                                {hasSelected && (
                                    <motion.p
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ delay: 0.3 }}
                                        className="mt-0.5 text-xs text-foreground/50"
                                    >
                                        Best for analytical tasks requiring nuance
                                    </motion.p>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>

                    {/* LLM ZONE - Slides in after selection */}
                    <AnimatePresence>
                        {hasSelected && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.4, ease: "easeOut" }}
                                className="overflow-hidden rounded-2xl border border-foreground/10 bg-white/60 backdrop-blur-xl dark:bg-black/40"
                            >
                                {/* Reasoning */}
                                <div className="border-b border-foreground/10">
                                    <button
                                        onClick={() => setReasoningOpen(!reasoningOpen)}
                                        className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm transition-colors hover:bg-foreground/5"
                                    >
                                        <Brain className="h-4 w-4 text-blue-500/70" />
                                        <span className="text-foreground/70">
                                            Reasoning
                                        </span>
                                        <ChevronDown
                                            className={cn(
                                                "ml-auto h-4 w-4 text-foreground/40 transition-transform",
                                                reasoningOpen && "rotate-180"
                                            )}
                                        />
                                    </button>
                                    <AnimatePresence>
                                        {reasoningOpen && (
                                            <motion.div
                                                initial={{ height: 0 }}
                                                animate={{ height: "auto" }}
                                                exit={{ height: 0 }}
                                                className="overflow-hidden"
                                            >
                                                <div className="border-t border-foreground/5 bg-blue-500/[0.02] px-4 py-3 text-sm text-foreground/60">
                                                    {DEMO_REASONING}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>

                                {/* Tool */}
                                <div className="border-b border-foreground/10 px-4 py-2.5">
                                    <div className="flex items-center gap-2 text-sm">
                                        <Search className="h-4 w-4 text-amber-500/70" />
                                        <span className="text-foreground/70">
                                            Web Search
                                        </span>
                                        <span className="text-xs text-foreground/40">
                                            {DEMO_TOOLS[0].query}
                                        </span>
                                        <Check className="ml-auto h-4 w-4 text-green-500/70" />
                                    </div>
                                </div>

                                {/* Content */}
                                <div className="px-4 py-4">
                                    <div className="prose prose-sm dark:prose-invert">
                                        {isStreaming ? (
                                            <p>
                                                Here&apos;s what I found
                                                <motion.span
                                                    animate={{ opacity: [1, 0.3, 1] }}
                                                    transition={{
                                                        duration: 0.6,
                                                        repeat: Infinity,
                                                    }}
                                                >
                                                    █
                                                </motion.span>
                                            </p>
                                        ) : (
                                            <>
                                                <p>
                                                    Here&apos;s what I found about the
                                                    quarterly revenue trends:
                                                </p>
                                                <p>
                                                    <strong>Key Highlights:</strong>
                                                </p>
                                                <ul>
                                                    <li>
                                                        Q3 showed 23% growth over Q2
                                                    </li>
                                                    <li>
                                                        Primary driver was the
                                                        enterprise segment
                                                    </li>
                                                    <li>
                                                        APAC region outperformed
                                                        expectations
                                                    </li>
                                                </ul>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            )}

            {state === "idle" && (
                <div className="flex h-64 items-center justify-center rounded-2xl border border-dashed border-foreground/20 text-foreground/40">
                    Click &quot;Run demo&quot; to see the response flow
                </div>
            )}
        </div>
    );
}

// ============================================================================
// Option 3: Inline Concierge
// ============================================================================

function InlineConciergeDemo() {
    const [state, setState] = useState<
        "idle" | "choosing" | "selected" | "streaming" | "complete"
    >("idle");
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

    const toggleSection = (id: string) => {
        setExpandedSections((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const runDemo = () => {
        setState("choosing");
        setTimeout(() => setState("selected"), 1200);
        setTimeout(() => setState("streaming"), 1700);
        setTimeout(() => setState("complete"), 3200);
    };

    const reset = () => setState("idle");

    const isSelecting = state === "choosing";
    const hasSelected = state !== "idle" && state !== "choosing";
    const isStreaming = state === "streaming";

    return (
        <div className="w-full max-w-2xl space-y-4">
            {/* Controls */}
            <div className="flex gap-2">
                <button
                    onClick={runDemo}
                    disabled={state !== "idle"}
                    className="rounded-lg bg-primary/20 px-3 py-1.5 text-sm text-primary transition-colors hover:bg-primary/30 disabled:opacity-50"
                >
                    Run demo
                </button>
                <button
                    onClick={reset}
                    className="rounded-lg bg-foreground/10 px-3 py-1.5 text-sm text-foreground/70 transition-colors hover:bg-foreground/20"
                >
                    Reset
                </button>
            </div>

            {state !== "idle" && (
                <div>
                    {/* CONCIERGE - Transforms from pill to header */}
                    <motion.div
                        layout
                        className={cn(
                            "flex items-center gap-2 border border-purple-500/20 bg-purple-500/10 px-3 py-2 transition-colors",
                            isSelecting
                                ? "w-fit rounded-full"
                                : "w-full rounded-b-none rounded-t-2xl border-b-0"
                        )}
                    >
                        <motion.div layout className="relative h-5 w-5 shrink-0">
                            <Image
                                src="/logos/icon-transparent.png"
                                alt="Carmenta"
                                width={20}
                                height={20}
                            />
                            {isSelecting && (
                                <motion.div
                                    className="absolute inset-0 rounded-full bg-purple-400/50 blur-sm"
                                    animate={{
                                        scale: [1, 1.4, 1],
                                        opacity: [0.5, 0.8, 0.5],
                                    }}
                                    transition={{ duration: 1, repeat: Infinity }}
                                />
                            )}
                        </motion.div>

                        <AnimatePresence mode="wait">
                            {isSelecting ? (
                                <motion.span
                                    key="thinking"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="text-sm text-purple-700 dark:text-purple-300"
                                >
                                    Thinking...
                                </motion.span>
                            ) : (
                                <motion.div
                                    key="selected"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="flex items-center gap-2"
                                >
                                    <span className="text-sm font-medium text-foreground/80">
                                        Claude Sonnet
                                    </span>
                                    <span className="text-foreground/30">·</span>
                                    <span className="flex items-center gap-1 text-sm text-purple-600/80 dark:text-purple-400/80">
                                        <Brain className="h-3 w-3" />
                                        thoughtful
                                    </span>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>

                    {/* LLM ZONE - Connected to concierge */}
                    <AnimatePresence>
                        {hasSelected && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                className="overflow-hidden rounded-b-2xl border border-t-0 border-foreground/10 bg-white/60 backdrop-blur-xl dark:bg-black/40"
                            >
                                {/* Compact tool/reasoning indicators */}
                                <div className="flex gap-2 border-b border-foreground/10 px-3 py-2">
                                    <button
                                        onClick={() => toggleSection("reasoning")}
                                        className={cn(
                                            "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs transition-colors",
                                            expandedSections.has("reasoning")
                                                ? "bg-blue-500/20 text-blue-600"
                                                : "bg-foreground/5 text-foreground/60 hover:bg-foreground/10"
                                        )}
                                    >
                                        <Brain className="h-3 w-3" />
                                        Reasoning
                                    </button>
                                    <button
                                        onClick={() => toggleSection("tools")}
                                        className={cn(
                                            "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs transition-colors",
                                            expandedSections.has("tools")
                                                ? "bg-amber-500/20 text-amber-600"
                                                : "bg-foreground/5 text-foreground/60 hover:bg-foreground/10"
                                        )}
                                    >
                                        <Search className="h-3 w-3" />
                                        Search
                                        <Check className="h-3 w-3 text-green-500" />
                                    </button>
                                </div>

                                {/* Expanded sections */}
                                <AnimatePresence>
                                    {expandedSections.has("reasoning") && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: "auto", opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            className="overflow-hidden border-b border-foreground/10 bg-blue-500/[0.03]"
                                        >
                                            <div className="px-4 py-3 text-sm text-foreground/60">
                                                {DEMO_REASONING}
                                            </div>
                                        </motion.div>
                                    )}
                                    {expandedSections.has("tools") && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: "auto", opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            className="overflow-hidden border-b border-foreground/10 bg-amber-500/[0.03]"
                                        >
                                            <div className="px-4 py-3 text-sm text-foreground/60">
                                                <strong>Query:</strong>{" "}
                                                {DEMO_TOOLS[0].query}
                                                <br />
                                                Found 12 results about enterprise
                                                revenue trends...
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                {/* Content */}
                                <div className="px-4 py-4">
                                    <div className="prose prose-sm dark:prose-invert">
                                        {isStreaming ? (
                                            <p>
                                                Here&apos;s what I found about
                                                <motion.span
                                                    animate={{ opacity: [1, 0.3, 1] }}
                                                    transition={{
                                                        duration: 0.6,
                                                        repeat: Infinity,
                                                    }}
                                                >
                                                    █
                                                </motion.span>
                                            </p>
                                        ) : (
                                            <>
                                                <p>
                                                    Here&apos;s what I found about the
                                                    quarterly revenue trends:
                                                </p>
                                                <p>
                                                    <strong>Key Highlights:</strong>
                                                </p>
                                                <ul>
                                                    <li>
                                                        Q3 showed 23% growth over Q2
                                                    </li>
                                                    <li>
                                                        Primary driver was the
                                                        enterprise segment
                                                    </li>
                                                    <li>
                                                        APAC region outperformed
                                                        expectations
                                                    </li>
                                                </ul>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            )}

            {state === "idle" && (
                <div className="flex h-64 items-center justify-center rounded-2xl border border-dashed border-foreground/20 text-foreground/40">
                    Click &quot;Run demo&quot; to see the response flow
                </div>
            )}
        </div>
    );
}

// ============================================================================
// Page Export
// ============================================================================

function renderPreview(optionId: number) {
    switch (optionId) {
        case 1:
            return <SplitIdentityDemo />;
        case 2:
            return <ProgressiveRevealDemo />;
        case 3:
            return <InlineConciergeDemo />;
        default:
            return null;
    }
}

export default function ChatResponseAnatomyLab() {
    return (
        <DesignLabShell
            topic={TOPIC}
            iteration={ITERATION}
            options={OPTIONS}
            renderPreview={renderPreview}
        />
    );
}
