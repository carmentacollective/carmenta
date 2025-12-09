"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DesignLabShell, type DesignOption } from "@/components/design-lab";
import { cn } from "@/lib/utils";

const TOPIC = "Page Transitions";
const ITERATION = 0;

const OPTIONS: DesignOption[] = [
    {
        id: 1,
        name: "Soft Fade",
        rationale:
            "Classic opacity crossfade. Never jarring, universally comfortable. The safe choice that always feels right.",
        characteristics: {
            animationTiming: "200ms ease-out",
            interactionModel: "instant trigger",
            visualStyle: "subtle, invisible UX",
        },
        code: `// Soft Fade - Simple opacity transition
const variants = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
};

<motion.div
    variants={variants}
    initial="initial"
    animate="animate"
    exit="exit"
    transition={{ duration: 0.2, ease: "easeOut" }}
>
    {children}
</motion.div>`,
    },
    {
        id: 2,
        name: "Rise & Settle",
        rationale:
            "Content fades in while sliding up from below. Gentle upward energy suggests forward progress and arrival.",
        characteristics: {
            animationTiming: "300ms ease-out",
            interactionModel: "scroll-like motion",
            visualStyle: "gentle, optimistic",
        },
        code: `// Rise & Settle - Fade with upward slide
const variants = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -10 },
};

<motion.div
    variants={variants}
    initial="initial"
    animate="animate"
    exit="exit"
    transition={{ duration: 0.3, ease: "easeOut" }}
>
    {children}
</motion.div>`,
    },
    {
        id: 3,
        name: "Scale Bloom",
        rationale:
            "Page scales from 95% to 100% with fade. Feels like content is 'arriving' into focus. App-like, modern.",
        characteristics: {
            animationTiming: "250ms spring",
            interactionModel: "depth simulation",
            visualStyle: "modern, app-like",
        },
        code: `// Scale Bloom - Scale up with fade
const variants = {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 1.02 },
};

<motion.div
    variants={variants}
    initial="initial"
    animate="animate"
    exit="exit"
    transition={{
        duration: 0.25,
        ease: [0.16, 1, 0.3, 1], // Custom ease
    }}
>
    {children}
</motion.div>`,
    },
    {
        id: 4,
        name: "Blur Resolve",
        rationale:
            "Content starts blurred and sharpens as it fades in. Ethereal, dreamy feel. Matches the holographic aesthetic.",
        characteristics: {
            animationTiming: "400ms ease-out",
            interactionModel: "focus metaphor",
            visualStyle: "ethereal, glass-like",
        },
        code: `// Blur Resolve - Fade in with blur clearing
const variants = {
    initial: { opacity: 0, filter: "blur(8px)" },
    animate: { opacity: 1, filter: "blur(0px)" },
    exit: { opacity: 0, filter: "blur(4px)" },
};

<motion.div
    variants={variants}
    initial="initial"
    animate="animate"
    exit="exit"
    transition={{ duration: 0.4, ease: "easeOut" }}
>
    {children}
</motion.div>`,
    },
    {
        id: 5,
        name: "Slide Stack",
        rationale:
            "Pages slide horizontally based on navigation direction. Forward goes left, back goes right. Classic mobile/app pattern.",
        characteristics: {
            animationTiming: "300ms ease-in-out",
            interactionModel: "directional awareness",
            visualStyle: "native app feel",
        },
        code: `// Slide Stack - Horizontal slide based on direction
// Requires navigation direction context

const variants = {
    initial: (direction: number) => ({
        x: direction > 0 ? "100%" : "-100%",
        opacity: 0,
    }),
    animate: { x: 0, opacity: 1 },
    exit: (direction: number) => ({
        x: direction > 0 ? "-50%" : "50%",
        opacity: 0,
    }),
};

<motion.div
    custom={navigationDirection}
    variants={variants}
    initial="initial"
    animate="animate"
    exit="exit"
    transition={{ duration: 0.3, ease: "easeInOut" }}
>
    {children}
</motion.div>`,
    },
    {
        id: 6,
        name: "Spring Pop",
        rationale:
            "Framer-motion spring physics with slight overshoot. Playful, bouncy energy. Adds personality and delight.",
        characteristics: {
            animationTiming: "spring(1, 80, 10)",
            interactionModel: "physical simulation",
            visualStyle: "playful, energetic",
        },
        code: `// Spring Pop - Bouncy spring physics
const variants = {
    initial: { opacity: 0, y: 30, scale: 0.97 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: -15, scale: 0.98 },
};

<motion.div
    variants={variants}
    initial="initial"
    animate="animate"
    exit="exit"
    transition={{
        type: "spring",
        stiffness: 260,
        damping: 20,
    }}
>
    {children}
</motion.div>`,
    },
    {
        id: 7,
        name: "Stagger Cascade",
        rationale:
            "Header animates first, then content sections stagger in. Theatrical, draws attention to hierarchy. Premium feel.",
        characteristics: {
            animationTiming: "500ms total, 50ms stagger",
            interactionModel: "sequential reveal",
            visualStyle: "theatrical, premium",
        },
        code: `// Stagger Cascade - Sequential element reveal
const containerVariants = {
    initial: {},
    animate: {
        transition: {
            staggerChildren: 0.08,
            delayChildren: 0.1,
        },
    },
    exit: {
        transition: {
            staggerChildren: 0.05,
            staggerDirection: -1,
        },
    },
};

const itemVariants = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -10 },
};

<motion.div variants={containerVariants}>
    <motion.header variants={itemVariants}>...</motion.header>
    <motion.main variants={itemVariants}>...</motion.main>
    <motion.footer variants={itemVariants}>...</motion.footer>
</motion.div>`,
    },
    {
        id: 8,
        name: "Morph Crossfade",
        rationale:
            "Shared elements stay in place while content crossfades beneath. Sophisticated continuity between pages.",
        characteristics: {
            animationTiming: "350ms ease",
            interactionModel: "element persistence",
            visualStyle: "sophisticated, Apple-like",
        },
        code: `// Morph Crossfade - Shared layout animation
// Uses layoutId for persistent elements

<motion.header layoutId="site-header">
    <motion.div layoutId="logo">Logo</motion.div>
    <motion.div layoutId="user-button">User</motion.div>
</motion.header>

<AnimatePresence mode="wait">
    <motion.main
        key={pathname}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.35 }}
    >
        {children}
    </motion.main>
</AnimatePresence>`,
    },
];

