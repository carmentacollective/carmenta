"use client";

import Image from "next/image";
import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * Oracle States
 */
export type OracleState = "idle" | "breathing" | "working" | "notification";
export type OracleSize = "sm" | "md" | "lg";

interface OracleProps {
    state?: OracleState;
    size?: OracleSize;
    href?: string;
    className?: string;
}

const sizeConfig = {
    sm: { container: "h-10 w-10 sm:h-12 sm:w-12", image: 28, imageLg: 32, radius: 24 },
    md: { container: "h-16 w-16", image: 40, imageLg: 40, radius: 36 },
    lg: {
        container: "h-40 w-40 md:h-44 md:w-44",
        image: 100,
        imageLg: 110,
        radius: 90,
    },
};

/**
 * Oracle - The visual embodiment of Carmenta
 */
export function Oracle({
    state = "breathing",
    size = "sm",
    href,
    className,
}: OracleProps) {
    const config = sizeConfig[size];

    const content = (
        <div className={cn("group relative", className)}>
            {/* State-specific animations */}
            {state === "breathing" && <BreathingEffect />}
            {state === "working" && <WorkingEffect />}
            {state === "notification" && <NotificationEffect />}

            {/* Logo container */}
            <div
                className={cn(
                    "oracle-container relative flex items-center justify-center rounded-full",
                    "bg-white/70 shadow-xl ring-1 ring-white/80 backdrop-blur-xl",
                    "transition-all duration-300",
                    "group-hover:-translate-y-0.5 group-hover:shadow-2xl group-hover:ring-primary/30",
                    config.container,
                    state === "breathing" && "oracle-breathing"
                )}
            >
                {size === "sm" ? (
                    <>
                        <Image
                            src="/logos/icon-transparent.png"
                            alt="Carmenta"
                            width={config.image}
                            height={config.image}
                            className="sm:hidden"
                            style={{ width: config.image, height: config.image }}
                        />
                        <Image
                            src="/logos/icon-transparent.png"
                            alt="Carmenta"
                            width={config.imageLg}
                            height={config.imageLg}
                            className="hidden sm:block"
                            style={{ width: config.imageLg, height: config.imageLg }}
                        />
                    </>
                ) : (
                    <Image
                        src="/logos/icon-transparent.png"
                        alt="Carmenta"
                        width={config.imageLg}
                        height={config.imageLg}
                        className="drop-shadow-lg transition-transform duration-500 group-hover:scale-105"
                    />
                )}
            </div>
        </div>
    );

    return href ? (
        <Link href={href} className="group">
            {content}
        </Link>
    ) : (
        content
    );
}

/**
 * Breathing Effect - Container "Slow" with subtle glow backdrop
 * The container itself scales (animation applied to container element)
 */
function BreathingEffect() {
    return (
        <div
            className="absolute inset-0 rounded-full"
            style={{
                background:
                    "radial-gradient(circle, rgba(200,180,220,0.35) 0%, transparent 70%)",
            }}
        />
    );
}

/**
 * Working Effect - Rainbow + Glow "Slow" (3s)
 */
function WorkingEffect() {
    return (
        <>
            <div className="oracle-working-glow absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(200,180,255,0.5)_0%,transparent_70%)]" />
            <div className="oracle-working-ring absolute -inset-1">
                <div className="h-full w-full rounded-full bg-[conic-gradient(from_0deg,#ff0000,#ff8000,#ffff00,#80ff00,#00ff00,#00ff80,#00ffff,#0080ff,#0000ff,#8000ff,#ff00ff,#ff0080,#ff0000)] p-1">
                    <div className="h-full w-full rounded-full bg-background" />
                </div>
            </div>
        </>
    );
}

/**
 * Notification Effect - semantic icons that communicate WHAT is happening
 * Default: 🧠 Thinking (will add prop later for different notifications)
 */
function NotificationEffect() {
    return (
        <>
            {/* Subtle glow background */}
            <div
                className="absolute inset-0 rounded-full"
                style={{
                    background:
                        "radial-gradient(circle, rgba(200,180,255,0.4) 0%, transparent 70%)",
                }}
            />
            {/* Icon badge */}
            <div
                className="absolute -right-1 -top-1 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-lg ring-2 ring-white"
                style={{ animation: "oracle-pop 0.4s ease-out" }}
            >
                <span className="text-lg">🧠</span>
            </div>
        </>
    );
}
