import { Skeleton } from "@/components/ui/skeleton";
import { HolographicBackground } from "@/components/ui/holographic-background";

/**
 * Loading state for Connection/Chat page
 *
 * Shows skeleton of the chat interface while server component loads.
 * Mirrors the ConnectLayout structure for smooth transition.
 */
export default function ConnectionLoading() {
    return (
        <div className="fixed inset-0 overflow-hidden">
            <HolographicBackground hideWatermark />

            <div className="z-content relative flex h-full flex-col">
                {/* Header skeleton */}
                <div className="border-border/50 flex h-14 items-center justify-between border-b px-4">
                    <div className="flex items-center gap-3">
                        {/* Oracle skeleton */}
                        <Skeleton className="h-8 w-8 rounded-full" />
                        {/* Connection chooser skeleton */}
                        <Skeleton className="h-6 w-32 rounded-md" />
                    </div>
                    <div className="flex items-center gap-2">
                        <Skeleton className="h-8 w-8 rounded-full" />
                        <Skeleton className="h-8 w-8 rounded-full" />
                    </div>
                </div>

                {/* Chat area skeleton */}
                <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4">
                    {/* Greeting skeleton */}
                    <Skeleton className="h-10 w-48 rounded-lg" />
                    {/* Sparks skeleton */}
                    <div className="flex flex-wrap justify-center gap-3">
                        <Skeleton className="h-11 w-28 rounded-full" />
                        <Skeleton className="h-11 w-36 rounded-full" />
                        <Skeleton className="h-11 w-32 rounded-full" />
                    </div>
                </div>

                {/* Composer skeleton */}
                <div className="border-border/50 border-t p-4">
                    <div className="mx-auto max-w-3xl">
                        <Skeleton className="h-12 w-full rounded-xl" />
                    </div>
                </div>
            </div>
        </div>
    );
}