// Mini page component for demos
function MiniPage({
    title,
    variant,
    isActive,
}: {
    title: string;
    variant: "home" | "about" | "contact";
    isActive: boolean;
}) {
    const colors = {
        home: "from-violet-500/20 to-cyan-500/20",
        about: "from-amber-500/20 to-rose-500/20",
        contact: "from-emerald-500/20 to-teal-500/20",
    };

    return (
        <div
            className={cn(
                "h-full w-full rounded-xl bg-gradient-to-br p-4",
                colors[variant],
                isActive ? "ring-2 ring-primary/40" : ""
            )}
        >
            <div className="mb-4 flex items-center justify-between">
                <div className="h-3 w-3 rounded-full bg-primary/40" />
                <div className="flex gap-1">
                    <div className="h-2 w-2 rounded-full bg-foreground/20" />
                    <div className="h-2 w-2 rounded-full bg-foreground/20" />
                    <div className="h-2 w-2 rounded-full bg-foreground/20" />
                </div>
            </div>
            <h3 className="mb-2 text-lg font-medium text-foreground/80">{title}</h3>
            <div className="space-y-2">
                <div className="h-2 w-3/4 rounded bg-foreground/10" />
                <div className="h-2 w-1/2 rounded bg-foreground/10" />
                <div className="h-2 w-2/3 rounded bg-foreground/10" />
            </div>
        </div>
    );
}

// Navigation tabs for demos
function NavTabs({
    current,
    onChange,
}: {
    current: string;
    onChange: (page: string) => void;
}) {
    const pages = ["Home", "About", "Contact"];
    return (
        <div className="mb-4 flex gap-2">
            {pages.map((page) => (
                <button
                    key={page}
                    onClick={() => onChange(page.toLowerCase())}
                    className={cn(
                        "rounded-lg px-3 py-1.5 text-sm transition-all",
                        current === page.toLowerCase()
                            ? "bg-primary/20 text-primary"
                            : "text-foreground/60 hover:bg-foreground/5 hover:text-foreground/80"
                    )}
                >
                    {page}
                </button>
            ))}
        </div>
    );
}

// Demo components for each transition type
function SoftFadeDemo() {
    const [currentPage, setCurrentPage] = useState("home");

    return (
        <div className="w-full max-w-md">
            <NavTabs current={currentPage} onChange={setCurrentPage} />
            <div className="h-64 overflow-hidden rounded-xl border border-foreground/10 bg-background/50">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentPage}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="h-full"
                    >
                        <MiniPage
                            title={
                                currentPage.charAt(0).toUpperCase() +
                                currentPage.slice(1)
                            }
                            variant={currentPage as "home" | "about" | "contact"}
                            isActive
                        />
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
}

