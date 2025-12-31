import { cn } from "@/lib/utils";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
    /**
     * Animation style: "shimmer" (sweeping gradient) or "pulse" (opacity fade)
     * Shimmer is more visually engaging for content placeholders.
     * @default "shimmer"
     */
    variant?: "shimmer" | "pulse";
}

function Skeleton({ className, variant = "shimmer", ...props }: SkeletonProps) {
    return (
        <div
            className={cn(
                "rounded-md",
                variant === "shimmer"
                    ? "animate-shimmer"
                    : "bg-primary/10 animate-pulse",
                className
            )}
            {...props}
        />
    );
}

export { Skeleton };
