/**
 * E2E Test Utilities and Shared Helpers
 *
 * Common constants and helper functions for E2E tests.
 */

/**
 * Standard viewport sizes for responsive testing
 */
export const VIEWPORTS = {
    mobile: { width: 375, height: 667 },
    tablet: { width: 768, height: 1024 },
    desktop: { width: 1440, height: 900 },
} as const;

/**
 * Domain patterns for URL validation
 */
export const URL_PATTERNS = {
    publicDomain: /^https?:\/\/(localhost|carmenta\.ai)/,
    internalHostname: /srv-[a-z0-9-]+:[0-9]+/,
    signIn: /sign-in/,
} as const;

/**
 * Common wait timeouts (in milliseconds)
 */
export const TIMEOUTS = {
    redirect: 10000,
    networkIdle: 30000,
} as const;
