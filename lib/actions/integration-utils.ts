/**
 * Integration Utilities
 *
 * Pure utility functions for integration categorization.
 * These are separated from the server actions file to avoid
 * Next.js "use server" directive issues with synchronous functions.
 */

import type { ServiceDefinition } from "@/lib/integrations/services";
import type { IntegrationStatus } from "@/lib/integrations/types";

/**
 * Account info from listServiceAccounts
 */
export interface ServiceAccount {
    accountId: string;
    accountDisplayName?: string;
    isDefault: boolean;
    status: IntegrationStatus;
    connectedAt: Date;
}

/**
 * Connected service with status and account info
 */
export interface ConnectedService {
    service: ServiceDefinition;
    status: IntegrationStatus;
    accountDisplayName: string | null;
    accountId: string;
    isDefault: boolean;
    connectedAt: Date;
}

/**
 * Account within a grouped service
 */
export interface GroupedAccount {
    accountId: string;
    accountDisplayName: string | null;
    isDefault: boolean;
    status: IntegrationStatus;
    connectedAt: Date;
}

/**
 * Service with all its accounts grouped together.
 * Used for the multi-account card UI where one card shows all accounts for a service.
 */
export interface GroupedService {
    service: ServiceDefinition;
    accounts: GroupedAccount[];
    /** Aggregate status: ERROR if any account has error, EXPIRED if any expired, else CONNECTED */
    aggregateStatus: IntegrationStatus | null;
}

/**
 * Get aggregate status for a service based on all its accounts.
 * Priority: ERROR > EXPIRED > CONNECTED
 */
export function getAggregateStatus(
    accounts: GroupedAccount[]
): IntegrationStatus | null {
    if (accounts.length === 0) return null;

    const hasError = accounts.some((a) => a.status === "error");
    if (hasError) return "error";

    const hasExpired = accounts.some((a) => a.status === "expired");
    if (hasExpired) return "expired";

    const hasConnected = accounts.some((a) => a.status === "connected");
    if (hasConnected) return "connected";

    return "disconnected";
}

/**
 * Group accounts by service for the multi-account card UI.
 */
export function groupServiceAccounts(
    service: ServiceDefinition,
    accounts: ServiceAccount[]
): GroupedService {
    const groupedAccounts: GroupedAccount[] = accounts.map((account) => ({
        accountId: account.accountId,
        accountDisplayName: account.accountDisplayName ?? null,
        isDefault: account.isDefault,
        status: account.status,
        connectedAt: account.connectedAt,
    }));

    // Sort: default first, then by most recently connected
    groupedAccounts.sort((a, b) => {
        if (a.isDefault && !b.isDefault) return -1;
        if (!a.isDefault && b.isDefault) return 1;
        return b.connectedAt.getTime() - a.connectedAt.getTime();
    });

    return {
        service,
        accounts: groupedAccounts,
        aggregateStatus: getAggregateStatus(groupedAccounts),
    };
}

/**
 * Categorize a service into connected or available based on its accounts.
 *
 * A service goes in "connected" if it has ANY accounts (regardless of status).
 * Users need to see error/expired/disconnected accounts to manage them.
 * A service only goes in "available" if it has NO accounts at all.
 */
export function categorizeService(
    service: ServiceDefinition,
    accounts: ServiceAccount[]
): { connected: ConnectedService[]; isAvailable: boolean } {
    if (accounts.length === 0) {
        return { connected: [], isAvailable: true };
    }

    const connected = accounts.map((account) => ({
        service,
        status: account.status,
        accountDisplayName: account.accountDisplayName ?? null,
        accountId: account.accountId,
        isDefault: account.isDefault,
        connectedAt: account.connectedAt,
    }));

    return { connected, isAvailable: false };
}
