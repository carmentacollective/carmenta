"use client";

import { useEffect } from "react";
import Image from "next/image";
import {
    Check,
    AlertTriangle,
    Loader2,
    CheckCircle2,
    XCircle,
    Plus,
    Star,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ServiceDefinition } from "@/lib/integrations/services";
import type { IntegrationStatus } from "@/lib/integrations/types";
import type { GroupedAccount } from "@/lib/actions/integration-utils";

/**
 * Status message shown inline in the card
 */
export interface StatusMessage {
    type: "success" | "error";
    text: string;
    accountId?: string;
}

/**
 * Props for the multi-account service card
 */
export interface MultiAccountServiceCardProps {
    service: ServiceDefinition;
    accounts: GroupedAccount[];
    aggregateStatus: IntegrationStatus | null;
    /** Actions */
    onConnect?: () => void;
    onReconnect?: (accountId: string) => void;
    onTest?: (accountId: string) => void;
    onDisconnect?: (accountId: string) => void;
    onSetDefault?: (accountId: string) => void;
    /** Loading states */
    isConnecting?: boolean;
    testingAccounts?: Set<string>;
    reconnectingAccounts?: Set<string>;
    /** Status message to display inline */
    statusMessage?: StatusMessage | null;
    /** Callback to clear status message */
    onClearStatusMessage?: () => void;
}

/**
 * Get display label for an account.
 * Priority: accountDisplayName > accountId (if it looks like an email) > "Account"
 */
function getAccountLabel(account: GroupedAccount): string {
    if (account.accountDisplayName) {
        return account.accountDisplayName;
    }
    if (account.accountId.includes("@")) {
        return account.accountId;
    }
    if (account.accountId === "default") {
        return "Default Account";
    }
    return account.accountId;
}

/**
 * Get the status indicator color and icon for an account
 */
function getAccountStatusIndicator(status: IntegrationStatus) {
    switch (status) {
        case "connected":
            return {
                icon: Check,
                bgColor: "bg-green-500/15",
                textColor: "text-green-600 dark:text-green-400",
            };
        case "error":
        case "expired":
            return {
                icon: AlertTriangle,
                bgColor: "bg-amber-500/15",
                textColor: "text-amber-600 dark:text-amber-400",
            };
        default:
            return null;
    }
}

