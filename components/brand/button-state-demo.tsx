"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export function ButtonStateDemo({ variant }: { variant: string }) {
    const [isActive, setIsActive] = useState(false);
    const [showRipple, setShowRipple] = useState(false);

    const handleClick = () => {
        if (variant === "click") {
            setShowRipple(true);
            setTimeout(() => setShowRipple(false), 600);
        } else if (variant === "success" || variant === "error") {
            setIsActive(true);
            setTimeout(() => setIsActive(false), 1000);
        }
    };

    const isGlass = variant !== "loading";

    return (
        <div className="bg-foreground/5 flex min-h-[80px] items-center justify-center rounded-lg p-4">
            <button
                onClick={handleClick}
                disabled={variant === "disabled"}
                className={cn(
                    "group relative flex h-12 w-12 items-center justify-center rounded-full transition-all",
                    isGlass
                        ? "bg-white/50 shadow-xl ring-1 ring-white/40 backdrop-blur-xl dark:bg-white/10 dark:ring-white/20"
                        : "bg-white/50 ring-1 ring-white/40 backdrop-blur-xl dark:bg-white/10 dark:ring-white/20",
                    variant === "click" && "active:translate-y-0.5 active:shadow-sm",
                    variant === "hover" && "hover:scale-105 hover:shadow-2xl",
                    variant === "focus" &&
                        "focus:ring-primary/40 focus:ring-[3px] focus:outline-none",
                    variant === "disabled" && "cursor-not-allowed opacity-50 grayscale",
                    variant === "loading" && "cursor-default"
                )}
            >
                {/* Ripple effect for click */}
                {variant === "click" && showRipple && (
                    <span className="animate-ripple bg-primary/30 absolute top-1/2 left-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full" />
                )}

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
                <Sparkles
                    className={cn(
                        "h-5 w-5 transition-colors",
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
