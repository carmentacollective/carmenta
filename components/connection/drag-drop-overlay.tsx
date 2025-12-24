"use client";

/**
 * Drag-Drop Overlay
 *
 * Full-viewport visual feedback during file drag operations.
 * Always rendered but hidden via opacity/visibility for GPU-accelerated transitions.
 *
 * Design: Matches the Carmenta aesthetic - deep purple twilight with holographic shimmer.
 * Breathing glow animation inspired by the Oracle component.
 */

import { memo } from "react";
import { Upload, Image, FileText, Music } from "lucide-react";
import { cn } from "@/lib/utils";

interface DragDropOverlayProps {
    /** Whether files are currently being dragged over the viewport */
    isActive: boolean;
}

export const DragDropOverlay = memo(function DragDropOverlay({
    isActive,
}: DragDropOverlayProps) {
    return (
        <>
            {/* Backdrop overlay - deep purple twilight fade */}
            <div
                className={cn(
                    "fixed inset-0 z-backdrop transition-all duration-300 ease-out",
                    isActive
                        ? "pointer-events-auto visible opacity-100"
                        : "pointer-events-none invisible opacity-0"
                )}
                style={{
                    background:
                        "radial-gradient(ellipse at center, hsl(280 30% 8% / 0.85) 0%, hsl(280 30% 4% / 0.95) 100%)",
                    backdropFilter: "blur(4px)",
                    willChange: "opacity",
                }}
                aria-hidden="true"
            />

            {/* Content overlay - centered drop zone */}
            <div
                className={cn(
                    "fixed inset-0 z-modal flex flex-col items-center justify-center transition-all duration-300 ease-out",
                    isActive
                        ? "pointer-events-auto visible opacity-100"
                        : "pointer-events-none invisible opacity-0"
                )}
                style={{
                    transform: isActive ? "scale(1)" : "scale(0.9)",
                    willChange: "opacity, transform",
                }}
                role="region"
                aria-label="Drop zone for file uploads"
                aria-live="polite"
            >
                {/* Outer glow effect - breathing animation */}
                <div
                    className={cn(
                        "absolute rounded-3xl transition-all duration-500",
                        isActive && "animate-pulse"
                    )}
                    style={{
                        width: "340px",
                        height: "280px",
                        background:
                            "radial-gradient(ellipse at center, hsl(var(--primary) / 0.3) 0%, transparent 70%)",
                        filter: "blur(40px)",
                    }}
                />

                {/* Drop zone card with glass morphism */}
                <div
                    className={cn(
                        "relative flex flex-col items-center rounded-2xl p-10",
                        "border-2 border-dashed transition-all duration-300",
                        isActive
                            ? "border-primary/60 bg-card/80"
                            : "border-primary/20 bg-card/60"
                    )}
                    style={{
                        backdropFilter: "blur(20px)",
                        boxShadow: isActive
                            ? "0 0 60px hsl(var(--primary) / 0.2), 0 25px 50px -12px rgba(0, 0, 0, 0.5)"
                            : "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
                    }}
                >
                    {/* Icon container with glow */}
                    <div className="relative mb-6">
                        {/* Glow behind icon */}
                        <div
                            className={cn(
                                "absolute inset-0 rounded-full transition-all duration-500",
                                isActive
                                    ? "scale-150 opacity-100"
                                    : "scale-100 opacity-0"
                            )}
                            style={{
                                background:
                                    "radial-gradient(circle, hsl(var(--primary) / 0.4) 0%, transparent 70%)",
                                filter: "blur(12px)",
                            }}
                        />

                        {/* Icon circle */}
                        <div
                            className={cn(
                                "relative flex h-20 w-20 items-center justify-center rounded-full",
                                "bg-gradient-to-br from-primary/20 to-primary/5",
                                "border border-primary/30",
                                "transition-transform duration-500 ease-out",
                                isActive && "scale-110"
                            )}
                        >
                            <Upload
                                className={cn(
                                    "h-10 w-10 text-primary transition-transform duration-300",
                                    isActive && "-translate-y-1"
                                )}
                            />
                        </div>
                    </div>

                    {/* Heading */}
                    <h3 className="text-xl font-semibold tracking-tight text-foreground">
                        Drop to attach
                    </h3>

                    {/* Subtext */}
                    <p className="mt-2 text-sm text-foreground/50">
                        Release to add files to your message
                    </p>

                    {/* Supported file types row */}
                    <div className="mt-6 flex items-center gap-4">
                        <FileTypeIndicator icon={Image} label="Images" />
                        <FileTypeIndicator icon={FileText} label="PDFs" />
                        <FileTypeIndicator icon={Music} label="Audio" />
                    </div>
                </div>
            </div>
        </>
    );
});

/** Small indicator showing a supported file type */
function FileTypeIndicator({
    icon: Icon,
    label,
}: {
    icon: typeof Image;
    label: string;
}) {
    return (
        <div className="flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5">
            <Icon className="h-3.5 w-3.5 text-primary/70" />
            <span className="text-xs font-medium text-foreground/60">{label}</span>
        </div>
    );
}