export function MultiAccountServiceCard({
    service,
    accounts,
    aggregateStatus,
    onConnect,
    onReconnect,
    onTest,
    onDisconnect,
    onSetDefault,
    isConnecting = false,
    testingAccounts = new Set(),
    reconnectingAccounts = new Set(),
    statusMessage,
    onClearStatusMessage,
}: MultiAccountServiceCardProps) {
    const hasAccounts = accounts.length > 0;
    const supportsMultiple = service.supportsMultipleAccounts ?? false;

    // Auto-dismiss success messages after 3 seconds
    useEffect(() => {
        if (statusMessage?.type === "success" && onClearStatusMessage) {
            const timer = setTimeout(() => {
                onClearStatusMessage();
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [statusMessage, onClearStatusMessage]);

    // Determine card border color based on aggregate status
    const borderColor =
        aggregateStatus === "error" || aggregateStatus === "expired"
            ? "border-amber-400/80"
            : aggregateStatus === "connected"
              ? "border-green-500/80"
              : "border-border/60";

    return (
        <div
            className={cn(
                "group bg-card relative flex flex-col overflow-hidden rounded-2xl border-2 p-6 shadow-md transition-colors duration-300 hover:shadow-lg",
                borderColor,
                !hasAccounts && "hover:border-border"
            )}
        >
            {/* Header: Logo, Name, Account Count */}
            <div className="flex items-start gap-4">
                <div className="border-border/40 relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-2xl border-2 bg-white p-3 shadow-sm dark:bg-gray-50">
                    <Image
                        src={service.logo}
                        alt={service.name}
                        fill
                        className="object-contain p-1"
                    />
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2.5">
                        <h3 className="text-foreground text-lg font-semibold tracking-tight">
                            {service.name}
                        </h3>
                        {hasAccounts && (
                            <span className="text-muted-foreground text-sm">
                                {accounts.length === 1
                                    ? "1 account"
                                    : `${accounts.length} accounts`}
                            </span>
                        )}
                    </div>
                    <p className="text-muted-foreground mt-2 line-clamp-2 text-sm leading-relaxed">
                        {service.description}
                    </p>
                </div>
            </div>

            {/* Accounts List */}
            {hasAccounts && (
                <div className="mt-4 space-y-2">
                    {accounts.map((account) => {
                        const statusIndicator = getAccountStatusIndicator(
                            account.status
                        );
                        const isTesting = testingAccounts.has(account.accountId);
                        const isReconnecting = reconnectingAccounts.has(
                            account.accountId
                        );
                        const isLoading = isTesting || isReconnecting;
                        const needsAttention =
                            account.status === "error" || account.status === "expired";

                        return (
                            <div
                                key={account.accountId}
                                className={cn(
                                    "bg-muted/30 flex items-center justify-between rounded-xl px-4 py-3",
                                    needsAttention && "bg-amber-500/5"
                                )}
                            >
                                <div className="flex items-center gap-3">
                                    {/* Status indicator */}
                                    {statusIndicator && (
                                        <div
                                            className={cn(
                                                "flex items-center justify-center rounded-full p-1",
                                                statusIndicator.bgColor
                                            )}
                                        >
                                            <statusIndicator.icon
                                                className={cn(
                                                    "h-3.5 w-3.5",
                                                    statusIndicator.textColor
                                                )}
                                            />
                                        </div>
                                    )}
                                    {/* Account label */}
                                    <span className="text-foreground text-sm font-medium">
                                        {getAccountLabel(account)}
                                    </span>
                                    {/* Default badge */}
                                    {account.isDefault && (
                                        <span className="bg-primary/10 text-primary flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium">
                                            <Star className="h-3 w-3" />
                                            default
                                        </span>
                                    )}
                                </div>

                                {/* Account actions */}
                                <div className="flex items-center gap-2">
                                    {/* Status message for this account */}
                                    {statusMessage?.accountId === account.accountId && (
                                        <div
                                            className={cn(
                                                "flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium",
                                                statusMessage.type === "success"
                                                    ? "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400"
                                                    : "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400"
                                            )}
                                        >
                                            {statusMessage.type === "success" ? (
                                                <CheckCircle2 className="h-3 w-3" />
                                            ) : (
                                                <XCircle className="h-3 w-3" />
                                            )}
                                            {statusMessage.text}
                                        </div>
                                    )}

                                    {needsAttention ? (
                                        <button
                                            onClick={() =>
                                                onReconnect?.(account.accountId)
                                            }
                                            disabled={isLoading}
                                            className="rounded-lg border border-amber-400/60 bg-amber-500/15 px-3 py-1.5 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-500/25 disabled:opacity-50 dark:text-amber-400"
                                        >
                                            {isReconnecting ? (
                                                <Loader2 className="h-3 w-3 animate-spin" />
                                            ) : (
                                                "Reconnect"
                                            )}
                                        </button>
                                    ) : (
                                        <>
                                            {!account.isDefault && onSetDefault && (
                                                <button
                                                    onClick={() =>
                                                        onSetDefault(account.accountId)
                                                    }
                                                    disabled={isLoading}
                                                    className="text-muted-foreground hover:text-foreground rounded-lg px-2 py-1 text-xs transition-colors disabled:opacity-50"
                                                >
                                                    Set default
                                                </button>
                                            )}
                                            <button
                                                onClick={() =>
                                                    onTest?.(account.accountId)
                                                }
                                                disabled={isLoading}
                                                className="text-muted-foreground hover:text-foreground rounded-lg px-2 py-1 text-xs transition-colors disabled:opacity-50"
                                            >
                                                {isTesting ? (
                                                    <Loader2 className="h-3 w-3 animate-spin" />
                                                ) : (
                                                    "Verify"
                                                )}
                                            </button>
                                        </>
                                    )}
                                    <button
                                        onClick={() =>
                                            onDisconnect?.(account.accountId)
                                        }
                                        disabled={isLoading}
                                        className="text-muted-foreground rounded-lg px-2 py-1 text-xs transition-colors hover:text-red-600 disabled:opacity-50"
                                    >
                                        Disconnect
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Actions: Connect / Add another account */}
            <div className="mt-5 flex items-center gap-3">
                {!hasAccounts ? (
                    // No accounts - show Connect button
                    <button
                        onClick={onConnect}
                        disabled={isConnecting}
                        className="interactive-focus-offset interactive-press bg-primary text-primary-foreground rounded-xl px-5 py-3 text-sm font-semibold shadow-md transition-all hover:scale-105 hover:shadow-lg disabled:opacity-50"
                    >
                        {isConnecting ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            "Connect"
                        )}
                    </button>
                ) : supportsMultiple ? (
                    // Has accounts and supports multiple - show Add another
                    <button
                        onClick={onConnect}
                        disabled={isConnecting}
                        className="border-border text-muted-foreground hover:border-primary/50 hover:text-foreground flex items-center gap-2 rounded-xl border-2 border-dashed px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
                    >
                        {isConnecting ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <>
                                <Plus className="h-4 w-4" />
                                Add another account
                            </>
                        )}
                    </button>
                ) : null}
            </div>
        </div>
    );
}
