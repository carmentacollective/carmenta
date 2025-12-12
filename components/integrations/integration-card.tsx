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
    /** Account ID for connected services */
    accountId?: string;
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
    accountId: _accountId,
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
                "group rounded-2xl border p-4 transition-all duration-200",
                state === "needs_attention"
                    ? "border-amber-500/40 bg-amber-500/5"
                    : state === "connected"
                      ? "border-green-500/20 bg-green-500/5 shadow-sm shadow-green-500/5"
                      : "border-foreground/5 bg-foreground/[0.02] hover:border-foreground/10 hover:bg-foreground/[0.04]"
            )}
        >
            {/* Header: Logo, Name, Status Icon */}
            <div className="flex items-start gap-3">
                <div className="relative h-10 w-10 flex-shrink-0 rounded-[10px] border border-foreground/5 bg-foreground/[0.03] p-2">
                    <Image
                        src={service.logo}
                        alt={service.name}
                        fill
                        className="object-contain p-0.5"
                    />
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <h3 className="font-medium text-foreground/90">
                            {service.name}
                        </h3>
                        {state === "connected" && (
                            <Check className="h-3.5 w-3.5 text-green-500" />
                        )}
                        {state === "needs_attention" && (
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                        )}
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-foreground/50">
                        {service.description}
                    </p>
                </div>
            </div>

            {/* Actions */}
            <div className="mt-4 flex items-center gap-2">
                {state === "connected" && (
                    <>
                        <button
                            onClick={onTest}
                            disabled={isLoading}
                            className="rounded-lg border border-foreground/10 bg-foreground/5 px-3 py-1.5 text-xs font-medium text-foreground/60 transition-colors hover:bg-foreground/10 disabled:opacity-50"
                        >
                            {isTesting ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                                "Test"
                            )}
                        </button>
                        <button
                            onClick={onDisconnect}
                            disabled={isLoading}
                            className="rounded-lg border border-foreground/10 px-3 py-1.5 text-xs text-foreground/40 transition-colors hover:border-red-500/30 hover:text-red-500 disabled:opacity-50"
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
                            className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-600 transition-colors hover:bg-amber-500/20 disabled:opacity-50"
                        >
                            {isReconnecting ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                                "Reconnect"
                            )}
                        </button>
                        <button
                            onClick={onDisconnect}
                            disabled={isLoading}
                            className="rounded-lg border border-foreground/10 px-3 py-1.5 text-xs text-foreground/40 transition-colors hover:border-red-500/30 hover:text-red-500 disabled:opacity-50"
                        >
                            Disconnect
                        </button>
                    </>
                )}

                {state === "available" && (
                    <button
                        onClick={onConnect}
                        disabled={isLoading}
                        className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                    >
                        {isConnecting ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                            "Connect"
                        )}
                    </button>
                )}
            </div>
        </div>
    );
}
