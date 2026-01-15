import { PlugIcon } from "@phosphor-icons/react/dist/ssr";

import { StandardPageLayout } from "@/components/layouts/standard-page-layout";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading state for Integrations page
 *
 * Shows skeleton of the integrations list while data loads.
 * Mirrors page structure for smooth transition.
 */
export default function IntegrationsLoading() {
    return (
        <StandardPageLayout maxWidth="wide" verticalPadding="compact" hideWatermark>
            <div className="space-y-8">
                {/* Header */}
                <div className="flex items-center gap-3">
                    <div className="bg-primary/20 rounded-xl p-3">
                        <PlugIcon className="text-primary h-6 w-6" />
                    </div>
                    <div>
                        <h1 className="text-foreground text-2xl font-light tracking-tight">
                            Integrations
                        </h1>
                        <p className="text-foreground/60 text-sm">
                            Loading your connected services...
                        </p>
                    </div>
                </div>

                {/* Services grid skeleton */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
                        <div key={i} className="border-border/50 rounded-xl border p-4">
                            <div className="flex items-center gap-3">
                                <Skeleton className="h-10 w-10 rounded-lg" />
                                <div className="flex-1 space-y-2">
                                    <Skeleton className="h-5 w-24" />
                                    <Skeleton className="h-3 w-32" />
                                </div>
                                <Skeleton className="h-8 w-20 rounded-lg" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </StandardPageLayout>
    );
}
