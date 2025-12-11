"use client";

/**
 * Drag-Drop Overlay
 *
 * Full-viewport visual feedback during file drag operations.
 * Always rendered but hidden via opacity/visibility for GPU-accelerated transitions.
 *
 * Design: Semi-transparent backdrop with centered drop zone indicator.
 * Pattern from LibreChat - proven to feel responsive and polished.
 */

import { memo } from "react";
import { Upload } from "lucide-react";
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
            {/* Backdrop overlay - semi-transparent black that dims the interface */}
            <div
                className={cn(
                    "fixed inset-0 z-[9998] transition-opacity duration-200 ease-in-out",
                    isActive
                        ? "pointer-events-auto visible opacity-100"
                        : "pointer-events-none invisible opacity-0"
                )}
                style={{
                    backgroundColor: "rgba(0, 0, 0, 0.4)",
                    willChange: "opacity",
                }}
                aria-hidden="true"
            />

            {/* Content overlay - centered drop zone indicator */}
            <div
                className={cn(
                    "fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-2 transition-all duration-200 ease-in-out",
                    isActive
                        ? "pointer-events-auto visible opacity-100"
                        : "pointer-events-none invisible opacity-0"
                )}
                style={{
                    transform: isActive ? "scale(1)" : "scale(0.95)",
                    willChange: "opacity, transform",
                }}
                role="region"
                aria-label="Drop zone for file uploads"
                aria-live="polite"
            >
                {/* Drop zone card with glass effect */}
                <div className="flex flex-col items-center rounded-2xl border border-primary/20 bg-background/95 p-8 shadow-2xl backdrop-blur-xl">
                    {/* Animated upload icon */}
                    <div
                        className={cn(
                            "mb-4 rounded-full bg-primary/10 p-4 transition-transform duration-200",
                            isActive && "animate-bounce"
                        )}
                    >
                        <Upload className="h-10 w-10 text-primary" />
                    </div>

                    {/* Heading */}
                    <h3 className="text-lg font-semibold text-foreground">
                        Drop files to attach
                    </h3>

                    {/* Subtext with supported formats */}
                    <p className="mt-1 text-sm text-foreground/60">
                        Images, PDFs, or audio files
                    </p>
                </div>
            </div>
        </>
    );
});
