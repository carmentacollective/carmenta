import { CodeIcon } from "@phosphor-icons/react/dist/ssr";

import { StandardPageLayout } from "@/components/layouts/standard-page-layout";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading state for Code Mode repo page
 *
 * Shows skeleton while repository data and sessions load.
 * Mirrors the code mode layout for smooth transition.
 */
export default function CodeRepoLoading() {
    return (
        <StandardPageLayout maxWidth="wide" verticalPadding="compact" hideWatermark>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-primary/20 rounded-xl p-3">
                            <CodeIcon className="text-primary h-6 w-6" />
                        </div>
                        <div>
                            <Skeleton className="h-6 w-48" />
                            <Skeleton className="mt-1 h-4 w-32" />
                        </div>
                    </div>
                    <Skeleton className="h-10 w-32 rounded-lg" />
                </div>

                {/* Session picker skeleton */}
                <div className="border-border/50 flex items-center gap-4 border-b pb-4">
                    <Skeleton className="h-8 w-40" />
                    <Skeleton className="h-8 w-8 rounded-lg" />
                </div>

                {/* Split view skeleton */}
                <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
                    {/* File tree */}
                    <div className="border-border/50 space-y-2 rounded-xl border p-4">
                        <Skeleton className="h-5 w-24" />
                        <div className="space-y-1 pl-4">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-4 w-28" />
                            <Skeleton className="h-4 w-36" />
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-4 w-30" />
                        </div>
                    </div>

                    {/* Chat area */}
                    <div className="border-border/50 flex min-h-[400px] flex-col rounded-xl border">
                        <div className="flex-1 p-4">
                            <div className="flex h-full items-center justify-center">
                                <Skeleton className="h-6 w-48" />
                            </div>
                        </div>
                        <div className="border-border/50 border-t p-4">
                            <Skeleton className="h-12 w-full rounded-xl" />
                        </div>
                    </div>
                </div>
            </div>
        </StandardPageLayout>
    );
}
