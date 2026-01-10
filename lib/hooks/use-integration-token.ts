"use client";

import { useState, useCallback } from "react";

import { logger } from "@/lib/client-logger";

interface IntegrationTokenResult {
    accessToken: string;
    accountId: string;
    accountDisplayName?: string;
}

interface UseIntegrationTokenReturn {
    /** Fetch the access token for a service */
    fetchToken: (service: string) => Promise<IntegrationTokenResult | null>;
    /** Whether a token fetch is in progress */
    isLoading: boolean;
    /** Any error that occurred */
    error: string | null;
}

/**
 * Hook to fetch OAuth access tokens for connected integrations
 *
 * Used by client-side components that need to authenticate with external APIs
 * (e.g., Google Picker).
 *
 * @example
 * ```tsx
 * const { fetchToken, isLoading, error } = useIntegrationToken();
 *
 * const handleOpenPicker = async () => {
 *   const result = await fetchToken('google-workspace-files');
 *   if (result) {
 *     // Use result.accessToken with Google Picker
 *   }
 * };
 * ```
 */
export function useIntegrationToken(): UseIntegrationTokenReturn {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchToken = useCallback(
        async (service: string): Promise<IntegrationTokenResult | null> => {
            setIsLoading(true);
            setError(null);

            // Add timeout to prevent hanging on slow/failed requests
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);

            try {
                const response = await fetch(`/api/integrations/${service}/token`, {
                    signal: controller.signal,
                });
                clearTimeout(timeoutId);
                const data = await response.json();

                if (!response.ok) {
                    const message = data.error || "Failed to get access token";
                    setError(message);
                    logger.warn(
                        { service, error: message },
                        "Failed to fetch integration token"
                    );
                    return null;
                }

                logger.info(
                    { service, accountId: data.accountId },
                    "Integration token fetched"
                );
                return {
                    accessToken: data.accessToken,
                    accountId: data.accountId,
                    accountDisplayName: data.accountDisplayName,
                };
            } catch (err) {
                clearTimeout(timeoutId);
                // Provide user-friendly message for timeout
                const isAborted = err instanceof Error && err.name === "AbortError";
                const message = isAborted
                    ? "Request timed out"
                    : err instanceof Error
                      ? err.message
                      : "Network error";
                setError(message);
                logger.error(
                    { service, error: err, isAborted },
                    "Failed to fetch integration token"
                );
                return null;
            } finally {
                setIsLoading(false);
            }
        },
        []
    );

    return {
        fetchToken,
        isLoading,
        error,
    };
}
