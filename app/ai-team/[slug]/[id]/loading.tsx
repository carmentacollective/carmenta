import { ArrowLeftIcon } from "@phosphor-icons/react/dist/ssr";

import { StandardPageLayout } from "@/components/layouts/standard-page-layout";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading state for job detail/edit page
 *
 * Shows skeleton of the form while job data loads.
 * Mirrors page structure for smooth transition.
 */
export default function JobDetailLoading() {
    return (
        <StandardPageLayout maxWidth="standard" contentClassName="py-8">
            <div className="mx-auto max-w-2xl">
                {/* Header */}
                <div className="mb-8 flex items-center gap-3">
                    <div className="text-foreground/60 p-1">
                        <ArrowLeftIcon className="h-5 w-5" />
                    </div>
                    <div>
                        <Skeleton className="mb-1 h-6 w-48" />
                        <Skeleton className="h-4 w-32" />
                    </div>
                </div>

                {/* Form sections */}
                <div className="space-y-6">
                    {/* Name field */}
                    <div className="space-y-2">
                        <Skeleton className="h-4 w-16" />
                        <Skeleton className="h-10 w-full rounded-lg" />
                    </div>

                    {/* Prompt field */}
                    <div className="space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-32 w-full rounded-lg" />
                    </div>

                    {/* Schedule section */}
                    <div className="border-foreground/10 rounded-xl border p-4">
                        <div className="mb-4 flex items-center justify-between">
                            <Skeleton className="h-5 w-24" />
                            <Skeleton className="h-5 w-5" />
                        </div>
                        <Skeleton className="h-10 w-full rounded-lg" />
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-3 pt-4">
                        <Skeleton className="h-10 w-24 rounded-lg" />
                        <Skeleton className="h-10 flex-1 rounded-lg" />
                    </div>
                </div>
            </div>
        </StandardPageLayout>
    );
}
