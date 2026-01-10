"use client";

import {
    SparkleIcon,
    UsersIcon,
    GearIcon,
    TreeStructureIcon,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { ExtractionStats } from "@/lib/import/extraction/types";

interface DiscoveryCompleteProps {
    stats: ExtractionStats;
    /** Optional - only show review button if handler provided (page exists) */
    onReviewFindings?: () => void;
    onKeepEverything: () => void;
    isApproving?: boolean;
}

/**
 * Phase 3: Discovery complete
 *
 * Shows what was discovered with category breakdown and invites user
 * to review or auto-approve all findings.
 */
export function DiscoveryComplete({
    stats,
    onReviewFindings,
    onKeepEverything,
    isApproving = false,
}: DiscoveryCompleteProps) {
    const { byCategory } = stats;

    const categories = [
        {
            name: "Projects",
            count: byCategory.project,
            icon: TreeStructureIcon,
            example: "What you've been building",
        },
        {
            name: "People",
            count: byCategory.person,
            icon: UsersIcon,
            example: "Who you work with",
        },
        {
            name: "Preferences",
            count: byCategory.preference,
            icon: GearIcon,
            example: "How you like things done",
        },
        {
            name: "Decisions",
            count: byCategory.decision,
            icon: SparkleIcon,
            example: "Choices you've made",
        },
    ].filter((c) => c.count > 0);

    return (
        <Card className="border-primary/20 bg-primary/5">
            <CardContent className="py-12">
                <div className="flex flex-col items-center justify-center text-center">
                    <div className="bg-primary/10 text-primary flex h-12 w-12 items-center justify-center rounded-full">
                        <SparkleIcon className="h-6 w-6" weight="duotone" />
                    </div>

                    <p className="mt-4 text-xl font-medium">We remember now.</p>

                    <p className="text-muted-foreground mt-2">
                        {stats.total} things worth keeping
                    </p>

                    {/* Category breakdown */}
                    {categories.length > 0 && (
                        <div className="mt-6 grid w-full max-w-lg gap-3 sm:grid-cols-2">
                            {categories.map((category) => (
                                <div
                                    key={category.name}
                                    className="bg-background/50 flex items-center gap-3 rounded-lg border p-4"
                                >
                                    <div className="bg-muted flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
                                        <category.icon className="text-muted-foreground h-5 w-5" />
                                    </div>
                                    <div className="min-w-0 text-left">
                                        <p className="font-medium">
                                            {category.name} ({category.count})
                                        </p>
                                        <p className="text-muted-foreground truncate text-sm">
                                            {category.example}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="mt-6">
                        {onReviewFindings ? (
                            <>
                                <p className="text-muted-foreground mb-4 text-sm">
                                    Want to review what we found?
                                </p>
                                <div className="flex gap-3">
                                    <Button
                                        variant="outline"
                                        onClick={onReviewFindings}
                                        disabled={isApproving}
                                    >
                                        Review findings
                                    </Button>
                                    <Button
                                        onClick={onKeepEverything}
                                        disabled={isApproving}
                                    >
                                        {isApproving ? "Saving..." : "Keep everything"}
                                    </Button>
                                </div>
                            </>
                        ) : (
                            <Button onClick={onKeepEverything} disabled={isApproving}>
                                {isApproving ? "Saving..." : "Keep everything"}
                            </Button>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
