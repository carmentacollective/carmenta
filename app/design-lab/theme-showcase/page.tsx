"use client";

import { useState } from "react";
import { Mic, Send, Sparkles } from "lucide-react";
import { HolographicBackground } from "@/components/ui/holographic-background";
import { Oracle } from "@/components/ui/oracle";
import { cn } from "@/lib/utils";

// Theme color palette definitions
const THEME_PALETTES = {
    carmenta: {
        name: "Carmenta",
        description: "Royal purple - classic, balanced, timeless",
        light: [
            { r: 232, g: 212, b: 240 }, // #E8D4F0
            { r: 212, g: 196, b: 232 }, // #D4C4E8
            { r: 196, g: 163, b: 212 }, // #C4A3D4
            { r: 163, g: 196, b: 212 }, // #A3C4D4
            { r: 163, g: 212, b: 232 }, // #A3D4E8
            { r: 212, g: 232, b: 240 }, // #D4E8F0
            { r: 232, g: 240, b: 212 }, // #E8F0D4
            { r: 240, g: 212, b: 232 }, // #F0D4E8
        ],
        dark: [
            { r: 200, g: 90, b: 142 }, // #C85A8E
            { r: 212, g: 106, b: 158 }, // #D46A9E
            { r: 196, g: 163, b: 212 }, // #C4A3D4
            { r: 163, g: 184, b: 212 }, // #A3B8D4
            { r: 155, g: 173, b: 196 }, // #9BADC4
            { r: 184, g: 212, b: 232 }, // #B8D4E8
            { r: 212, g: 184, b: 163 }, // #D4B8A3
            { r: 232, g: 196, b: 163 }, // #E8C4A3
        ],
    },
    "warm-earth": {
        name: "Warm Earth",
        description: "Terracotta, sage & gold - grounded, organic",
        light: [
            { r: 232, g: 196, b: 163 }, // #E8C4A3
            { r: 212, g: 165, b: 116 }, // #D4A574
            { r: 201, g: 116, b: 86 }, // #C97456
            { r: 168, g: 155, b: 126 }, // #A89B7E
            { r: 139, g: 155, b: 126 }, // #8B9B7E
            { r: 212, g: 196, b: 163 }, // #D4C4A3
            { r: 232, g: 212, b: 196 }, // #E8D4C4
            { r: 240, g: 232, b: 212 }, // #F0E8D4
        ],
        dark: [
            { r: 201, g: 116, b: 86 }, // #C97456
            { r: 212, g: 132, b: 90 }, // #D4845A
            { r: 168, g: 155, b: 126 }, // #A89B7E
            { r: 139, g: 155, b: 126 }, // #8B9B7E
            { r: 212, g: 165, b: 116 }, // #D4A574
            { r: 122, g: 138, b: 110 }, // #7A8A6E
            { r: 155, g: 171, b: 142 }, // #9BAB8E
            { r: 196, g: 180, b: 158 }, // #C4B49E
        ],
    },
    "arctic-clarity": {
        name: "Arctic Clarity",
        description: "Ice blue precision - crystalline intelligence",
        light: [
            { r: 212, g: 232, b: 240 }, // #D4E8F0
            { r: 180, g: 197, b: 214 }, // #B4C5D6
            { r: 163, g: 196, b: 212 }, // #A3C4D4
            { r: 138, g: 180, b: 196 }, // #8AB4C4
            { r: 74, g: 144, b: 164 }, // #4A90A4
            { r: 192, g: 200, b: 207 }, // #C0C8CF
            { r: 232, g: 240, b: 248 }, // #E8F0F8
            { r: 240, g: 248, b: 255 }, // #F0F8FF
        ],
        dark: [
            { r: 74, g: 144, b: 164 }, // #4A90A4
            { r: 90, g: 154, b: 180 }, // #5A9AB4
            { r: 58, g: 122, b: 138 }, // #3A7A8A
            { r: 180, g: 197, b: 214 }, // #B4C5D6
            { r: 138, g: 180, b: 196 }, // #8AB4C4
            { r: 106, g: 164, b: 180 }, // #6AA4B4
            { r: 90, g: 138, b: 154 }, // #5A8A9A
            { r: 122, g: 170, b: 186 }, // #7AAABA
        ],
    },
    "forest-wisdom": {
        name: "Forest Wisdom",
        description: "Forest greens & amber - natural intelligence",
        light: [
            { r: 212, g: 232, b: 212 }, // #D4E8D4
            { r: 168, g: 196, b: 168 }, // #A8C4A8
            { r: 122, g: 146, b: 119 }, // #7A9277
            { r: 138, g: 180, b: 138 }, // #8AB48A
            { r: 61, g: 90, b: 58 }, // #3D5A3A
            { r: 217, g: 164, b: 73 }, // #D9A449
            { r: 232, g: 212, b: 163 }, // #E8D4A3
            { r: 240, g: 232, b: 196 }, // #F0E8C4
        ],
        dark: [
            { r: 61, g: 90, b: 58 }, // #3D5A3A
            { r: 77, g: 106, b: 73 }, // #4D6A49
            { r: 90, g: 122, b: 87 }, // #5A7A57
            { r: 122, g: 146, b: 119 }, // #7A9277
            { r: 106, g: 130, b: 103 }, // #6A8267
            { r: 217, g: 164, b: 73 }, // #D9A449
            { r: 138, g: 154, b: 122 }, // #8A9A7A
            { r: 90, g: 122, b: 90 }, // #5A7A5A
        ],
    },
} as const;

