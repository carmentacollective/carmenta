"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Check, AlertTriangle, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ServiceDefinition } from "@/lib/integrations/services";
import type { IntegrationStatus } from "@/lib/integrations/types";

/**
 * Unified integration state for UI display.
 * Maps the database status to what users actually care about.
 */
export type IntegrationState = "connected" | "needs_attention" | "available";

/**
 * Inline status message shown in the card
 */
export interface StatusMessage {
    type: "success" | "error";
    text: string;
}

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
    /** Status message to display inline */
    statusMessage?: StatusMessage | null;
    /** Callback to clear status message */
    onClearStatusMessage?: () => void;
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
    statusMessage: externalStatusMessage,
    onClearStatusMessage,
}: IntegrationCardProps) {
    const state = getIntegrationState(status);
    const isLoading = isConnecting || isReconnecting || isTesting;

    // Auto-dismiss success messages after 3 seconds
    useEffect(() => {
        if (externalStatusMessage?.type === "success" && onClearStatusMessage) {
            const timer = setTimeout(() => {
                onClearStatusMessage();
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [externalStatusMessage, onClearStatusMessage]);

    return (
        <div
            className={cn(
                "group relative flex flex-col overflow-hidden rounded-2xl border-2 bg-card p-6 shadow-md transition-colors duration-300",
                state === "needs_attention"
                    ? "border-amber-400/80 hover:shadow-lg"
                    : state === "connected"
                      ? "border-green-500/80 hover:shadow-lg"
                      : "border-border/60 hover:border-border hover:shadow-lg"
            )}
        >
            {/* Header: Logo, Name, Status Icon */}
            <div className="flex flex-1 flex-col">
                <div className="flex items-start gap-4">
                    <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-2xl border-2 border-border/40 bg-white p-3 shadow-sm dark:bg-gray-50">
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
                        <p className="mt-2 line-clamp-2 min-h-[2.8rem] text-sm leading-relaxed text-muted-foreground">
                            {service.description}
                        </p>
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="mt-5 flex items-center gap-3">
                {state === "connected" && (
                    <>
                        {externalStatusMessage ? (
                            <div
                                className={cn(
                                    "flex flex-1 items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium",
                                    externalStatusMessage.type === "success"
                                        ? "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400"
                                        : "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400"
                                )}
                            >
                                {externalStatusMessage.type === "success" ? (
                                    <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                                ) : (
                                    <XCircle className="h-4 w-4 flex-shrink-0" />
                                )}
                                <span className="flex-1">
                                    {externalStatusMessage.text}
                                </span>
                            </div>
                        ) : (
                            <>
                                <button
                                    onClick={onTest}
                                    disabled={isLoading}
                                    className="rounded-xl border-2 border-border bg-background px-4 py-2 text-sm font-medium text-foreground shadow-sm transition-all hover:bg-accent hover:shadow disabled:opacity-50"
                                >
                                    {isTesting ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        "Verify"
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
