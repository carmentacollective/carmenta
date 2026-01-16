"use client";

import {
    CheckCircleIcon,
    SparkleIcon,
    TreeStructureIcon,
    UsersIcon,
    GearIcon,
    LightbulbIcon,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface DiscoveryInvitationProps {
    connectionsCreated: number;
    messagesImported: number;
    skippedDuplicates: number;
    onBeginDiscovery: () => void;
    onSkipDiscovery: () => void;
    isStarting?: boolean;
}

const discoveryCategories = [
    {
        icon: TreeStructureIcon,
        label: "Projects",
        description: "What you're building",
    },
    {
        icon: UsersIcon,
        label: "People",
        description: "Who you work with",
    },
    {
        icon: GearIcon,
        label: "Preferences",
        description: "How you like things",
    },
    {
        icon: LightbulbIcon,
        label: "Decisions",
        description: "Choices you've made",
    },
];

/**
 * Phase 1: Import complete + invitation to begin knowledge discovery
 *
 * Celebrates import success and clearly explains what Discovery offers,
 * giving the user a genuine choice to proceed or skip.
 */
export function DiscoveryInvitation({
    connectionsCreated,
    messagesImported,
    skippedDuplicates,
    onBeginDiscovery,
    onSkipDiscovery,
    isStarting = false,
}: DiscoveryInvitationProps) {
    return (
        <div className="space-y-6">
            {/* Import Success - Clear completion */}
            <Card className="border-green-500/30 bg-green-500/5">
                <CardContent className="py-8">
                    <div className="flex flex-col items-center justify-center text-center">
                        <CheckCircleIcon
                            className="h-12 w-12 text-green-600"
                            weight="duotone"
                        />
                        <p className="mt-4 text-xl font-medium">Import complete!</p>
                        <p className="text-muted-foreground mt-2">
                            {connectionsCreated.toLocaleString()} conversations
                            {messagesImported > 0 && (
                                <span>
                                    {" "}
                                    ({messagesImported.toLocaleString()} messages)
                                </span>
                            )}
                            {skippedDuplicates > 0 && (
                                <span className="mt-1 block text-sm">
                                    Skipped {skippedDuplicates} you already had
                                </span>
                            )}
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* Discovery Invitation - Clear value proposition */}
            <Card className="border-primary/20 bg-primary/5">
                <CardContent className="py-8">
                    <div className="flex flex-col items-center justify-center text-center">
                        <div className="bg-primary/10 text-primary flex h-12 w-12 items-center justify-center rounded-full">
                            <SparkleIcon className="h-6 w-6" weight="duotone" />
                        </div>

                        <p className="mt-4 text-lg font-medium">
                            Want us to find the gold?
                        </p>

                        <p className="text-muted-foreground mt-3 max-w-md">
                            We can read through your history and surface what matters.
                            You&apos;ll review everything before it&apos;s added to your
                            knowledge base.
                        </p>

                        {/* What we'll find */}
                        <div className="mt-6 grid w-full max-w-md grid-cols-2 gap-3">
                            {discoveryCategories.map((category) => (
                                <div
                                    key={category.label}
                                    className="bg-background/50 flex items-center gap-2 rounded-lg border px-3 py-2"
                                >
                                    <category.icon className="text-muted-foreground h-4 w-4 shrink-0" />
                                    <span className="text-sm">{category.label}</span>
                                </div>
                            ))}
                        </div>

                        <div className="mt-6 flex gap-3">
                            <Button
                                variant="outline"
                                onClick={onSkipDiscovery}
                                disabled={isStarting}
                            >
                                Skip for now
                            </Button>
                            <Button onClick={onBeginDiscovery} disabled={isStarting}>
                                {isStarting ? "Starting..." : "Find knowledge"}
                            </Button>
                        </div>

                        <p className="text-muted-foreground mt-4 text-xs">
                            You can always run discovery later
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
