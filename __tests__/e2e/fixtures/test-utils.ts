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
 *
 * ## Mocking Chat API Responses
 *
 * For testing chat functionality without real LLM calls, use the mock-chat-api
 * fixtures. This enables deterministic, fast, and cost-free E2E testing:
 *
 * ```typescript
 * import { mockChatApi, createMockResponse, MOCK_RESPONSES } from "./mock-chat-api";
 *
 * test("chat displays response", async ({ page }) => {
 *     // Option 1: Build custom response
 *     await mockChatApi(page, createMockResponse()
 *         .withText("Hello from mock!")
 *         .withTitle("Test Chat"));
 *
 *     // Option 2: Use pre-built response
 *     await mockChatApi(page, MOCK_RESPONSES.greeting());
 *
 *     await page.goto("/connection/new/new");
 *     // ... test the UI
 * });
 * ```
 *
 * @see ./mock-chat-api.ts for the full API
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
