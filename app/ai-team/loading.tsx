import { UsersIcon } from "@phosphor-icons/react/dist/ssr";

import { StandardPageLayout } from "@/components/layouts/standard-page-layout";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading state for AI Team page
 *
 * Shows skeleton of the team dashboard while data loads.
 * Mirrors page structure for smooth transition.
 */
export default function AITeamLoading() {
    return (
        <StandardPageLayout maxWidth="wide" verticalPadding="compact" hideWatermark>
            <div className="space-y-8">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-primary/20 rounded-xl p-3">
                            <UsersIcon className="text-primary h-6 w-6" />
                        </div>
                        <div>
                            <h1 className="text-foreground text-2xl font-light tracking-tight">
                                AI Team
                            </h1>
                            <p className="text-foreground/60 text-sm">
                                Loading your automations...
                            </p>
                        </div>
                    </div>
                    <Skeleton className="h-10 w-32 rounded-lg" />
                </div>

                {/* Tabs skeleton */}
                <div className="border-border/50 flex gap-4 border-b pb-2">
                    <Skeleton className="h-8 w-24" />
                    <Skeleton className="h-8 w-24" />
                    <Skeleton className="h-8 w-24" />
                </div>

                {/* Content grid skeleton */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div key={i} className="border-border/50 rounded-xl border p-4">
                            <div className="flex items-start justify-between">
                                <div className="space-y-2">
                                    <Skeleton className="h-5 w-32" />
                                    <Skeleton className="h-4 w-48" />
                                </div>
                                <Skeleton className="h-6 w-12 rounded-full" />
                            </div>
                            <div className="mt-4 flex items-center gap-2">
                                <Skeleton className="h-4 w-24" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </StandardPageLayout>
    );
}
