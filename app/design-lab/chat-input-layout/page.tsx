"use client";

import { useState } from "react";
import { DesignLabShell, type DesignOption } from "@/components/design-lab";
import { CornerDownLeft, Paperclip, Sparkles } from "lucide-react";

const TOPIC = "Chat Input Layout & Button Spacing";
const ITERATION = 3;

const OPTIONS: DesignOption[] = [
    {
        id: 1,
        name: "Right Slide Drawer",
        rationale:
            "Send button always visible on right. Attachment and model buttons slide in from the right edge on focus",
        characteristics: {
            interactionModel: "focus reveals slide drawer",
            sendButton: "always visible right corner",
            secondaryButtons: "slide from right edge",
        },
        code: `<div className="grid grid-cols-[1fr_auto] gap-0 focus-within:gap-3">
  <textarea />
  <div className="flex gap-2">
    <button /* secondary */ />
    <button /* send - always visible */ />
  </div>
</div>`,
    },
    {
        id: 2,
        name: "Left Border Mid-Point",
        rationale:
            "Attachment icon embedded halfway down the left border. Send always visible right, model selector slides in",
        characteristics: {
            interactionModel: "attachment on left border mid-point",
            sendButton: "always visible right",
            attachmentButton: "left border embedded at 50%",
        },
        code: `<div className="relative">
  <button className="absolute -left-5 top-1/2" />
  <textarea className="pl-8" />
  <button /* send always visible */ />
</div>`,
    },
    {
        id: 3,
        name: "Top Border Mid-Point",
        rationale:
            "Sparkle/model selector sits at top border center. Attachment and send on right, send always visible",
        characteristics: {
            interactionModel: "model selector on top border",
            sendButton: "always visible bottom right",
            modelButton: "top border center point",
        },
        code: `<div className="relative pt-4">
  <button className="absolute -top-4 left-1/2" />
  <textarea />
  <button /* send */ />
</div>`,
    },
    {
        id: 4,
        name: "Bottom Border Attachment",
        rationale:
            "Attachment button emerges from bottom border center on hover. Send always visible, model slides right",
        characteristics: {
            interactionModel: "attachment rises from bottom",
            sendButton: "always visible right",
            attachmentButton: "bottom border center, hover reveal",
        },
        code: `<div className="relative pb-4 group">
  <textarea />
  <button className="absolute -bottom-4 left-1/2 opacity-0 group-hover:opacity-100" />
</div>`,
    },
    {
        id: 5,
        name: "Dual Border Embed",
        rationale:
            "Attachment on left mid-border, model selector on right mid-border. Send button always visible bottom-right corner",
        characteristics: {
            interactionModel: "symmetric border embedding",
            sendButton: "always visible bottom right",
            secondaryButtons: "embedded left/right borders at 50%",
        },
        code: `<div className="relative">
  <button className="absolute -left-5 top-1/2" />
  <textarea />
  <button className="absolute -right-5 top-1/2" />
  <button /* send bottom right */ />
</div>`,
    },
    {
        id: 6,
        name: "Corner Constellation",
        rationale:
            "Send always visible bottom-right. Attachment top-left corner, model selector top-right, all border-embedded",
        characteristics: {
            interactionModel: "corner-anchored constellation",
            sendButton: "always visible bottom right",
            secondaryButtons: "top corners embedded in border",
        },
        code: `<div className="relative">
  <button className="absolute -left-4 -top-4" />
  <button className="absolute -right-4 -top-4" />
  <textarea />
  <button /* send bottom right */ />
</div>`,
    },
    {
        id: 7,
        name: "Right Cascade Reveal",
        rationale:
            "Send always visible. On focus, attachment slides in from right, then model selector cascades after it",
        characteristics: {
            interactionModel: "sequential cascade animation",
            sendButton: "always visible rightmost",
            secondaryButtons: "cascade slide-in with delay",
        },
        code: `<div className="flex gap-2">
  <textarea />
  <button className="focus-within:translate-x-0 transition-delay-100" />
  <button className="focus-within:translate-x-0 transition-delay-200" />
  <button /* send */ />
</div>`,
    },
    {
        id: 8,
        name: "Left Border Stacked",
        rationale:
            "Attachment and model selector stacked vertically on left border mid-point. Send always visible right",
        characteristics: {
            interactionModel: "vertical stack on left border",
            sendButton: "always visible right",
            secondaryButtons: "stacked vertically left border",
        },
        code: `<div className="relative">
  <div className="absolute -left-6 top-1/2 flex flex-col gap-1">
    <button />
    <button />
  </div>
  <textarea className="pl-10" />
  <button /* send */ />
</div>`,
    },
    {
        id: 9,
        name: "Halo Orbit Reveal",
        rationale:
            "Send always visible center-right. Secondary buttons orbit into position from behind the input on focus",
        characteristics: {
            interactionModel: "orbital slide-in animation",
            sendButton: "always visible center right",
            secondaryButtons: "orbit in from behind on focus",
        },
        code: `<div className="relative">
  <textarea />
  <button className="absolute" style="transform: focus ? orbit-path : behind" />
  <button /* send center right */ />
</div>`,
    },
    {
        id: 10,
        name: "Split with Border Anchors",
        rationale:
            "Input splits on focus. Send always visible. Attachment anchors to top-left split edge, model to bottom-right",
        characteristics: {
            interactionModel: "split reveal with edge anchors",
            sendButton: "always visible on main panel",
            secondaryButtons: "anchor to split edges",
        },
        code: `<div className="grid focus-within:gap-3">
  <button className="absolute top-0 left-0" />
  <textarea />
  <button className="absolute bottom-0 right-0" />
  <button /* send visible */ />
</div>`,
    },
    {
        id: 11,
        name: "Right Border Stacked",
        rationale:
            "Vertical stack on right border mid-point. Mirror of #8, send button anchored bottom-right inside input",
        characteristics: {
            interactionModel: "vertical stack on right border",
            sendButton: "always visible bottom right",
            secondaryButtons: "stacked vertically right border",
        },
        code: `<div className="relative">
  <div className="absolute -right-6 top-1/2 flex flex-col gap-1">
    <button />
    <button />
  </div>
  <textarea className="pr-10" />
  <button /* send bottom right */ />
</div>`,
    },
    {
        id: 12,
        name: "Bottom Border Horizontal Stack",
        rationale:
            "Horizontal stack centered at bottom border. Send always visible right, secondaries emerge from below",
        characteristics: {
            interactionModel: "horizontal stack bottom border",
            sendButton: "always visible right",
            secondaryButtons: "horizontal row bottom center",
        },
        code: `<div className="relative pb-6">
  <textarea />
  <div className="absolute -bottom-5 left-1/2 flex gap-1">
    <button />
    <button />
  </div>
  <button /* send */ />
</div>`,
    },
    {
        id: 13,
        name: "Top Border Horizontal Stack",
        rationale:
            "Horizontal stack centered at top border. Send always visible, secondaries float above like a toolbar",
        characteristics: {
            interactionModel: "horizontal toolbar top border",
            sendButton: "always visible right",
            secondaryButtons: "horizontal row top center",
        },
        code: `<div className="relative pt-6">
  <div className="absolute -top-5 left-1/2 flex gap-1">
    <button />
    <button />
  </div>
  <textarea />
  <button /* send */ />
</div>`,
    },
    {
        id: 14,
        name: "Diagonal Bottom-Left Stack",
        rationale:
            "Stack at bottom-left corner at 45° angle. Send top-right, creates diagonal visual balance",
        characteristics: {
            interactionModel: "diagonal corner stack",
            sendButton: "always visible top right",
            secondaryButtons: "diagonal stack bottom-left",
        },
        code: `<div className="relative">
  <div className="absolute -bottom-3 -left-3 flex flex-col gap-1 rotate-45">
    <button />
    <button />
  </div>
  <textarea />
  <button /* send top right */ />
</div>`,
    },
    {
        id: 15,
        name: "Floating Adaptive Stack",
        rationale:
            "Stack position adapts to input state: left when empty, bottom when typing. Send always visible right",
        characteristics: {
            interactionModel: "adaptive position based on content",
            sendButton: "always visible right",
            secondaryButtons: "floating stack that repositions",
        },
        code: `<div className="relative">
  <div className="absolute transition-all duration-500" style="left/bottom based on content">
    <button />
    <button />
  </div>
  <textarea />
  <button /* send */ />
</div>`,
    },
    {
        id: 16,
        name: "Large Buttons, Deep Overlap",
        rationale:
            "Variation of #12 with larger buttons (56px) and aggressive overlap. More prominent, tactile feeling",
        characteristics: {
            interactionModel: "bottom border horizontal, large buttons",
            buttonSize: "h-14 w-14 (56px)",
            overlap: "aggressive -24px margin",
        },
        code: `<div className="relative pb-6">
  <textarea />
  <div className="absolute bottom-0 left-1/2 translate-y-1/2">
    <button className="h-14 w-14" style="marginRight: -24px" />
    <button className="h-14 w-14" />
  </div>
  <button /* send */ />
</div>`,
    },
    {
        id: 17,
        name: "Minimal Clean Stack",
        rationale:
            "Simplified #12: clean white buttons, softer shadows, no gradients. Modern minimalist aesthetic",
        characteristics: {
            interactionModel: "bottom border horizontal, minimal",
            styling: "flat white, subtle shadows",
            aesthetic: "minimal, clean",
        },
        code: `<div className="relative pb-4">
  <textarea />
  <div className="absolute bottom-0 left-1/2 translate-y-1/2">
    <button className="bg-white shadow-sm" />
    <button className="bg-white shadow-sm" />
  </div>
  <button /* send */ />
</div>`,
    },
    {
        id: 18,
        name: "Triple Button Cascade",
        rationale:
            "Three buttons instead of two. Tighter spacing creates a unified tool cluster at bottom center",
        characteristics: {
            interactionModel: "bottom border horizontal, triple",
            buttonCount: "3 buttons",
            spacing: "tight -12px overlap",
        },
        code: `<div className="relative pb-4">
  <textarea />
  <div className="absolute bottom-0 left-1/2 translate-y-1/2">
    <button style="marginRight: -12px" />
    <button style="marginRight: -12px" />
    <button />
  </div>
  <button /* send */ />
</div>`,
    },
    {
        id: 19,
        name: "Asymmetric Left Offset",
        rationale:
            "Buttons offset to left-third instead of center. Creates visual balance with right-aligned send button",
        characteristics: {
            interactionModel: "bottom border, asymmetric placement",
            positioning: "left-1/3 instead of center",
            balance: "asymmetric composition",
        },
        code: `<div className="relative pb-4">
  <textarea />
  <div className="absolute bottom-0 left-1/3 translate-y-1/2">
    <button style="marginRight: -16px" />
    <button />
  </div>
  <button /* send right */ />
</div>`,
    },
    {
        id: 20,
        name: "Hierarchical Sizing",
        rationale:
            "Different button sizes create visual hierarchy. Primary button larger, secondary smaller",
        characteristics: {
            interactionModel: "bottom border, size hierarchy",
            primarySize: "h-14 w-14",
            secondarySize: "h-10 w-10",
        },
        code: `<div className="relative pb-4">
  <textarea />
  <div className="absolute bottom-0 left-1/2 translate-y-1/2">
    <button className="h-14 w-14" style="marginRight: -20px" />
    <button className="h-10 w-10" />
  </div>
  <button /* send */ />
</div>`,
    },
    {
        id: 21,
        name: "Vertical Border Stack",
        rationale:
            "Stack vertically at bottom center instead of horizontally. Compact footprint, different visual flow",
        characteristics: {
            interactionModel: "bottom border vertical stack",
            orientation: "vertical flex-col",
            spacing: "tight vertical gap",
        },
        code: `<div className="relative pb-8">
  <textarea />
  <div className="absolute bottom-0 left-1/2 flex flex-col translate-y-1/2">
    <button style="marginBottom: -8px" />
    <button />
  </div>
  <button /* send */ />
</div>`,
    },
    {
        id: 22,
        name: "Glowing Neon Style",
        rationale:
            "Vibrant neon styling with glowing effects. High-energy, cyberpunk aesthetic for the border buttons",
        characteristics: {
            interactionModel: "bottom border horizontal, neon",
            styling: "neon glow, vibrant colors",
            aesthetic: "high-energy, glowing",
        },
        code: `<div className="relative pb-4">
  <textarea />
  <div className="absolute bottom-0 left-1/2 translate-y-1/2">
    <button className="shadow-[0_0_20px_rgba(168,85,247,0.6)]" />
    <button className="shadow-[0_0_20px_rgba(34,211,238,0.6)]" />
  </div>
  <button /* send */ />
</div>`,
    },
    {
        id: 23,
        name: "Subtle Reveal on Hover",
        rationale:
            "Buttons start more hidden (smaller, more transparent), fully emerge on container hover",
        characteristics: {
            interactionModel: "bottom border, hover reveal",
            defaultState: "scale-75 opacity-60",
            hoverState: "scale-100 opacity-100",
        },
        code: `<div className="relative pb-4 group">
  <textarea />
  <div className="absolute bottom-0 left-1/2 translate-y-1/2 scale-75 opacity-60 group-hover:scale-100 group-hover:opacity-100">
    <button style="marginRight: -16px" />
    <button />
  </div>
  <button /* send */ />
</div>`,
    },
];