function RiseSettleDemo() {
    const [currentPage, setCurrentPage] = useState("home");

    return (
        <div className="w-full max-w-md">
            <NavTabs current={currentPage} onChange={setCurrentPage} />
            <div className="h-64 overflow-hidden rounded-xl border border-foreground/10 bg-background/50">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentPage}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.3, ease: "easeOut" }}
                        className="h-full"
                    >
                        <MiniPage
                            title={
                                currentPage.charAt(0).toUpperCase() +
                                currentPage.slice(1)
                            }
                            variant={currentPage as "home" | "about" | "contact"}
                            isActive
                        />
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
}

function ScaleBloomDemo() {
    const [currentPage, setCurrentPage] = useState("home");

    return (
        <div className="w-full max-w-md">
            <NavTabs current={currentPage} onChange={setCurrentPage} />
            <div className="h-64 overflow-hidden rounded-xl border border-foreground/10 bg-background/50">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentPage}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 1.02 }}
                        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                        className="h-full"
                    >
                        <MiniPage
                            title={
                                currentPage.charAt(0).toUpperCase() +
                                currentPage.slice(1)
                            }
                            variant={currentPage as "home" | "about" | "contact"}
                            isActive
                        />
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
}

function BlurResolveDemo() {
    const [currentPage, setCurrentPage] = useState("home");

    return (
        <div className="w-full max-w-md">
            <NavTabs current={currentPage} onChange={setCurrentPage} />
            <div className="h-64 overflow-hidden rounded-xl border border-foreground/10 bg-background/50">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentPage}
                        initial={{ opacity: 0, filter: "blur(8px)" }}
                        animate={{ opacity: 1, filter: "blur(0px)" }}
                        exit={{ opacity: 0, filter: "blur(4px)" }}
                        transition={{ duration: 0.4, ease: "easeOut" }}
                        className="h-full"
                    >
                        <MiniPage
                            title={
                                currentPage.charAt(0).toUpperCase() +
                                currentPage.slice(1)
                            }
                            variant={currentPage as "home" | "about" | "contact"}
                            isActive
                        />
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
}

function SlideStackDemo() {
    const [currentPage, setCurrentPage] = useState("home");
    const [direction, setDirection] = useState(0);
    const pages = ["home", "about", "contact"];

    const handleChange = useCallback(
        (newPage: string) => {
            const currentIndex = pages.indexOf(currentPage);
            const newIndex = pages.indexOf(newPage);
            setDirection(newIndex > currentIndex ? 1 : -1);
            setCurrentPage(newPage);
        },
        [currentPage, pages]
    );

    return (
        <div className="w-full max-w-md">
            <NavTabs current={currentPage} onChange={handleChange} />
            <div className="h-64 overflow-hidden rounded-xl border border-foreground/10 bg-background/50">
                <AnimatePresence mode="wait" custom={direction}>
                    <motion.div
                        key={currentPage}
                        custom={direction}
                        variants={{
                            enter: (d: number) => ({
                                x: d > 0 ? "100%" : "-100%",
                                opacity: 0,
                            }),
                            center: { x: 0, opacity: 1 },
                            exit: (d: number) => ({
                                x: d > 0 ? "-50%" : "50%",
                                opacity: 0,
                            }),
                        }}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ duration: 0.3, ease: "easeInOut" }}
                        className="h-full"
                    >
                        <MiniPage
                            title={
                                currentPage.charAt(0).toUpperCase() +
                                currentPage.slice(1)
                            }
                            variant={currentPage as "home" | "about" | "contact"}
                            isActive
                        />
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
}

function SpringPopDemo() {
    const [currentPage, setCurrentPage] = useState("home");

    return (
        <div className="w-full max-w-md">
            <NavTabs current={currentPage} onChange={setCurrentPage} />
            <div className="h-64 overflow-hidden rounded-xl border border-foreground/10 bg-background/50">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentPage}
                        initial={{ opacity: 0, y: 30, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -15, scale: 0.98 }}
                        transition={{ type: "spring", stiffness: 260, damping: 20 }}
                        className="h-full"
                    >
                        <MiniPage
                            title={
                                currentPage.charAt(0).toUpperCase() +
                                currentPage.slice(1)
                            }
                            variant={currentPage as "home" | "about" | "contact"}
                            isActive
                        />
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
}

