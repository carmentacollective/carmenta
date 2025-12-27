/**
 * PostHog Analytics Events
 *
 * Typed event tracking for user behavior analytics.
 * All events are only captured in production to avoid dev noise.
 *
 * Usage:
 * ```ts
 * import { analytics } from "@/lib/analytics/events";
 *
 * analytics.integration.connected({ serviceId: "gmail", authMethod: "oauth" });
 * analytics.kb.documentViewed({ path: "profile.character", section: "about" });
 * ```
 */

import { posthog } from "@/instrumentation-client";

const isProduction = process.env.NODE_ENV === "production";

/**
 * Safely capture an event - only in production
 */
function capture<T extends object>(event: string, properties?: T) {
    if (!isProduction) return;
    posthog.capture(event, properties as Record<string, unknown>);
}

// ============================================================================
// Integration Events
// ============================================================================

interface IntegrationBaseProps {
    serviceId: string;
    serviceName?: string;
}

interface IntegrationConnectProps extends IntegrationBaseProps {
    authMethod: "oauth" | "api_key";
}

interface IntegrationErrorProps extends IntegrationBaseProps {
    errorCode?: string;
    errorMessage?: string;
}

interface IntegrationTestProps extends IntegrationBaseProps {
    durationMs?: number;
}

const integration = {
    /** User clicked connect button for a service */
    connectClicked: (props: IntegrationConnectProps) =>
        capture("integration_connect_clicked", props),

    /** OAuth flow started (redirect to provider) */
    oauthStarted: (props: IntegrationBaseProps) =>
        capture("integration_oauth_started", props),

    /** OAuth completed successfully */
    oauthCompleted: (props: IntegrationBaseProps) =>
        capture("integration_oauth_completed", props),

    /** OAuth failed with error */
    oauthFailed: (props: IntegrationErrorProps) =>
        capture("integration_oauth_failed", props),

    /** API key connection successful */
    apiKeyConnected: (props: IntegrationBaseProps) =>
        capture("integration_apikey_connected", props),

    /** API key connection failed */
    apiKeyFailed: (props: IntegrationErrorProps) =>
        capture("integration_apikey_failed", props),

    /** User tested connection */
    testExecuted: (props: IntegrationBaseProps) =>
        capture("integration_test_executed", props),

    /** Connection test passed */
    testPassed: (props: IntegrationTestProps) =>
        capture("integration_test_passed", props),

    /** Connection test failed */
    testFailed: (props: IntegrationErrorProps) =>
        capture("integration_test_failed", props),

    /** User disconnected a service */
    disconnected: (props: IntegrationBaseProps) =>
        capture("integration_disconnected", props),

    /** Abandoned OAuth flow detected */
    abandonedFlowDetected: (props: IntegrationBaseProps) =>
        capture("integration_abandoned_flow_detected", props),
};

// ============================================================================
// Knowledge Base Events
// ============================================================================

interface KBBaseProps {
    path: string;
    section?: string; // "about" | "communication" | "memories"
}

interface KBDocumentProps extends KBBaseProps {
    documentName?: string;
    documentType?: string;
}

interface KBSaveProps extends KBDocumentProps {
    contentLength?: number;
    durationMs?: number;
}

interface KBSearchProps {
    query: string;
    resultCount?: number;
    section?: string;
}

const kb = {
    /** User viewed a document */
    documentViewed: (props: KBDocumentProps) => capture("kb_document_viewed", props),

    /** User saved changes to a document */
    documentSaved: (props: KBSaveProps) => capture("kb_document_saved", props),

    /** User navigated to a folder */
    folderViewed: (props: { folderId: string; folderName: string }) =>
        capture("kb_folder_viewed", props),

    /** User searched documents */
    searched: (props: KBSearchProps) => capture("kb_searched", props),

    /** First-time KB profile initialization */
    profileInitialized: () => capture("kb_profile_initialized"),
};

// ============================================================================
// Onboarding / Auth Events
// ============================================================================

interface AuthBaseProps {
    isReturningUser?: boolean;
}

interface AuthMethodProps extends AuthBaseProps {
    method?: string; // "oauth_google", "magic_link", etc.
}

const auth = {
    /** User landed on sign-in page */
    signInPageViewed: (props: AuthBaseProps) =>
        capture("auth_signin_page_viewed", props),

    /** Returning user recognized (email remembered) */
    returningUserDetected: () => capture("auth_returning_user_detected"),

    /** User completed sign-in */
    signInCompleted: (props: AuthMethodProps) =>
        capture("auth_signin_completed", props),
};

// ============================================================================
// Feature Usage Events
// ============================================================================

interface FeatureProps {
    feature: string;
    context?: string;
}

const feature = {
    /** Generic feature used event for tracking adoption */
    used: (props: FeatureProps) => capture("feature_used", props),
};

// ============================================================================
// Export unified analytics object
// ============================================================================

export const analytics = {
    integration,
    kb,
    auth,
    feature,
    /** Raw capture for edge cases - prefer typed methods above */
    capture,
};
