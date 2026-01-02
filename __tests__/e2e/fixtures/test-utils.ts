/**
 * E2E Test Utilities and Shared Constants
 *
 * Common constants for E2E tests. Keep this minimal - tests should use
 * Playwright's built-in auto-waiting and assertions rather than custom helpers.
 *
 * Philosophy:
 * - Playwright auto-waits for elements, so explicit waits are rarely needed
 * - Use config-level timeouts, not per-test overrides
 * - Prefer getByRole/getByTestId over CSS selectors
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
 * Used to detect internal hostname leaks (e.g., Render's srv-xxx:10000)
 */
export const URL_PATTERNS = {
    publicDomain: /^https?:\/\/(localhost|carmenta\.ai)/,
    internalHostname: /srv-[a-z0-9-]+:[0-9]+/,
    signIn: /sign-in/,
} as const;