function StaggerCascadeDemo() {
    const [currentPage, setCurrentPage] = useState("home");

    const containerVariants = {
        initial: {},
        animate: {
            transition: { staggerChildren: 0.08, delayChildren: 0.1 },
        },
        exit: {
            transition: { staggerChildren: 0.05, staggerDirection: -1 },
        },
    };

    const itemVariants = {
        initial: { opacity: 0, y: 20 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -10 },
    };

    const colors = {
        home: "from-violet-500/20 to-cyan-500/20",
        about: "from-amber-500/20 to-rose-500/20",
        contact: "from-emerald-500/20 to-teal-500/20",
    };

    return (
        <div className="w-full max-w-md">
            <NavTabs current={currentPage} onChange={setCurrentPage} />
            <div className="h-64 overflow-hidden rounded-xl border border-foreground/10 bg-background/50">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentPage}
                        variants={containerVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        className={cn(
                            "flex h-full flex-col bg-gradient-to-br p-4",
                            colors[currentPage as keyof typeof colors]
                        )}
                    >
                        <motion.div
                            variants={itemVariants}
                            className="mb-4 flex items-center justify-between"
                        >
                            <div className="h-3 w-3 rounded-full bg-primary/40" />
                            <div className="flex gap-1">
                                <div className="h-2 w-2 rounded-full bg-foreground/20" />
                                <div className="h-2 w-2 rounded-full bg-foreground/20" />
                            </div>
                        </motion.div>
                        <motion.h3
                            variants={itemVariants}
                            className="mb-2 text-lg font-medium text-foreground/80"
                        >
                            {currentPage.charAt(0).toUpperCase() + currentPage.slice(1)}
                        </motion.h3>
                        <motion.div variants={itemVariants} className="space-y-2">
                            <div className="h-2 w-3/4 rounded bg-foreground/10" />
                            <div className="h-2 w-1/2 rounded bg-foreground/10" />
                        </motion.div>
                        <motion.div variants={itemVariants} className="mt-auto">
                            <div className="h-8 w-24 rounded-lg bg-primary/20" />
                        </motion.div>
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
}

function MorphCrossfadeDemo() {
    const [currentPage, setCurrentPage] = useState("home");

    const colors = {
        home: "from-violet-500/20 to-cyan-500/20",
        about: "from-amber-500/20 to-rose-500/20",
        contact: "from-emerald-500/20 to-teal-500/20",
    };

    return (
        <div className="w-full max-w-md">
            <NavTabs current={currentPage} onChange={setCurrentPage} />
            <div className="h-64 overflow-hidden rounded-xl border border-foreground/10 bg-background/50">
                {/* Persistent header with layoutId */}
                <motion.div
                    layoutId="demo-header"
                    className="flex items-center justify-between border-b border-foreground/10 bg-white/20 p-3 backdrop-blur-sm dark:bg-black/20"
                >
                    <motion.div
                        layoutId="demo-logo"
                        className="h-3 w-3 rounded-full bg-primary/60"
                    />
                    <motion.div
                        layoutId="demo-user"
                        className="h-5 w-5 rounded-full bg-foreground/20"
                    />
                </motion.div>

                {/* Crossfading content */}
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentPage}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.35 }}
                        className={cn(
                            "h-[calc(100%-52px)] bg-gradient-to-br p-4",
                            colors[currentPage as keyof typeof colors]
                        )}
                    >
                        <h3 className="mb-2 text-lg font-medium text-foreground/80">
                            {currentPage.charAt(0).toUpperCase() + currentPage.slice(1)}
                        </h3>
                        <div className="space-y-2">
                            <div className="h-2 w-3/4 rounded bg-foreground/10" />
                            <div className="h-2 w-1/2 rounded bg-foreground/10" />
                            <div className="h-2 w-2/3 rounded bg-foreground/10" />
                        </div>
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
}

function renderPreview(optionId: number) {
    switch (optionId) {
        case 1:
            return <SoftFadeDemo />;
        case 2:
            return <RiseSettleDemo />;
        case 3:
            return <ScaleBloomDemo />;
        case 4:
            return <BlurResolveDemo />;
        case 5:
            return <SlideStackDemo />;
        case 6:
            return <SpringPopDemo />;
        case 7:
            return <StaggerCascadeDemo />;
        case 8:
            return <MorphCrossfadeDemo />;
        default:
            return null;
    }
}

export default function PageTransitionsLab() {
    return (
        <DesignLabShell
            topic={TOPIC}
            iteration={ITERATION}
            options={OPTIONS}
            renderPreview={renderPreview}
        />
    );
}
