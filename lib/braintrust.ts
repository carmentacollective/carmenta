/**
 * Braintrust Integration
 *
 * Shared Braintrust utilities for evals.
 * Production tracing can be added as a follow-up once we validate the eval framework.
 *
 * Set BRAINTRUST_API_KEY in .env.local to enable Braintrust features.
 */

import { env } from "@/lib/env";

/**
 * Check if Braintrust is configured and available
 */
export function isBraintrustEnabled(): boolean {
    return !!env.BRAINTRUST_API_KEY;
}
