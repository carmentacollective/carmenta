"use client";

import Image from "next/image";
import Link from "next/link";

import { cn } from "@/lib/utils";

export type OracleState = "idle" | "breathing" | "working";
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
        image: 40,
    },
    md: {
        container: "h-16 w-16",
        image: 40,
    },
    lg: {
        container: "h-40 w-40 md:h-44 md:w-44",
        image: 110,
    },
};

/**
 * Oracle - The visual embodiment of Carmenta
 *
 * A glass button that can breathe (subtle scale animation) or show working state.
 */
export function Oracle({
    state = "breathing",
    size = "sm",
    href,
    className,
}: OracleProps) {
    const config = sizeConfig[size];

    const content = (
        <div
            className={cn(
                // Glass appearance
                "flex items-center justify-center rounded-full",
                "glass-bg glass-shadow ring-foreground/20 ring-1 backdrop-blur-xl",
                "dark:ring-white/15",
                // Hover: shadow + ring only (no scale - let breathing handle transform)
                "transition-[box-shadow,ring-color] duration-300",
                "hover:ring-primary/40 hover:shadow-2xl hover:ring-[3px]",
                // Focus
                "focus:ring-primary/40 focus:shadow-2xl focus:ring-[3px] focus:outline-none",
                config.container,
                // Breathing animation
                state === "breathing" && "oracle-breathing",
                // View transition for persistent navigation element
                href && "vt-oracle-home",
                className
            )}
            data-tooltip-id={href ? "tip" : undefined}
            data-tooltip-content={href ? "Home" : undefined}
        >
            <Image
                src="/logos/icon-transparent.png"
                alt="Carmenta"
                width={config.image}
                height={config.image}
                className="pointer-events-none"
            />
        </div>
    );

    if (href) {
        return (
            <Link href={href} className="block">
                {content}
            </Link>
        );
    }

    return content;
}
