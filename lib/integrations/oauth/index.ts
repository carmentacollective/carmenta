/**
 * OAuth Module
 *
 * In-house OAuth implementation replacing Nango.
 * Handles token exchange, storage, refresh, and CSRF protection.
 */

// Types
export type {
    OAuthTokenSet,
    OAuthState,
    OAuthProviderConfig,
    TokenExchangeResult,
    OAuthError,
} from "./types";
export { isOAuthError } from "./types";

// State management
export { generateState, validateState, cleanupExpiredStates } from "./state";

// Token management
export {
    exchangeCodeForTokens,
    storeTokens,
    getAccessToken,
    getTokenSet,
} from "./tokens";

// Provider registry
export {
    getProvider,
    isOAuthProvider,
    getOAuthProviderIds,
    buildAuthorizationUrl,
    NOTION_API_BASE,
    NOTION_API_VERSION,
} from "./providers";
