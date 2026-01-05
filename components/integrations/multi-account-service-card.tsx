"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
    Check,
    Warning,
    CircleNotch,
    CheckCircle,
    XCircle,
    Plus,
    Star,
    ShieldCheck,
    LinkBreak,
    ArrowsClockwise,
} from "@phosphor-icons/react";
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
 * Priority: email (accountId with @) > accountDisplayName > accountId > "Account"
 * Email is prioritized because it distinguishes between multiple accounts with the same name.
 */
function getAccountLabel(account: GroupedAccount): string {
    if (account.accountId.includes("@")) {
        return account.accountId;
    }
    if (account.accountDisplayName) {
        return account.accountDisplayName;
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
                icon: Warning,
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
    const [confirmingDisconnect, setConfirmingDisconnect] = useState<string | null>(
        null
    );

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

            {/* Accounts List - Two-line row pattern */}
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
                                    "bg-muted/30 rounded-xl px-4 py-3",
                                    needsAttention && "bg-amber-500/10"
                                )}
                            >
                                {/* Line 1: Status + Full email (no truncation competition) */}
                                <div className="flex items-center gap-2">
                                    {statusIndicator && (
                                        <div
                                            className={cn(
                                                "flex flex-shrink-0 items-center justify-center rounded-full p-1",
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
                                    <span className="text-foreground text-sm font-medium">
                                        {getAccountLabel(account)}
                                    </span>
                                </div>

                                {/* Line 2: Status text/badge + Actions */}
                                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                                    {/* Left: Status or default badge */}
                                    <div className="flex items-center gap-2">
                                        {needsAttention ? (
                                            <span className="text-xs text-amber-600 dark:text-amber-400">
                                                {account.status === "expired"
                                                    ? "Authorization expired"
                                                    : "Needs attention"}
                                            </span>
                                        ) : account.isDefault ? (
                                            <span className="text-primary flex items-center gap-1 text-xs font-medium">
                                                <Star
                                                    className="h-3 w-3"
                                                    weight="fill"
                                                />
                                                Default account
                                            </span>
                                        ) : (
                                            <span className="text-muted-foreground text-xs">
                                                Connected
                                            </span>
                                        )}

                                        {/* Status message inline */}
                                        {statusMessage?.accountId ===
                                            account.accountId && (
                                            <span
                                                className={cn(
                                                    "flex items-center gap-1 text-xs font-medium",
                                                    statusMessage.type === "success"
                                                        ? "text-green-600 dark:text-green-400"
                                                        : "text-red-600 dark:text-red-400"
                                                )}
                                            >
                                                {statusMessage.type === "success" ? (
                                                    <CheckCircle className="h-3 w-3" />
                                                ) : (
                                                    <XCircle className="h-3 w-3" />
                                                )}
                                                {statusMessage.text}
                                            </span>
                                        )}
                                    </div>

                                    {/* Right: Action buttons with icons */}
                                    <div className="flex items-center gap-1">
                                        {needsAttention ? (
                                            <button
                                                onClick={() =>
                                                    onReconnect?.(account.accountId)
                                                }
                                                disabled={isLoading}
                                                className="flex items-center gap-1.5 rounded-lg border border-amber-400/60 bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-500/25 disabled:opacity-50 dark:text-amber-400"
                                            >
                                                {isReconnecting ? (
                                                    <CircleNotch className="h-3.5 w-3.5 animate-spin" />
                                                ) : (
                                                    <ArrowsClockwise className="h-3.5 w-3.5" />
                                                )}
                                                <span className="hidden sm:inline">
                                                    Reconnect
                                                </span>
                                            </button>
                                        ) : (
                                            <>
                                                {!account.isDefault && onSetDefault && (
                                                    <button
                                                        onClick={() =>
                                                            onSetDefault(
                                                                account.accountId
                                                            )
                                                        }
                                                        disabled={isLoading}
                                                        className="text-muted-foreground hover:bg-muted hover:text-foreground flex items-center gap-1 rounded-lg px-2 py-1 text-xs transition-colors disabled:opacity-50"
                                                    >
                                                        <Star className="h-3.5 w-3.5" />
                                                        <span className="hidden sm:inline">
                                                            Set default
                                                        </span>
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() =>
                                                        onTest?.(account.accountId)
                                                    }
                                                    disabled={isLoading}
                                                    className="text-muted-foreground hover:bg-muted hover:text-foreground flex items-center gap-1 rounded-lg px-2 py-1 text-xs transition-colors disabled:opacity-50"
                                                >
                                                    {isTesting ? (
                                                        <CircleNotch className="h-3.5 w-3.5 animate-spin" />
                                                    ) : (
                                                        <ShieldCheck className="h-3.5 w-3.5" />
                                                    )}
                                                    <span className="hidden sm:inline">
                                                        Verify
                                                    </span>
                                                </button>
                                            </>
                                        )}

                                        {/* Disconnect with confirmation */}
                                        {confirmingDisconnect === account.accountId ? (
                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={() =>
                                                        setConfirmingDisconnect(null)
                                                    }
                                                    className="text-muted-foreground hover:text-foreground rounded-lg px-2 py-1 text-xs transition-colors"
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        onDisconnect?.(
                                                            account.accountId
                                                        );
                                                        setConfirmingDisconnect(null);
                                                    }}
                                                    disabled={isLoading}
                                                    className="flex items-center gap-1 rounded-lg bg-red-500/15 px-2 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-500/25 disabled:opacity-50 dark:text-red-400"
                                                >
                                                    <LinkBreak className="h-3.5 w-3.5" />
                                                    Confirm
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() =>
                                                    setConfirmingDisconnect(
                                                        account.accountId
                                                    )
                                                }
                                                disabled={isLoading}
                                                className="text-muted-foreground flex items-center gap-1 rounded-lg px-2 py-1 text-xs transition-colors hover:bg-red-500/10 hover:text-red-600 disabled:opacity-50"
                                            >
                                                <LinkBreak className="h-3.5 w-3.5" />
                                                <span className="hidden sm:inline">
                                                    Disconnect
                                                </span>
                                            </button>
                                        )}
                                    </div>
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
                        className="bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-medium shadow-sm transition-all hover:shadow-md disabled:opacity-50"
                    >
                        {isConnecting ? (
                            <CircleNotch className="h-4 w-4 animate-spin" />
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
                            <CircleNotch className="h-4 w-4 animate-spin" />
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
