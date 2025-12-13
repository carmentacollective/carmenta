/**
 * PostHog Analytics Instrumentation
 *
 * Initializes PostHog analytics using the latest 2025 methodology for Next.js.
 * This file is automatically loaded by Next.js 16+ for client-side instrumentation.
 */

import posthog from "posthog-js";

// Only initialize PostHog in production to avoid dev traffic
if (
    process.env.NODE_ENV === "production" &&
    process.env.NEXT_PUBLIC_POSTHOG_KEY &&
    process.env.NEXT_PUBLIC_POSTHOG_HOST
) {
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
        // Latest 2025 default: automatically handles $pageview and $pageleave events
        defaults: "2025-11-30",
        // Capture errors and console logs for better debugging
        capture_pageview: false, // Handled by defaults above
        capture_pageleave: false, // Handled by defaults above
    });
}

export { posthog };
