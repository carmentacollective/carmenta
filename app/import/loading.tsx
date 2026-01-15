import { UploadIcon } from "@phosphor-icons/react/dist/ssr";

import { StandardPageLayout } from "@/components/layouts/standard-page-layout";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading state for Import page
 *
 * Shows skeleton of the import interface while page loads.
 * Mirrors page structure for smooth transition.
 */
export default function ImportLoading() {
    return (
        <StandardPageLayout maxWidth="standard" verticalPadding="compact" hideWatermark>
            <div className="space-y-8">
                {/* Header */}
                <div className="flex items-center gap-3">
                    <div className="bg-primary/20 rounded-xl p-3">
                        <UploadIcon className="text-primary h-6 w-6" />
                    </div>
                    <div>
                        <h1 className="text-foreground text-2xl font-light tracking-tight">
                            Import
                        </h1>
                        <p className="text-foreground/60 text-sm">
                            Preparing import interface...
                        </p>
                    </div>
                </div>

                {/* Stepper skeleton */}
                <div className="flex justify-center gap-8">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="flex items-center gap-2">
                            <Skeleton className="h-8 w-8 rounded-full" />
                            <Skeleton className="h-4 w-16" />
                        </div>
                    ))}
                </div>

                {/* Upload zone skeleton */}
                <div className="mx-auto max-w-xl">
                    <Skeleton className="h-48 w-full rounded-xl" />
                </div>

                {/* Provider options skeleton */}
                <div className="mx-auto flex max-w-xl justify-center gap-4">
                    <Skeleton className="h-24 w-40 rounded-xl" />
                    <Skeleton className="h-24 w-40 rounded-xl" />
                </div>
            </div>
        </StandardPageLayout>
    );
}