function RightSlideDrawerDemo() {
    const [value, setValue] = useState("");
    const [isFocused, setIsFocused] = useState(false);

    return (
        <div className="w-full">
            <div
                className="glass-input-dock grid transition-all duration-300"
                style={{
                    gridTemplateColumns: "1fr auto",
                    gap: isFocused ? "12px" : "0px",
                }}
            >
                <textarea
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    placeholder="Message Carmenta..."
                    className="max-h-32 min-h-[3.5rem] resize-none border-none bg-transparent px-6 py-4 text-base text-foreground/95 outline-none placeholder:text-foreground/40"
                    rows={1}
                />
                <div
                    className="flex items-center gap-2 overflow-hidden pr-2 transition-all duration-300"
                    style={{
                        width: isFocused ? "160px" : "56px",
                    }}
                >
                    <button
                        type="button"
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/60 text-foreground/70 shadow-lg transition-all hover:scale-110"
                        style={{
                            opacity: isFocused ? 1 : 0,
                            transform: isFocused ? "translateX(0)" : "translateX(20px)",
                        }}
                    >
                        <Paperclip className="h-4 w-4" />
                    </button>
                    <button
                        type="button"
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/60 text-foreground/70 shadow-lg transition-all hover:scale-110"
                        style={{
                            opacity: isFocused ? 1 : 0,
                            transform: isFocused ? "translateX(0)" : "translateX(20px)",
                        }}
                    >
                        <Sparkles className="h-4 w-4" />
                    </button>
                    <button
                        type="button"
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 via-cyan-500 to-pink-500 text-white shadow-xl transition-all hover:scale-110"
                    >
                        <CornerDownLeft className="h-4 w-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}

function LeftBorderMidPointDemo() {
    const [value, setValue] = useState("");
    const [isFocused, setIsFocused] = useState(false);

    return (
        <div className="relative w-full">
            <button
                type="button"
                className="absolute -left-5 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/70 text-foreground/70 shadow-xl ring-2 ring-white/60 backdrop-blur-xl transition-all hover:scale-110"
            >
                <Paperclip className="h-4 w-4" />
            </button>
            <div className="glass-input-dock flex items-center gap-2 pl-10">
                <textarea
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    placeholder="Message Carmenta..."
                    className="max-h-32 min-h-[3.5rem] flex-1 resize-none border-none bg-transparent py-4 pr-2 text-base text-foreground/95 outline-none placeholder:text-foreground/40"
                    rows={1}
                />
                <div
                    className="flex items-center gap-2 overflow-hidden pr-2 transition-all duration-300"
                    style={{ width: isFocused ? "108px" : "56px" }}
                >
                    <button
                        type="button"
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/60 text-foreground/70 shadow-lg transition-all hover:scale-110"
                        style={{
                            opacity: isFocused ? 1 : 0,
                            transform: isFocused ? "translateX(0)" : "translateX(20px)",
                        }}
                    >
                        <Sparkles className="h-4 w-4" />
                    </button>
                    <button
                        type="button"
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 via-cyan-500 to-pink-500 text-white shadow-xl transition-all hover:scale-110"
                    >
                        <CornerDownLeft className="h-4 w-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}

function TopBorderMidPointDemo() {
    const [value, setValue] = useState("");
    const [isFocused, setIsFocused] = useState(false);

    return (
        <div className="relative w-full pt-6">
            <button
                type="button"
                className="absolute left-1/2 top-0 z-10 flex h-11 w-11 -translate-x-1/2 items-center justify-center rounded-full bg-white/70 text-foreground/70 shadow-xl ring-2 ring-white/60 backdrop-blur-xl transition-all hover:scale-110"
            >
                <Sparkles className="h-4 w-4" />
            </button>
            <div className="glass-input-dock flex items-center gap-2">
                <textarea
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    placeholder="Message Carmenta..."
                    className="max-h-32 min-h-[3.5rem] flex-1 resize-none border-none bg-transparent px-6 py-4 pr-2 text-base text-foreground/95 outline-none placeholder:text-foreground/40"
                    rows={1}
                />
                <div
                    className="flex items-center gap-2 overflow-hidden pr-2 transition-all duration-300"
                    style={{ width: isFocused ? "108px" : "56px" }}
                >
                    <button
                        type="button"
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/60 text-foreground/70 shadow-lg transition-all hover:scale-110"
                        style={{
                            opacity: isFocused ? 1 : 0,
                            transform: isFocused ? "translateX(0)" : "translateX(20px)",
                        }}
                    >
                        <Paperclip className="h-4 w-4" />
                    </button>
                    <button
                        type="button"
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 via-cyan-500 to-pink-500 text-white shadow-xl transition-all hover:scale-110"
                    >
                        <CornerDownLeft className="h-4 w-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}

function BottomBorderAttachmentDemo() {
    const [value, setValue] = useState("");
    const [isHovered, setIsHovered] = useState(false);
    const [isFocused, setIsFocused] = useState(false);

    return (
        <div
            className="group relative w-full pb-6"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <div className="glass-input-dock flex items-center gap-2">
                <textarea
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    placeholder="Message Carmenta..."
                    className="max-h-32 min-h-[3.5rem] flex-1 resize-none border-none bg-transparent px-6 py-4 pr-2 text-base text-foreground/95 outline-none placeholder:text-foreground/40"
                    rows={1}
                />
                <div
                    className="flex items-center gap-2 overflow-hidden pr-2 transition-all duration-300"
                    style={{ width: isFocused ? "108px" : "56px" }}
                >
                    <button
                        type="button"
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/60 text-foreground/70 shadow-lg transition-all hover:scale-110"
                        style={{
                            opacity: isFocused ? 1 : 0,
                            transform: isFocused ? "translateX(0)" : "translateX(20px)",
                        }}
                    >
                        <Sparkles className="h-4 w-4" />
                    </button>
                    <button
                        type="button"
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 via-cyan-500 to-pink-500 text-white shadow-xl transition-all hover:scale-110"
                    >
                        <CornerDownLeft className="h-4 w-4" />
                    </button>
                </div>
            </div>
            <button
                type="button"
                className="absolute bottom-0 left-1/2 z-10 flex h-11 w-11 -translate-x-1/2 items-center justify-center rounded-full bg-white/70 text-foreground/70 shadow-xl ring-2 ring-white/60 backdrop-blur-xl transition-all hover:scale-110"
                style={{
                    opacity: isHovered ? 1 : 0,
                    transform: `translateX(-50%) ${isHovered ? "translateY(0)" : "translateY(-10px)"}`,
                }}
            >
                <Paperclip className="h-4 w-4" />
            </button>
        </div>
    );
}

function DualBorderEmbedDemo() {
    const [value, setValue] = useState("");

    return (
        <div className="relative w-full">
            <button
                type="button"
                className="absolute -left-5 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/70 text-foreground/70 shadow-xl ring-2 ring-white/60 backdrop-blur-xl transition-all hover:scale-110"
            >
                <Paperclip className="h-4 w-4" />
            </button>
            <button
                type="button"
                className="absolute -right-5 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/70 text-foreground/70 shadow-xl ring-2 ring-white/60 backdrop-blur-xl transition-all hover:scale-110"
            >
                <Sparkles className="h-4 w-4" />
            </button>
            <div className="glass-input-dock relative flex items-center px-12">
                <textarea
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder="Message Carmenta..."
                    className="max-h-32 min-h-[3.5rem] flex-1 resize-none border-none bg-transparent py-4 pr-16 text-base text-foreground/95 outline-none placeholder:text-foreground/40"
                    rows={1}
                />
                <button
                    type="button"
                    className="absolute bottom-3 right-3 flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 via-cyan-500 to-pink-500 text-white shadow-xl transition-all hover:scale-110"
                >
                    <CornerDownLeft className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
}

function CornerConstellationDemo() {
    const [value, setValue] = useState("");

    return (
        <div className="relative w-full pt-6">
            <button
                type="button"
                className="absolute -left-4 top-0 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/70 text-foreground/70 shadow-xl ring-2 ring-white/60 backdrop-blur-xl transition-all hover:scale-110"
            >
                <Paperclip className="h-4 w-4" />
            </button>
            <button
                type="button"
                className="absolute -right-4 top-0 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/70 text-foreground/70 shadow-xl ring-2 ring-white/60 backdrop-blur-xl transition-all hover:scale-110"
            >
                <Sparkles className="h-4 w-4" />
            </button>
            <div className="glass-input-dock relative">
                <textarea
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder="Message Carmenta..."
                    className="max-h-32 min-h-[3.5rem] w-full resize-none border-none bg-transparent px-6 py-4 pr-16 text-base text-foreground/95 outline-none placeholder:text-foreground/40"
                    rows={1}
                />
                <button
                    type="button"
                    className="absolute bottom-3 right-3 flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 via-cyan-500 to-pink-500 text-white shadow-xl transition-all hover:scale-110"
                >
                    <CornerDownLeft className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
}

function RightCascadeRevealDemo() {
    const [value, setValue] = useState("");
    const [isFocused, setIsFocused] = useState(false);

    return (
        <div className="glass-input-dock flex w-full items-center gap-2">
            <textarea
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                placeholder="Message Carmenta..."
                className="max-h-32 min-h-[3.5rem] flex-1 resize-none border-none bg-transparent px-6 py-4 pr-2 text-base text-foreground/95 outline-none placeholder:text-foreground/40"
                rows={1}
            />
            <div className="flex items-center gap-2 pr-2">
                <button
                    type="button"
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/60 text-foreground/70 shadow-lg transition-all duration-300 hover:scale-110"
                    style={{
                        opacity: isFocused ? 1 : 0,
                        transform: isFocused ? "translateX(0)" : "translateX(60px)",
                        transitionDelay: isFocused ? "100ms" : "0ms",
                    }}
                >
                    <Paperclip className="h-4 w-4" />
                </button>
                <button
                    type="button"
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/60 text-foreground/70 shadow-lg transition-all duration-300 hover:scale-110"
                    style={{
                        opacity: isFocused ? 1 : 0,
                        transform: isFocused ? "translateX(0)" : "translateX(60px)",
                        transitionDelay: isFocused ? "200ms" : "0ms",
                    }}
                >
                    <Sparkles className="h-4 w-4" />
                </button>
                <button
                    type="button"
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 via-cyan-500 to-pink-500 text-white shadow-xl transition-all hover:scale-110"
                >
                    <CornerDownLeft className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
}

function LeftBorderStackedDemo() {
    const [value, setValue] = useState("");

    return (
        <div className="relative w-full">
            <div className="absolute -left-6 top-1/2 z-10 flex -translate-y-1/2 flex-col gap-2">
                <button
                    type="button"
                    className="flex h-11 w-11 items-center justify-center rounded-full bg-white/70 text-foreground/70 shadow-xl ring-2 ring-white/60 backdrop-blur-xl transition-all hover:scale-110"
                >
                    <Paperclip className="h-4 w-4" />
                </button>
                <button
                    type="button"
                    className="flex h-11 w-11 items-center justify-center rounded-full bg-white/70 text-foreground/70 shadow-xl ring-2 ring-white/60 backdrop-blur-xl transition-all hover:scale-110"
                >
                    <Sparkles className="h-4 w-4" />
                </button>
            </div>
            <div className="glass-input-dock flex items-center gap-2 pl-12">
                <textarea
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder="Message Carmenta..."
                    className="max-h-32 min-h-[3.5rem] flex-1 resize-none border-none bg-transparent py-4 pr-2 text-base text-foreground/95 outline-none placeholder:text-foreground/40"
                    rows={1}
                />
                <button
                    type="button"
                    className="mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 via-cyan-500 to-pink-500 text-white shadow-xl transition-all hover:scale-110"
                >
                    <CornerDownLeft className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
}

function HaloOrbitRevealDemo() {
    const [value, setValue] = useState("");
    const [isFocused, setIsFocused] = useState(false);

    return (
        <div className="relative w-full">
            <div className="glass-input-dock flex items-center gap-2">
                <textarea
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    placeholder="Message Carmenta..."
                    className="max-h-32 min-h-[3.5rem] flex-1 resize-none border-none bg-transparent px-6 py-4 pr-2 text-base text-foreground/95 outline-none placeholder:text-foreground/40"
                    rows={1}
                />
                <button
                    type="button"
                    className="mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 via-cyan-500 to-pink-500 text-white shadow-xl transition-all hover:scale-110"
                >
                    <CornerDownLeft className="h-4 w-4" />
                </button>
            </div>
            <button
                type="button"
                className="absolute right-16 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/70 text-foreground/70 shadow-xl ring-2 ring-white/60 backdrop-blur-xl transition-all duration-500 hover:scale-110"
                style={{
                    opacity: isFocused ? 1 : 0,
                    transform: isFocused
                        ? "translateY(-50%) rotate(0deg) translateX(0)"
                        : "translateY(-50%) rotate(-90deg) translateX(-40px)",
                }}
            >
                <Paperclip className="h-4 w-4" />
            </button>
            <button
                type="button"
                className="absolute right-16 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/70 text-foreground/70 shadow-xl ring-2 ring-white/60 backdrop-blur-xl transition-all duration-500 hover:scale-110"
                style={{
                    opacity: isFocused ? 1 : 0,
                    transform: isFocused
                        ? "translateY(-50%) rotate(0deg) translateY(50px)"
                        : "translateY(-50%) rotate(-90deg) translateY(0px)",
                    transitionDelay: isFocused ? "100ms" : "0ms",
                }}
            >
                <Sparkles className="h-4 w-4" />
            </button>
        </div>
    );
}

function SplitWithBorderAnchorsDemo() {
    const [value, setValue] = useState("");
    const [isFocused, setIsFocused] = useState(false);

    return (
        <div className="relative w-full pt-6">
            <div
                className="grid transition-all duration-500"
                style={{
                    gridTemplateColumns: isFocused ? "1fr 160px" : "1fr 56px",
                    gap: isFocused ? "12px" : "0px",
                }}
            >
                <div className="glass-input-dock relative overflow-hidden">
                    <button
                        type="button"
                        className="absolute -left-4 -top-6 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/70 text-foreground/70 shadow-xl ring-2 ring-white/60 backdrop-blur-xl transition-all duration-500 hover:scale-110"
                        style={{
                            opacity: isFocused ? 1 : 0,
                            transform: isFocused ? "scale(1)" : "scale(0.5)",
                        }}
                    >
                        <Paperclip className="h-4 w-4" />
                    </button>
                    <textarea
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        onFocus={() => setIsFocused(true)}
                        onBlur={() => setIsFocused(false)}
                        placeholder="Message Carmenta..."
                        className="max-h-32 min-h-[3.5rem] w-full resize-none border-none bg-transparent px-6 py-4 text-base text-foreground/95 outline-none placeholder:text-foreground/40"
                        rows={1}
                    />
                </div>
                <div className="glass-input-dock relative flex items-center justify-center overflow-hidden px-2">
                    <button
                        type="button"
                        className="absolute -bottom-3 -right-4 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/70 text-foreground/70 shadow-xl ring-2 ring-white/60 backdrop-blur-xl transition-all duration-500 hover:scale-110"
                        style={{
                            opacity: isFocused ? 1 : 0,
                            transform: isFocused ? "scale(1)" : "scale(0.5)",
                        }}
                    >
                        <Sparkles className="h-4 w-4" />
                    </button>
                    <button
                        type="button"
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 via-cyan-500 to-pink-500 text-white shadow-xl transition-all hover:scale-110"
                    >
                        <CornerDownLeft className="h-4 w-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}

function RightBorderStackedDemo() {
    const [value, setValue] = useState("");

    return (
        <div className="relative w-full">
            <div className="absolute -right-6 top-1/2 z-10 flex -translate-y-1/2 flex-col gap-2">
                <button
                    type="button"
                    className="flex h-11 w-11 items-center justify-center rounded-full bg-white/70 text-foreground/70 shadow-xl ring-2 ring-white/60 backdrop-blur-xl transition-all hover:scale-110"
                >
                    <Paperclip className="h-4 w-4" />
                </button>
                <button
                    type="button"
                    className="flex h-11 w-11 items-center justify-center rounded-full bg-white/70 text-foreground/70 shadow-xl ring-2 ring-white/60 backdrop-blur-xl transition-all hover:scale-110"
                >
                    <Sparkles className="h-4 w-4" />
                </button>
            </div>
            <div className="glass-input-dock relative pr-12">
                <textarea
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder="Message Carmenta..."
                    className="max-h-32 min-h-[3.5rem] w-full resize-none border-none bg-transparent px-6 py-4 pr-16 text-base text-foreground/95 outline-none placeholder:text-foreground/40"
                    rows={1}
                />
                <button
                    type="button"
                    className="absolute bottom-3 right-3 flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 via-cyan-500 to-pink-500 text-white shadow-xl transition-all hover:scale-110"
                >
                    <CornerDownLeft className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
}

function BottomBorderHorizontalStackDemo() {
    const [value, setValue] = useState("");

    return (
        <div className="relative w-full pb-4">
            <div className="glass-input-dock relative flex items-center gap-2 pb-8">
                <textarea
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder="Message Carmenta..."
                    className="max-h-32 min-h-[3.5rem] flex-1 resize-none border-none bg-transparent px-6 py-4 pr-2 text-base text-foreground/95 outline-none placeholder:text-foreground/40"
                    rows={1}
                />
                <button
                    type="button"
                    className="mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 via-cyan-500 to-pink-500 text-white shadow-xl transition-all hover:scale-110"
                >
                    <CornerDownLeft className="h-4 w-4" />
                </button>
                {/* Overlapping buttons - half in, half out */}
                <div className="absolute bottom-0 left-1/2 z-10 flex -translate-x-1/2 translate-y-1/2">
                    <button
                        type="button"
                        className="relative z-20 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-b from-white/90 to-white/70 text-foreground/80 shadow-[0_4px_12px_rgba(0,0,0,0.15),0_1px_3px_rgba(0,0,0,0.1)] ring-[1.5px] ring-white/80 backdrop-blur-xl transition-all hover:scale-110 hover:shadow-[0_6px_16px_rgba(0,0,0,0.2),0_2px_4px_rgba(0,0,0,0.12)] active:scale-95"
                        style={{ marginRight: "-16px" }}
                    >
                        <Paperclip className="h-5 w-5" />
                    </button>
                    <button
                        type="button"
                        className="relative z-10 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-b from-white/90 to-white/70 text-foreground/80 shadow-[0_4px_12px_rgba(0,0,0,0.15),0_1px_3px_rgba(0,0,0,0.1)] ring-[1.5px] ring-white/80 backdrop-blur-xl transition-all hover:z-30 hover:scale-110 hover:shadow-[0_6px_16px_rgba(0,0,0,0.2),0_2px_4px_rgba(0,0,0,0.12)] active:scale-95"
                    >
                        <Sparkles className="h-5 w-5" />
                    </button>
                </div>
            </div>
        </div>
    );
}

function TopBorderHorizontalStackDemo() {
    const [value, setValue] = useState("");

    return (
        <div className="relative w-full pt-6">
            <div className="absolute -top-5 left-1/2 z-10 flex -translate-x-1/2 gap-2">
                <button
                    type="button"
                    className="flex h-11 w-11 items-center justify-center rounded-full bg-white/70 text-foreground/70 shadow-xl ring-2 ring-white/60 backdrop-blur-xl transition-all hover:scale-110"
                >
                    <Paperclip className="h-4 w-4" />
                </button>
                <button
                    type="button"
                    className="flex h-11 w-11 items-center justify-center rounded-full bg-white/70 text-foreground/70 shadow-xl ring-2 ring-white/60 backdrop-blur-xl transition-all hover:scale-110"
                >
                    <Sparkles className="h-4 w-4" />
                </button>
            </div>
            <div className="glass-input-dock flex items-center gap-2">
                <textarea
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder="Message Carmenta..."
                    className="max-h-32 min-h-[3.5rem] flex-1 resize-none border-none bg-transparent px-6 py-4 pr-2 text-base text-foreground/95 outline-none placeholder:text-foreground/40"
                    rows={1}
                />
                <button
                    type="button"
                    className="mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 via-cyan-500 to-pink-500 text-white shadow-xl transition-all hover:scale-110"
                >
                    <CornerDownLeft className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
}

function DiagonalBottomLeftStackDemo() {
    const [value, setValue] = useState("");

    return (
        <div className="relative w-full pb-8 pl-8">
            <div className="absolute -bottom-4 -left-4 z-10 flex origin-bottom-left rotate-45 flex-col gap-2">
                <button
                    type="button"
                    className="flex h-11 w-11 items-center justify-center rounded-full bg-white/70 text-foreground/70 shadow-xl ring-2 ring-white/60 backdrop-blur-xl transition-all hover:scale-110"
                >
                    <Paperclip className="h-4 w-4 -rotate-45" />
                </button>
                <button
                    type="button"
                    className="flex h-11 w-11 items-center justify-center rounded-full bg-white/70 text-foreground/70 shadow-xl ring-2 ring-white/60 backdrop-blur-xl transition-all hover:scale-110"
                >
                    <Sparkles className="h-4 w-4 -rotate-45" />
                </button>
            </div>
            <div className="glass-input-dock relative">
                <textarea
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder="Message Carmenta..."
                    className="max-h-32 min-h-[3.5rem] w-full resize-none border-none bg-transparent px-6 py-4 pr-16 text-base text-foreground/95 outline-none placeholder:text-foreground/40"
                    rows={1}
                />
                <button
                    type="button"
                    className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 via-cyan-500 to-pink-500 text-white shadow-xl transition-all hover:scale-110"
                >
                    <CornerDownLeft className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
}

function FloatingAdaptiveStackDemo() {
    const [value, setValue] = useState("");
    const hasContent = value.length > 0;

    return (
        <div className="relative w-full">
            <div
                className="absolute z-10 flex gap-2 transition-all duration-500"
                style={{
                    left: hasContent ? "auto" : "-24px",
                    right: hasContent ? "auto" : "auto",
                    bottom: hasContent ? "-24px" : "auto",
                    top: hasContent ? "auto" : "50%",
                    transform: hasContent ? "translateX(-50%)" : "translateY(-50%)",
                    left: hasContent ? "50%" : "-24px",
                }}
            >
                <button
                    type="button"
                    className="flex h-11 w-11 items-center justify-center rounded-full bg-white/70 text-foreground/70 shadow-xl ring-2 ring-white/60 backdrop-blur-xl transition-all hover:scale-110"
                >
                    <Paperclip className="h-4 w-4" />
                </button>
                <button
                    type="button"
                    className="flex h-11 w-11 items-center justify-center rounded-full bg-white/70 text-foreground/70 shadow-xl ring-2 ring-white/60 backdrop-blur-xl transition-all hover:scale-110"
                >
                    <Sparkles className="h-4 w-4" />
                </button>
            </div>
            <div
                className="glass-input-dock relative"
                style={{
                    marginBottom: hasContent ? "32px" : "0",
                    paddingLeft: hasContent ? "24px" : "64px",
                }}
            >
                <textarea
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder="Message Carmenta..."
                    className="max-h-32 min-h-[3.5rem] w-full resize-none border-none bg-transparent px-6 py-4 pr-16 text-base text-foreground/95 outline-none placeholder:text-foreground/40"
                    rows={1}
                />
                <button
                    type="button"
                    className="absolute bottom-3 right-3 flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 via-cyan-500 to-pink-500 text-white shadow-xl transition-all hover:scale-110"
                >
                    <CornerDownLeft className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
}

function LargeButtonsDeepOverlapDemo() {
    const [value, setValue] = useState("");

    return (
        <div className="relative w-full pb-6">
            <div className="glass-input-dock relative flex items-center gap-2 pb-10">
                <textarea
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder="Message Carmenta..."
                    className="max-h-32 min-h-[3.5rem] flex-1 resize-none border-none bg-transparent px-6 py-4 pr-2 text-base text-foreground/95 outline-none placeholder:text-foreground/40"
                    rows={1}
                />
                <button
                    type="button"
                    className="mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 via-cyan-500 to-pink-500 text-white shadow-xl transition-all hover:scale-110"
                >
                    <CornerDownLeft className="h-4 w-4" />
                </button>
                <div className="absolute bottom-0 left-1/2 z-10 flex -translate-x-1/2 translate-y-1/2">
                    <button
                        type="button"
                        className="relative z-20 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-b from-white/90 to-white/70 text-foreground/80 shadow-[0_6px_16px_rgba(0,0,0,0.2),0_2px_6px_rgba(0,0,0,0.15)] ring-2 ring-white/90 backdrop-blur-xl transition-all hover:scale-110 hover:shadow-[0_8px_20px_rgba(0,0,0,0.25),0_3px_8px_rgba(0,0,0,0.18)] active:scale-95"
                        style={{ marginRight: "-24px" }}
                    >
                        <Paperclip className="h-6 w-6" />
                    </button>
                    <button
                        type="button"
                        className="relative z-10 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-b from-white/90 to-white/70 text-foreground/80 shadow-[0_6px_16px_rgba(0,0,0,0.2),0_2px_6px_rgba(0,0,0,0.15)] ring-2 ring-white/90 backdrop-blur-xl transition-all hover:z-30 hover:scale-110 hover:shadow-[0_8px_20px_rgba(0,0,0,0.25),0_3px_8px_rgba(0,0,0,0.18)] active:scale-95"
                    >
                        <Sparkles className="h-6 w-6" />
                    </button>
                </div>
            </div>
        </div>
    );
}

function MinimalCleanStackDemo() {
    const [value, setValue] = useState("");

    return (
        <div className="relative w-full pb-4">
            <div className="glass-input-dock relative flex items-center gap-2 pb-8">
                <textarea
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder="Message Carmenta..."
                    className="max-h-32 min-h-[3.5rem] flex-1 resize-none border-none bg-transparent px-6 py-4 pr-2 text-base text-foreground/95 outline-none placeholder:text-foreground/40"
                    rows={1}
                />
                <button
                    type="button"
                    className="mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 via-cyan-500 to-pink-500 text-white shadow-xl transition-all hover:scale-110"
                >
                    <CornerDownLeft className="h-4 w-4" />
                </button>
                <div className="absolute bottom-0 left-1/2 z-10 flex -translate-x-1/2 translate-y-1/2">
                    <button
                        type="button"
                        className="relative z-20 flex h-12 w-12 items-center justify-center rounded-full bg-white text-foreground/70 shadow-sm ring-1 ring-black/5 transition-all hover:scale-110 hover:shadow-md active:scale-95"
                        style={{ marginRight: "-16px" }}
                    >
                        <Paperclip className="h-5 w-5" />
                    </button>
                    <button
                        type="button"
                        className="relative z-10 flex h-12 w-12 items-center justify-center rounded-full bg-white text-foreground/70 shadow-sm ring-1 ring-black/5 transition-all hover:z-30 hover:scale-110 hover:shadow-md active:scale-95"
                    >
                        <Sparkles className="h-5 w-5" />
                    </button>
                </div>
            </div>
        </div>
    );
}

function TripleButtonCascadeDemo() {
    const [value, setValue] = useState("");

    return (
        <div className="relative w-full pb-4">
            <div className="glass-input-dock relative flex items-center gap-2 pb-8">
                <textarea
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder="Message Carmenta..."
                    className="max-h-32 min-h-[3.5rem] flex-1 resize-none border-none bg-transparent px-6 py-4 pr-2 text-base text-foreground/95 outline-none placeholder:text-foreground/40"
                    rows={1}
                />
                <button
                    type="button"
                    className="mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 via-cyan-500 to-pink-500 text-white shadow-xl transition-all hover:scale-110"
                >
                    <CornerDownLeft className="h-4 w-4" />
                </button>
                <div className="absolute bottom-0 left-1/2 z-10 flex -translate-x-1/2 translate-y-1/2">
                    <button
                        type="button"
                        className="relative z-30 flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-b from-white/90 to-white/70 text-foreground/80 shadow-[0_4px_12px_rgba(0,0,0,0.15),0_1px_3px_rgba(0,0,0,0.1)] ring-[1.5px] ring-white/80 backdrop-blur-xl transition-all hover:scale-110 hover:shadow-[0_6px_16px_rgba(0,0,0,0.2),0_2px_4px_rgba(0,0,0,0.12)] active:scale-95"
                        style={{ marginRight: "-12px" }}
                    >
                        <Paperclip className="h-4 w-4" />
                    </button>
                    <button
                        type="button"
                        className="relative z-20 flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-b from-white/90 to-white/70 text-foreground/80 shadow-[0_4px_12px_rgba(0,0,0,0.15),0_1px_3px_rgba(0,0,0,0.1)] ring-[1.5px] ring-white/80 backdrop-blur-xl transition-all hover:z-40 hover:scale-110 hover:shadow-[0_6px_16px_rgba(0,0,0,0.2),0_2px_4px_rgba(0,0,0,0.12)] active:scale-95"
                        style={{ marginRight: "-12px" }}
                    >
                        <Sparkles className="h-4 w-4" />
                    </button>
                    <button
                        type="button"
                        className="relative z-10 flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-b from-white/90 to-white/70 text-foreground/80 shadow-[0_4px_12px_rgba(0,0,0,0.15),0_1px_3px_rgba(0,0,0,0.1)] ring-[1.5px] ring-white/80 backdrop-blur-xl transition-all hover:z-40 hover:scale-110 hover:shadow-[0_6px_16px_rgba(0,0,0,0.2),0_2px_4px_rgba(0,0,0,0.12)] active:scale-95"
                    >
                        <CornerDownLeft className="h-4 w-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}

function AsymmetricLeftOffsetDemo() {
    const [value, setValue] = useState("");

    return (
        <div className="relative w-full pb-4">
            <div className="glass-input-dock relative flex items-center gap-2 pb-8">
                <textarea
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder="Message Carmenta..."
                    className="max-h-32 min-h-[3.5rem] flex-1 resize-none border-none bg-transparent px-6 py-4 pr-2 text-base text-foreground/95 outline-none placeholder:text-foreground/40"
                    rows={1}
                />
                <button
                    type="button"
                    className="mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 via-cyan-500 to-pink-500 text-white shadow-xl transition-all hover:scale-110"
                >
                    <CornerDownLeft className="h-4 w-4" />
                </button>
                <div className="absolute bottom-0 left-1/3 z-10 flex translate-y-1/2">
                    <button
                        type="button"
                        className="relative z-20 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-b from-white/90 to-white/70 text-foreground/80 shadow-[0_4px_12px_rgba(0,0,0,0.15),0_1px_3px_rgba(0,0,0,0.1)] ring-[1.5px] ring-white/80 backdrop-blur-xl transition-all hover:scale-110 hover:shadow-[0_6px_16px_rgba(0,0,0,0.2),0_2px_4px_rgba(0,0,0,0.12)] active:scale-95"
                        style={{ marginRight: "-16px" }}
                    >
                        <Paperclip className="h-5 w-5" />
                    </button>
                    <button
                        type="button"
                        className="relative z-10 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-b from-white/90 to-white/70 text-foreground/80 shadow-[0_4px_12px_rgba(0,0,0,0.15),0_1px_3px_rgba(0,0,0,0.1)] ring-[1.5px] ring-white/80 backdrop-blur-xl transition-all hover:z-30 hover:scale-110 hover:shadow-[0_6px_16px_rgba(0,0,0,0.2),0_2px_4px_rgba(0,0,0,0.12)] active:scale-95"
                    >
                        <Sparkles className="h-5 w-5" />
                    </button>
                </div>
            </div>
        </div>
    );
}

function HierarchicalSizingDemo() {
    const [value, setValue] = useState("");

    return (
        <div className="relative w-full pb-6">
            <div className="glass-input-dock relative flex items-center gap-2 pb-10">
                <textarea
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder="Message Carmenta..."
                    className="max-h-32 min-h-[3.5rem] flex-1 resize-none border-none bg-transparent px-6 py-4 pr-2 text-base text-foreground/95 outline-none placeholder:text-foreground/40"
                    rows={1}
                />
                <button
                    type="button"
                    className="mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 via-cyan-500 to-pink-500 text-white shadow-xl transition-all hover:scale-110"
                >
                    <CornerDownLeft className="h-4 w-4" />
                </button>
                <div className="absolute bottom-0 left-1/2 z-10 flex -translate-x-1/2 translate-y-1/2 items-center">
                    <button
                        type="button"
                        className="relative z-20 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-b from-white/90 to-white/70 text-foreground/80 shadow-[0_5px_14px_rgba(0,0,0,0.18),0_2px_5px_rgba(0,0,0,0.12)] ring-2 ring-white/85 backdrop-blur-xl transition-all hover:scale-110 hover:shadow-[0_7px_18px_rgba(0,0,0,0.22),0_3px_6px_rgba(0,0,0,0.14)] active:scale-95"
                        style={{ marginRight: "-20px" }}
                    >
                        <Paperclip className="h-5 w-5" />
                    </button>
                    <button
                        type="button"
                        className="relative z-10 flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-b from-white/85 to-white/65 text-foreground/70 shadow-[0_3px_10px_rgba(0,0,0,0.12),0_1px_3px_rgba(0,0,0,0.08)] ring-[1.5px] ring-white/75 backdrop-blur-xl transition-all hover:z-30 hover:scale-110 hover:shadow-[0_5px_14px_rgba(0,0,0,0.16),0_2px_4px_rgba(0,0,0,0.1)] active:scale-95"
                    >
                        <Sparkles className="h-4 w-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}

function VerticalBorderStackDemo() {
    const [value, setValue] = useState("");

    return (
        <div className="relative w-full pb-10">
            <div className="glass-input-dock relative flex items-center gap-2 pb-12">
                <textarea
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder="Message Carmenta..."
                    className="max-h-32 min-h-[3.5rem] flex-1 resize-none border-none bg-transparent px-6 py-4 pr-2 text-base text-foreground/95 outline-none placeholder:text-foreground/40"
                    rows={1}
                />
                <button
                    type="button"
                    className="mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 via-cyan-500 to-pink-500 text-white shadow-xl transition-all hover:scale-110"
                >
                    <CornerDownLeft className="h-4 w-4" />
                </button>
                <div className="absolute bottom-0 left-1/2 z-10 flex -translate-x-1/2 translate-y-1/2 flex-col">
                    <button
                        type="button"
                        className="relative z-20 flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-b from-white/90 to-white/70 text-foreground/80 shadow-[0_4px_12px_rgba(0,0,0,0.15),0_1px_3px_rgba(0,0,0,0.1)] ring-[1.5px] ring-white/80 backdrop-blur-xl transition-all hover:scale-110 hover:shadow-[0_6px_16px_rgba(0,0,0,0.2),0_2px_4px_rgba(0,0,0,0.12)] active:scale-95"
                        style={{ marginBottom: "-8px" }}
                    >
                        <Paperclip className="h-4 w-4" />
                    </button>
                    <button
                        type="button"
                        className="relative z-10 flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-b from-white/90 to-white/70 text-foreground/80 shadow-[0_4px_12px_rgba(0,0,0,0.15),0_1px_3px_rgba(0,0,0,0.1)] ring-[1.5px] ring-white/80 backdrop-blur-xl transition-all hover:z-30 hover:scale-110 hover:shadow-[0_6px_16px_rgba(0,0,0,0.2),0_2px_4px_rgba(0,0,0,0.12)] active:scale-95"
                    >
                        <Sparkles className="h-4 w-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}

function GlowingNeonStyleDemo() {
    const [value, setValue] = useState("");

    return (
        <div className="relative w-full pb-4">
            <div className="glass-input-dock relative flex items-center gap-2 pb-8">
                <textarea
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder="Message Carmenta..."
                    className="max-h-32 min-h-[3.5rem] flex-1 resize-none border-none bg-transparent px-6 py-4 pr-2 text-base text-foreground/95 outline-none placeholder:text-foreground/40"
                    rows={1}
                />
                <button
                    type="button"
                    className="mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 via-cyan-500 to-pink-500 text-white shadow-xl transition-all hover:scale-110"
                >
                    <CornerDownLeft className="h-4 w-4" />
                </button>
                <div className="absolute bottom-0 left-1/2 z-10 flex -translate-x-1/2 translate-y-1/2">
                    <button
                        type="button"
                        className="relative z-20 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-purple-600 text-white shadow-[0_0_25px_rgba(168,85,247,0.7),0_4px_12px_rgba(168,85,247,0.4)] ring-2 ring-purple-400/50 backdrop-blur-xl transition-all hover:scale-110 hover:shadow-[0_0_35px_rgba(168,85,247,0.9),0_6px_16px_rgba(168,85,247,0.5)] active:scale-95"
                        style={{ marginRight: "-16px" }}
                    >
                        <Paperclip className="h-5 w-5" />
                    </button>
                    <button
                        type="button"
                        className="relative z-10 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-cyan-500 text-white shadow-[0_0_25px_rgba(34,211,238,0.7),0_4px_12px_rgba(34,211,238,0.4)] ring-2 ring-cyan-300/50 backdrop-blur-xl transition-all hover:z-30 hover:scale-110 hover:shadow-[0_0_35px_rgba(34,211,238,0.9),0_6px_16px_rgba(34,211,238,0.5)] active:scale-95"
                    >
                        <Sparkles className="h-5 w-5" />
                    </button>
                </div>
            </div>
        </div>
    );
}

function SubtleRevealOnHoverDemo() {
    const [value, setValue] = useState("");
    const [isHovered, setIsHovered] = useState(false);

    return (
        <div
            className="relative w-full pb-4"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <div className="glass-input-dock relative flex items-center gap-2 pb-8">
                <textarea
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder="Message Carmenta..."
                    className="max-h-32 min-h-[3.5rem] flex-1 resize-none border-none bg-transparent px-6 py-4 pr-2 text-base text-foreground/95 outline-none placeholder:text-foreground/40"
                    rows={1}
                />
                <button
                    type="button"
                    className="mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 via-cyan-500 to-pink-500 text-white shadow-xl transition-all hover:scale-110"
                >
                    <CornerDownLeft className="h-4 w-4" />
                </button>
                <div
                    className="absolute bottom-0 left-1/2 z-10 flex -translate-x-1/2 translate-y-1/2 transition-all duration-300"
                    style={{
                        opacity: isHovered ? 1 : 0.6,
                        transform: `translateX(-50%) translateY(50%) scale(${isHovered ? 1 : 0.75})`,
                    }}
                >
                    <button
                        type="button"
                        className="relative z-20 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-b from-white/90 to-white/70 text-foreground/80 shadow-[0_4px_12px_rgba(0,0,0,0.15),0_1px_3px_rgba(0,0,0,0.1)] ring-[1.5px] ring-white/80 backdrop-blur-xl transition-all hover:scale-110 hover:shadow-[0_6px_16px_rgba(0,0,0,0.2),0_2px_4px_rgba(0,0,0,0.12)] active:scale-95"
                        style={{ marginRight: "-16px" }}
                    >
                        <Paperclip className="h-5 w-5" />
                    </button>
                    <button
                        type="button"
                        className="relative z-10 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-b from-white/90 to-white/70 text-foreground/80 shadow-[0_4px_12px_rgba(0,0,0,0.15),0_1px_3px_rgba(0,0,0,0.1)] ring-[1.5px] ring-white/80 backdrop-blur-xl transition-all hover:z-30 hover:scale-110 hover:shadow-[0_6px_16px_rgba(0,0,0,0.2),0_2px_4px_rgba(0,0,0,0.12)] active:scale-95"
                    >
                        <Sparkles className="h-5 w-5" />
                    </button>
                </div>
            </div>
        </div>
    );
}

function renderPreview(optionId: number) {
    switch (optionId) {
        case 1:
            return <RightSlideDrawerDemo />;
        case 2:
            return <LeftBorderMidPointDemo />;
        case 3:
            return <TopBorderMidPointDemo />;
        case 4:
            return <BottomBorderAttachmentDemo />;
        case 5:
            return <DualBorderEmbedDemo />;
        case 6:
            return <CornerConstellationDemo />;
        case 7:
            return <RightCascadeRevealDemo />;
        case 8:
            return <LeftBorderStackedDemo />;
        case 9:
            return <HaloOrbitRevealDemo />;
        case 10:
            return <SplitWithBorderAnchorsDemo />;
        case 11:
            return <RightBorderStackedDemo />;
        case 12:
            return <BottomBorderHorizontalStackDemo />;
        case 13:
            return <TopBorderHorizontalStackDemo />;
        case 14:
            return <DiagonalBottomLeftStackDemo />;
        case 15:
            return <FloatingAdaptiveStackDemo />;
        case 16:
            return <LargeButtonsDeepOverlapDemo />;
        case 17:
            return <MinimalCleanStackDemo />;
        case 18:
            return <TripleButtonCascadeDemo />;
        case 19:
            return <AsymmetricLeftOffsetDemo />;
        case 20:
            return <HierarchicalSizingDemo />;
        case 21:
            return <VerticalBorderStackDemo />;
        case 22:
            return <GlowingNeonStyleDemo />;
        case 23:
            return <SubtleRevealOnHoverDemo />;
        default:
            return null;
    }
}

export default function ChatInputLayoutLab() {
    return (
        <DesignLabShell
            topic={TOPIC}
            iteration={ITERATION}
            options={OPTIONS}
            renderPreview={renderPreview}
        />
    );
}