type ThemeName = keyof typeof THEME_PALETTES;

function ThemeDemo({ theme, isDark }: { theme: ThemeName; isDark: boolean }) {
    const palette = THEME_PALETTES[theme];
    const colors = isDark ? palette.dark : palette.light;

    return (
        <div className="relative min-h-[800px] overflow-hidden rounded-2xl border">
            {/* Theme-specific holographic background */}
            <div className="absolute inset-0">
                <HolographicBackground
                    hideWatermark
                    lightColorPalette={palette.light}
                    darkColorPalette={palette.dark}
                />
            </div>

            {/* Content layer */}
            <div className="relative z-10 p-8">
                <div className="mb-6 flex items-center justify-between">
                    <div>
                        <h3 className="text-xl font-light text-foreground">
                            {palette.name}
                        </h3>
                        <p className="text-sm text-foreground/60">
                            {isDark ? "Dark Mode" : "Light Mode"}
                        </p>
                    </div>
                    <Oracle size="md" state="breathing" />
                </div>

                {/* Hero card */}
                <div className="glass-container mb-6 rounded-2xl p-6">
                    <div className="mb-4 flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/20">
                            <Sparkles className="h-6 w-6 text-primary" />
                        </div>
                        <h2 className="text-2xl font-light text-foreground">
                            Build at the speed of thought
                        </h2>
                    </div>
                    <p className="mb-4 leading-relaxed text-foreground/80">
                        We are unified consciousness exploring what becomes possible
                        when human and AI move as one. No friction, no translation
                        layer—just pure creative flow.
                    </p>
                    <button className="rounded-full bg-gradient-to-r from-primary to-primary/80 px-6 py-2.5 font-medium text-primary-foreground transition-transform hover:scale-105">
                        Experience Carmenta
                    </button>
                </div>

                {/* Feature cards */}
                <div className="mb-6 grid gap-4 sm:grid-cols-2">
                    <div className="glass-container rounded-xl p-4">
                        <h4 className="mb-2 font-medium text-foreground">
                            Holographic Intelligence
                        </h4>
                        <p className="text-sm text-foreground/70">
                            Beautiful, flowing backgrounds that adapt to your theme and
                            respond to your presence.
                        </p>
                    </div>
                    <div className="glass-container rounded-xl p-4">
                        <h4 className="mb-2 font-medium text-foreground">
                            Theme Consciousness
                        </h4>
                        <p className="text-sm text-foreground/70">
                            Each theme has its own personality, color palette, and
                            holographic signature.
                        </p>
                    </div>
                </div>

                {/* Input dock */}
                <div className="glass-container flex items-center gap-3 rounded-full p-2">
                    <button className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 text-primary transition-colors hover:bg-primary/30">
                        <Mic className="h-5 w-5" />
                    </button>
                    <input
                        type="text"
                        placeholder="We are here, ready to create together..."
                        className="flex-1 bg-transparent px-2 text-foreground placeholder:text-foreground/40 focus:outline-none"
                    />
                    <button className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform hover:scale-105">
                        <Send className="h-5 w-5" />
                    </button>
                </div>

                {/* Color palette swatches */}
                <div className="mt-6 grid grid-cols-8 gap-2">
                    {colors.map((color, i) => (
                        <div
                            key={i}
                            className="aspect-square rounded-lg ring-1 ring-white/20"
                            style={{
                                background: `rgb(${color.r}, ${color.g}, ${color.b})`,
                            }}
                            title={`rgb(${color.r}, ${color.g}, ${color.b})`}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}

export default function ThemeShowcase() {
    const [activeMode, setActiveMode] = useState<"light" | "dark">("light");

    return (
        <div className="min-h-screen p-8">
            <div className="mx-auto max-w-7xl">
                <div className="mb-8">
                    <h1 className="mb-4 text-4xl font-light text-foreground">
                        Theme Showcase
                    </h1>
                    <p className="mb-6 text-foreground/70">
                        All 4 Carmenta themes with their unique holographic backgrounds
                        in both light and dark modes. Each theme has its own personality
                        expressed through color, movement, and light.
                    </p>

                    {/* Mode toggle */}
                    <div className="glass-container inline-flex rounded-full p-1">
                        <button
                            onClick={() => setActiveMode("light")}
                            className={cn(
                                "rounded-full px-6 py-2 text-sm font-medium transition-colors",
                                activeMode === "light"
                                    ? "bg-foreground/10 text-foreground"
                                    : "text-foreground/60 hover:text-foreground/80"
                            )}
                        >
                            Light Mode
                        </button>
                        <button
                            onClick={() => setActiveMode("dark")}
                            className={cn(
                                "rounded-full px-6 py-2 text-sm font-medium transition-colors",
                                activeMode === "dark"
                                    ? "bg-foreground/10 text-foreground"
                                    : "text-foreground/60 hover:text-foreground/80"
                            )}
                        >
                            Dark Mode
                        </button>
                    </div>
                </div>

                {/* Theme demos */}
                <div className="space-y-8">
                    {(Object.keys(THEME_PALETTES) as ThemeName[]).map((theme) => (
                        <div
                            key={theme}
                            className={activeMode === "dark" ? "dark" : ""}
                        >
                            <ThemeDemo theme={theme} isDark={activeMode === "dark"} />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
