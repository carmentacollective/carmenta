"use client";

import Image from "next/image";
import { Check, AlertTriangle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ServiceDefinition } from "@/lib/integrations/services";
import type { IntegrationStatus } from "@/lib/integrations/types";

/**
 * Unified integration state for UI display.
 * Maps the database status to what users actually care about.
 */
export type IntegrationState = "connected" | "needs_attention" | "available";

/**
 * Props for unified integration display
 */
export interface IntegrationCardProps {
    service: ServiceDefinition;
    /** Database status - undefined means not connected */
    status?: IntegrationStatus;
    /** Actions */
    onConnect?: () => void;
    onReconnect?: () => void;
    onTest?: () => void;
    onDisconnect?: () => void;
    /** Loading states */
    isConnecting?: boolean;
    isReconnecting?: boolean;
    isTesting?: boolean;
}

/**
 * Map database status to UI state.
 * - connected → "connected" (green, working)
 * - error/expired → "needs_attention" (amber, fixable)
 * - disconnected/undefined → "available" (gray, can connect)
 */
function getIntegrationState(status?: IntegrationStatus): IntegrationState {
    if (status === "connected") return "connected";
    if (status === "error" || status === "expired") return "needs_attention";
    return "available";
}

export function IntegrationCard({
    service,
    status,
    onConnect,
    onReconnect,
    onTest,
    onDisconnect,
    isConnecting = false,
    isReconnecting = false,
    isTesting = false,
}: IntegrationCardProps) {
    const state = getIntegrationState(status);
    const isLoading = isConnecting || isReconnecting || isTesting;

    return (
        <div
            className={cn(
                "group relative overflow-hidden rounded-2xl border-2 bg-card p-6 shadow-md transition-all duration-300",
                state === "needs_attention"
                    ? "border-amber-400/60 bg-amber-50/5 shadow-amber-500/10 hover:shadow-amber-500/20 dark:bg-amber-950/20"
                    : state === "connected"
                      ? "border-green-400/70 bg-gradient-to-br from-green-50/10 to-emerald-50/5 shadow-green-500/20 hover:shadow-green-500/30 dark:from-green-950/20 dark:to-emerald-950/10"
                      : "border-border/60 bg-card hover:border-border hover:shadow-lg"
            )}
        >
            {/* Status indicator stripe */}
            {state === "connected" && (
                <div className="absolute left-0 top-0 h-full w-1.5 bg-gradient-to-b from-green-400 to-emerald-500" />
            )}
            {state === "needs_attention" && (
                <div className="absolute left-0 top-0 h-full w-1.5 bg-gradient-to-b from-amber-400 to-orange-500" />
            )}

            {/* Header: Logo, Name, Status Icon */}
            <div className="flex items-start gap-4">
                <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-2xl border-2 border-border/40 bg-background p-3 shadow-sm">
                    <Image
                        src={service.logo}
                        alt={service.name}
                        fill
                        className="object-contain p-1"
                    />
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2.5">
                        <h3 className="text-lg font-semibold tracking-tight text-foreground">
                            {service.name}
                        </h3>
                        {state === "connected" && (
                            <div className="flex items-center gap-1 rounded-full bg-green-500/15 px-2 py-0.5">
                                <Check className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                            </div>
                        )}
                        {state === "needs_attention" && (
                            <div className="flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5">
                                <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                            </div>
                        )}
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                        {service.description}
                    </p>
                </div>
            </div>

            {/* Actions */}
            <div className="mt-5 flex items-center gap-3">
                {state === "connected" && (
                    <>
                        <button
                            onClick={onTest}
                            disabled={isLoading}
                            className="rounded-xl border-2 border-border bg-background px-4 py-2 text-sm font-medium text-foreground shadow-sm transition-all hover:bg-accent hover:shadow disabled:opacity-50"
                        >
                            {isTesting ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                "Test"
                            )}
                        </button>
                        <button
                            onClick={onDisconnect}
                            disabled={isLoading}
                            className="rounded-xl border-2 border-border px-4 py-2 text-sm text-muted-foreground transition-all hover:border-red-500/50 hover:bg-red-50/50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-950/20"
                        >
                            Disconnect
                        </button>
                    </>
                )}

                {state === "needs_attention" && (
                    <>
                        <button
                            onClick={onReconnect}
                            disabled={isLoading}
                            className="rounded-xl border-2 border-amber-400/60 bg-amber-500/15 px-4 py-2 text-sm font-semibold text-amber-700 shadow-sm transition-all hover:bg-amber-500/25 hover:shadow disabled:opacity-50 dark:text-amber-400"
                        >
                            {isReconnecting ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                "Reconnect"
                            )}
                        </button>
                        <button
                            onClick={onDisconnect}
                            disabled={isLoading}
                            className="rounded-xl border-2 border-border px-4 py-2 text-sm text-muted-foreground transition-all hover:border-red-500/50 hover:bg-red-50/50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-950/20"
                        >
                            Disconnect
                        </button>
                    </>
                )}

                {state === "available" && (
                    <button
                        onClick={onConnect}
                        disabled={isLoading}
                        className="rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow-md transition-all hover:scale-105 hover:shadow-lg disabled:opacity-50"
                    >
                        {isConnecting ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            "Connect"
                        )}
                    </button>
                )}
            </div>
        </div>
    );
}
