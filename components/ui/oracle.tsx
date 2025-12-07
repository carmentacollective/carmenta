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
    sm: {
        container: "h-10 w-10 sm:h-12 sm:w-12 md:h-14 md:w-14",
        imageMobile: 28,
        imageSm: 32,
        imageMd: 40,
        imageLg: 40,
        radius: 24,
    },
    md: {
        container: "h-16 w-16",
        imageMobile: 40,
        imageSm: 40,
        imageMd: 40,
        imageLg: 40,
        radius: 36,
    },
    lg: {
        container: "h-40 w-40 md:h-44 md:w-44",
        imageMobile: 100,
        imageSm: 100,
        imageMd: 100,
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
                    "glass-bg glass-shadow ring-1 ring-white/80 backdrop-blur-xl",
                    "dark:ring-white/15",
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
                            width={config.imageMobile}
                            height={config.imageMobile}
                            className="sm:hidden"
                            style={{
                                width: config.imageMobile,
                                height: config.imageMobile,
                            }}
                        />
                        <Image
                            src="/logos/icon-transparent.png"
                            alt="Carmenta"
                            width={config.imageSm}
                            height={config.imageSm}
                            className="hidden sm:block md:hidden"
                            style={{ width: config.imageSm, height: config.imageSm }}
                        />
                        <Image
                            src="/logos/icon-transparent.png"
                            alt="Carmenta"
                            width={config.imageMd}
                            height={config.imageMd}
                            className="hidden md:block"
                            style={{ width: config.imageMd, height: config.imageMd }}
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
 * Working Effect - Holographic spinner with Carmenta brand colors
 */
function WorkingEffect() {
    return (
        <div
            className="absolute -inset-2 animate-spin"
            style={{ animationDuration: "2s" }}
        >
            <div
                className="h-full w-full rounded-full p-[3px]"
                style={{
                    background:
                        "conic-gradient(from 0deg, #C4A3D4, #A3D4E8, #E8A3D4, #C4A3D4)",
                }}
            >
                <div className="h-full w-full rounded-full bg-background" />
            </div>
        </div>
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
