"use client";

import { useState, useRef, useCallback } from "react";
import { Sparkle } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { triggerHaptic } from "@/lib/hooks/use-haptic-feedback";
import { createRipple, getTapPosition } from "@/lib/hooks/use-tap-feedback";

export function ButtonStateDemo({ variant }: { variant: string }) {
    const [isActive, setIsActive] = useState(false);
    const buttonRef = useRef<HTMLButtonElement>(null);
    // Prevent double feedback from touch + mouse events
    const touchedRef = useRef(false);

    const handleTapStart = useCallback(
        (e: React.MouseEvent | React.TouchEvent) => {
            const element = buttonRef.current;
            if (!element || variant !== "click") return;

            // Trigger haptic feedback on iOS
            triggerHaptic();

            // Create visual ripple
            const { x, y } = getTapPosition(e, element);
            createRipple(element, x, y, {
                color: "hsl(var(--primary) / 0.3)",
                duration: 500,
            });
        },
        [variant]
    );

    const handleTouchStart = useCallback(
        (e: React.TouchEvent<HTMLButtonElement>) => {
            touchedRef.current = true;
            handleTapStart(e);
        },
        [handleTapStart]
    );

    const handleMouseDown = useCallback(
        (e: React.MouseEvent<HTMLButtonElement>) => {
            if (touchedRef.current) {
                touchedRef.current = false;
                return;
            }
            handleTapStart(e);
        },
        [handleTapStart]
    );

    const handleClick = () => {
        if (variant === "success" || variant === "error") {
            setIsActive(true);
            setTimeout(() => setIsActive(false), 1000);
        }
    };

    const isGlass = variant !== "loading";

    return (
        <div className="bg-foreground/5 flex min-h-[80px] items-center justify-center rounded-lg p-4">
            <button
                ref={buttonRef}
                onClick={handleClick}
                onMouseDown={handleMouseDown}
                onTouchStart={handleTouchStart}
                disabled={variant === "disabled"}
                className={cn(
                    "group relative flex h-12 w-12 items-center justify-center rounded-full transition-all",
                    isGlass
                        ? "bg-white/50 shadow-xl ring-1 ring-white/40 backdrop-blur-xl dark:bg-white/10 dark:ring-white/20"
                        : "bg-white/50 ring-1 ring-white/40 backdrop-blur-xl dark:bg-white/10 dark:ring-white/20",
                    // Click state uses tap-target for real tap feedback
                    variant === "click" && "tap-target",
                    variant === "hover" && "hover:scale-105 hover:shadow-2xl",
                    variant === "focus" &&
                        "focus:ring-primary/40 focus:ring-[3px] focus:outline-none",
                    variant === "disabled" &&
                        "pointer-events-none cursor-not-allowed opacity-50 grayscale",
                    variant === "loading" && "cursor-default"
                )}
            >
                {/* Loading spinner */}
                {variant === "loading" && (
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
                            <div className="bg-background h-full w-full rounded-full" />
                        </div>
                    </div>
                )}

                {/* Icon */}
                <Sparkle
                    className={cn(
                        "relative z-10 h-5 w-5 transition-colors",
                        variant === "hover"
                            ? "text-foreground/60 group-hover:text-foreground/90"
                            : variant === "success" && isActive
                              ? "text-green-600"
                              : variant === "error" && isActive
                                ? "text-red-600"
                                : variant === "disabled"
                                  ? "text-foreground/60"
                                  : "text-foreground/60"
                    )}
                />
            </button>
        </div>
    );
}
