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
