"use client";

import { CheckCircleIcon, SparkleIcon } from "@phosphor-icons/react";
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

/**
 * Phase 1: Invitation to begin knowledge discovery after import
 *
 * Shows import success and invites user to let Carmenta read through
 * their conversations to build shared context.
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
            {/* Import Success */}
            <Card className="border-green-500/30 bg-green-500/5">
                <CardContent className="py-8">
                    <div className="flex flex-col items-center justify-center text-center">
                        <CheckCircleIcon
                            className="h-12 w-12 text-green-600"
                            weight="duotone"
                        />
                        <p className="mt-4 text-xl font-medium">
                            {connectionsCreated.toLocaleString()} conversations imported
                        </p>
                        <p className="text-muted-foreground mt-2">
                            {messagesImported.toLocaleString()} messages now in Carmenta
                            {skippedDuplicates > 0 && (
                                <span className="mt-1 block">
                                    (Already had {skippedDuplicates} of these)
                                </span>
                            )}
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* Discovery Invitation */}
            <Card className="border-primary/20 bg-primary/5">
                <CardContent className="py-8">
                    <div className="flex flex-col items-center justify-center text-center">
                        <div className="bg-primary/10 text-primary flex h-12 w-12 items-center justify-center rounded-full">
                            <SparkleIcon className="h-6 w-6" weight="duotone" />
                        </div>
                        <p className="mt-4 text-lg font-medium">
                            Let&apos;s see what we&apos;ve been building together.
                        </p>
                        <p className="text-muted-foreground mt-3 max-w-md">
                            We&apos;ll look for projects you&apos;re working on, people
                            you work with, preferences and patterns, and decisions
                            you&apos;ve made.
                        </p>
                        <div className="mt-6 flex gap-3">
                            <Button
                                variant="outline"
                                onClick={onSkipDiscovery}
                                disabled={isStarting}
                            >
                                I&apos;ll explore first
                            </Button>
                            <Button onClick={onBeginDiscovery} disabled={isStarting}>
                                {isStarting ? "Starting..." : "Begin Discovery"}
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
