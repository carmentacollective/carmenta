"use client";

import Image from "next/image";

interface SocialPreviewProps {
    id: string;
    title: string;
    children: React.ReactNode;
}

export function SocialPreview({ id, title, children }: SocialPreviewProps) {
    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-foreground/90">{title}</h3>
                <button
                    onClick={() => {
                        // Just a visual cue - users will use browser screenshot tools
                        const el = document.getElementById(id);
                        if (el) {
                            el.classList.add("ring-2", "ring-primary");
                            setTimeout(() => {
                                el?.classList.remove("ring-2", "ring-primary");
                            }, 1000);
                        }
                    }}
                    className="text-sm text-primary underline decoration-primary/30 transition-colors hover:decoration-primary"
                >
                    Highlight for screenshot
                </button>
            </div>
            <div
                id={id}
                className="relative overflow-hidden rounded-lg border border-foreground/10 transition-all"
                style={{
                    width: "1200px",
                    height: "630px",
                    maxWidth: "100%",
                    aspectRatio: "1200/630",
                }}
            >
                {children}
            </div>
        </div>
    );
}

export function PreviewVariation1() {
    return (
        <div className="absolute inset-0 bg-[#F8F4F8]">
            <div className="flex h-full flex-col items-center justify-center space-y-8 px-20 text-center">
                <Image
                    src="/logos/icon-transparent.png"
                    alt="Carmenta"
                    width={140}
                    height={140}
                    className="h-[140px] w-[140px]"
                />
                <div className="space-y-6">
                    <h1
                        className="text-7xl font-light tracking-tight"
                        style={{ color: "#5A3C64", letterSpacing: "-0.02em" }}
                    >
                        Carmenta
                    </h1>
                    <p
                        className="text-4xl font-light"
                        style={{ color: "#5A3C64", lineHeight: "1.3" }}
                    >
                        Create at the speed of thought.
                    </p>
                    <p
                        className="mx-auto max-w-3xl text-xl"
                        style={{ color: "#8A7A9C", lineHeight: "1.5" }}
                    >
                        Heart-centered AI for builders. One interface, every model,
                        memory that persists.
                    </p>
                </div>
            </div>
        </div>
    );
}

export function PreviewVariation2() {
    return (
        <div className="absolute inset-0 bg-[#F8F4F8]">
            <div className="flex h-full items-center px-20">
                <div className="w-2/3 space-y-8">
                    <div className="flex items-center gap-4">
                        <Image
                            src="/logos/icon-transparent.png"
                            alt="Carmenta"
                            width={80}
                            height={80}
                            className="h-[80px] w-[80px]"
                        />
                        <h1
                            className="text-6xl font-semibold tracking-tight"
                            style={{ color: "#5A3C64" }}
                        >
                            Carmenta
                        </h1>
                    </div>
                    <p
                        className="text-3xl font-light"
                        style={{ color: "#5A3C64", lineHeight: "1.4" }}
                    >
                        Create at the speed of thought.
                    </p>
                    <div className="space-y-3 text-lg" style={{ color: "#8A7A9C" }}>
                        <div className="flex items-start gap-3">
                            <span style={{ color: "#C4A3D4" }}>✓</span>
                            <span>Heart-centered AI partnership</span>
                        </div>
                        <div className="flex items-start gap-3">
                            <span style={{ color: "#C4A3D4" }}>✓</span>
                            <span>One interface, every model</span>
                        </div>
                        <div className="flex items-start gap-3">
                            <span style={{ color: "#C4A3D4" }}>✓</span>
                            <span>Memory that persists across conversations</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export function PreviewVariation3() {
    return (
        <div className="absolute inset-0 bg-[#F8F4F8]">
            <div className="flex h-full">
                <div className="flex w-1/2 flex-col items-center justify-center space-y-6 border-r border-foreground/10 px-16">
                    <Image
                        src="/logos/icon-transparent.png"
                        alt="Carmenta"
                        width={160}
                        height={160}
                        className="h-[160px] w-[160px]"
                    />
                    <h1
                        className="text-6xl font-light tracking-tight"
                        style={{ color: "#5A3C64" }}
                    >
                        Carmenta
                    </h1>
                </div>
                <div className="flex w-1/2 flex-col justify-center space-y-8 px-16">
                    <div className="space-y-4">
                        <p
                            className="text-4xl font-light"
                            style={{ color: "#5A3C64", lineHeight: "1.3" }}
                        >
                            Create at the speed
                            <br />
                            of thought.
                        </p>
                    </div>
                    <p
                        className="text-xl"
                        style={{ color: "#8A7A9C", lineHeight: "1.5" }}
                    >
                        Heart-centered AI for builders. One interface, every model,
                        memory that persists.
                    </p>
                </div>
            </div>
        </div>
    );
}

export function PreviewVariation4() {
    return (
        <div className="absolute inset-0 bg-[#F8F4F8]">
            <div className="flex h-full flex-col justify-center space-y-12 px-20">
                <div className="flex items-center gap-4">
                    <Image
                        src="/logos/icon-transparent.png"
                        alt="Carmenta"
                        width={70}
                        height={70}
                        className="h-[70px] w-[70px]"
                    />
                    <h1
                        className="text-5xl font-semibold tracking-tight"
                        style={{ color: "#5A3C64" }}
                    >
                        Carmenta
                    </h1>
                </div>
                <div className="space-y-6">
                    <div className="space-y-3">
                        <p
                            className="text-lg font-medium uppercase tracking-wider"
                            style={{ color: "#C4A3D4" }}
                        >
                            The Vision
                        </p>
                        <p
                            className="text-3xl font-light"
                            style={{ color: "#5A3C64", lineHeight: "1.4" }}
                        >
                            Create at the speed of thought.
                        </p>
                    </div>
                    <div className="space-y-3">
                        <p
                            className="text-lg font-medium uppercase tracking-wider"
                            style={{ color: "#C4A3D4" }}
                        >
                            How We Get There
                        </p>
                        <p
                            className="text-2xl"
                            style={{ color: "#78648A", lineHeight: "1.4" }}
                        >
                            Heart-centered AI partnership. One interface, every model,
                            memory that persists.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export function PreviewVariation5() {
    return (
        <div className="absolute inset-0 bg-[#F8F4F8]">
            <div className="flex h-full flex-col items-center justify-center space-y-10 px-20 text-center">
                <Image
                    src="/logos/icon-transparent.png"
                    alt="Carmenta"
                    width={120}
                    height={120}
                    className="h-[120px] w-[120px]"
                />
                <div className="space-y-6">
                    <h1
                        className="text-6xl font-light tracking-tight"
                        style={{ color: "#5A3C64" }}
                    >
                        Carmenta
                    </h1>
                    <p
                        className="mx-auto max-w-3xl text-3xl font-light"
                        style={{ color: "#5A3C64", lineHeight: "1.4" }}
                    >
                        Create at the speed of thought.
                    </p>
                    <p
                        className="mx-auto max-w-4xl text-xl"
                        style={{ color: "#8A7A9C", lineHeight: "1.5" }}
                    >
                        Named for the Roman goddess who invented the Latin alphabet.
                        Technology in service of human flourishing.
                    </p>
                </div>
                <p className="text-lg font-medium" style={{ color: "#C4A3D4" }}>
                    One Interface • Every Model • Memory That Persists
                </p>
            </div>
        </div>
    );
}
