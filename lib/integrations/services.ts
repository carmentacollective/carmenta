/**
 * Service Registry - Single Source of Truth
 *
 * All external integrations are defined here. This registry controls:
 * - Which services are available in the UI
 * - Auth method (OAuth or API key)
 * - OAuth provider ID
 * - Rollout status (available, beta, internal)
 * - Service metadata (logos, descriptions, docs)
 *
 * SYNC REQUIREMENTS - When adding/removing services, also update:
 * - lib/tips/tips-config.ts (service-integrations tip mentions service count/names)
 */

export type AuthMethod = "oauth" | "api_key";

export type RolloutStatus =
    | "available" // Visible and usable by all users
    | "beta" // Only visible to users with showBetaIntegrations permission
    | "internal"; // Only visible to users with showInternalIntegrations permission (Gmail, etc.)

export interface ServiceDefinition {
    /** Unique service identifier (e.g., "notion", "giphy") */
    id: string;

    /** Display name (e.g., "Notion", "Giphy") */
    name: string;

    /** Short description for UI */
    description: string;

    /** Path to logo in /public/logos/ */
    logo: string;

    /** Authentication method */
    authMethod: AuthMethod;

    /** Rollout status for progressive deployment */
    status: RolloutStatus;

    /** OAuth provider ID */
    oauthProviderId?: string;

    /** URL where users can get an API key */
    getApiKeyUrl?: string;

    /** Placeholder text for API key input */
    apiKeyPlaceholder?: string;

    /** Whether service supports multiple accounts per user */
    supportsMultipleAccounts?: boolean;

    /** Documentation URL for the service */
    docsUrl?: string;

    /** Brief capability summary for tool description */
    capabilities?: string[];
}

/**
 * Service Registry
 *
 * IMPORTANT: Services are sorted alphabetically by ID to minimize merge conflicts
 * when multiple integrations are added concurrently. When adding a new service,
 * insert it in alphabetical order rather than at the end.
 */
export const SERVICE_REGISTRY: ServiceDefinition[] = [
    // ClickUp - OAuth (in-house)
    {
        id: "clickup",
        name: "ClickUp",
        description: "Manage tasks, projects, and workspaces",
        logo: "/logos/clickup.svg",
        authMethod: "oauth",
        status: "available",
        oauthProviderId: "clickup",
        supportsMultipleAccounts: true,
        docsUrl: "https://clickup.com/api",
        capabilities: ["list_tasks", "create_task", "update_task", "list_spaces"],
    },

    // CoinMarketCap - API Key
    {
        id: "coinmarketcap",
        name: "CoinMarketCap",
        description: "Cryptocurrency market data and pricing",
        logo: "/logos/coinmarketcap.svg",
        authMethod: "api_key",
        status: "available",
        getApiKeyUrl: "https://coinmarketcap.com/api/",
        apiKeyPlaceholder: "Enter your CoinMarketCap API key",
        supportsMultipleAccounts: false,
        docsUrl: "https://coinmarketcap.com/api/documentation/v1/",
        capabilities: [
            "get_listings",
            "get_quotes",
            "get_crypto_info",
            "convert_price",
        ],
    },

    // Dropbox - OAuth (in-house)
    {
        id: "dropbox",
        name: "Dropbox",
        description: "Access files and folders in your Dropbox",
        logo: "/logos/dropbox.svg",
        authMethod: "oauth",
        status: "beta",
        oauthProviderId: "dropbox",
        supportsMultipleAccounts: true,
        docsUrl: "https://www.dropbox.com/developers/documentation",
        capabilities: [
            "list_folder",
            "search_files",
            "download_file",
            "create_folder",
            "move",
            "delete",
            "create_shared_link",
        ],
    },

    // Fireflies.ai - API Key
    {
        id: "fireflies",
        name: "Fireflies.ai",
        description: "Search and analyze meeting transcripts",
        logo: "/logos/fireflies.svg",
        authMethod: "api_key",
        status: "available",
        getApiKeyUrl: "https://app.fireflies.ai/settings",
        apiKeyPlaceholder: "Enter your Fireflies API key",
        supportsMultipleAccounts: false,
        docsUrl: "https://docs.fireflies.ai/",
        capabilities: ["list_transcripts", "search_transcripts", "get_transcript"],
    },

    // Google Calendar + Contacts - OAuth (in-house, "sensitive" scopes tier)
    {
        id: "google-calendar-contacts",
        name: "Google Calendar & Contacts",
        description: "Manage calendar events and contacts via Google",
        logo: "/logos/google-calendar-contacts.svg",
        authMethod: "oauth",
        status: "available",
        oauthProviderId: "google-calendar-contacts",
        supportsMultipleAccounts: true,
        docsUrl: "https://developers.google.com/workspace",
        capabilities: [
            "list_events",
            "create_event",
            "search_contacts",
            "list_calendars",
        ],
    },

    // Google Internal - OAuth (unverified, ALL scopes, internal testing only)
    // Uses "internal" status - separate GCP project that will never go through CASA audit
    // Users will see "This app isn't verified by Google" warning - expected
    // NOTE: No adapter exists - this is for OAuth token acquisition/testing only
    {
        id: "google-internal",
        name: "Google (Full Access - Internal)",
        description:
            "Full Google access for internal testing only (OAuth token acquisition)",
        logo: "/logos/google-internal.svg",
        authMethod: "oauth",
        status: "internal",
        oauthProviderId: "google-internal",
        supportsMultipleAccounts: true,
        docsUrl: "https://developers.google.com/workspace",
        // No capabilities - no adapter exists. This is for OAuth testing only.
    },

    // Google Sheets/Docs/Slides - OAuth (in-house, "non-sensitive" drive.file scope)
    {
        id: "google-workspace-files",
        name: "Google Sheets/Docs/Slides",
        description:
            "Create and work with Sheets, Docs, and Slides in your Carmenta workspace",
        logo: "/logos/google-workspace-files.svg",
        authMethod: "oauth",
        status: "available",
        oauthProviderId: "google-workspace-files",
        supportsMultipleAccounts: true,
        docsUrl: "https://developers.google.com/workspace",
        capabilities: ["create_sheet", "create_doc", "read_sheet", "open_picker"],
    },

    // Limitless - API Key
    {
        id: "limitless",
        name: "Limitless",
        description: "Search conversations from your Limitless Pendant",
        logo: "/logos/limitless.svg",
        authMethod: "api_key",
        status: "available",
        getApiKeyUrl: "https://www.limitless.ai/developers",
        apiKeyPlaceholder: "Enter your Limitless API key",
        supportsMultipleAccounts: false,
        docsUrl: "https://www.limitless.ai/developers",
        capabilities: ["search", "list_recordings", "get_transcript"],
    },

    // Notion - OAuth (in-house)
    {
        id: "notion",
        name: "Notion",
        description: "Search, read, and manage your Notion workspace",
        logo: "/logos/notion.svg",
        authMethod: "oauth",
        status: "available",
        oauthProviderId: "notion",
        supportsMultipleAccounts: true,
        docsUrl: "https://developers.notion.com/",
        capabilities: ["search_pages", "get_page", "create_page", "update_page"],
    },

    // Quo (formerly OpenPhone) - API Key
    {
        id: "quo",
        name: "Quo",
        description: "Business phone system for SMS messaging and calls",
        logo: "/logos/quo.svg",
        authMethod: "api_key",
        status: "beta",
        getApiKeyUrl: "https://my.quo.com/settings/api",
        apiKeyPlaceholder: "Enter your Quo API key",
        supportsMultipleAccounts: false,
        docsUrl: "https://my.quo.com/settings/api",
        capabilities: [
            "list_messages",
            "send_message",
            "list_calls",
            "list_contacts",
            "list_phone_numbers",
        ],
    },

    // Slack - OAuth (in-house)
    {
        id: "slack",
        name: "Slack",
        description: "Send messages and interact with your Slack workspace",
        logo: "/logos/slack.svg",
        authMethod: "oauth",
        status: "beta",
        oauthProviderId: "slack",
        supportsMultipleAccounts: true,
        docsUrl: "https://api.slack.com/methods",
        capabilities: [
            "list_channels",
            "get_channel_history",
            "send_message",
            "get_user_info",
            "list_users",
            "add_reaction",
        ],
    },

    // Spotify - OAuth (in-house)
    {
        id: "spotify",
        name: "Spotify",
        description: "Music discovery, playback control, and listening insights",
        logo: "/logos/spotify.svg",
        authMethod: "oauth",
        status: "available",
        oauthProviderId: "spotify",
        supportsMultipleAccounts: true,
        docsUrl: "https://developer.spotify.com/documentation/web-api",
        capabilities: [
            "search",
            "get_currently_playing",
            "play",
            "pause",
            "get_top_items",
            "list_playlists",
        ],
    },

    // Twitter/X - OAuth (in-house)
    {
        id: "twitter",
        name: "X (Twitter)",
        description: "Post tweets and manage your X timeline",
        logo: "/logos/twitter.svg",
        authMethod: "oauth",
        status: "beta",
        oauthProviderId: "twitter",
        supportsMultipleAccounts: true,
        docsUrl: "https://developer.twitter.com/en/docs/twitter-api",
        capabilities: [
            "post_tweet",
            "get_user_timeline",
            "search_tweets",
            "like_tweet",
            "retweet",
        ],
    },
];

/**
 * Get a service definition by ID
 */
export function getServiceById(id: string): ServiceDefinition | undefined {
    return SERVICE_REGISTRY.find((s) => s.id === id);
}

/**
 * Get all services available for a given rollout level
 */
export function getAvailableServices(includeInternal = false): ServiceDefinition[] {
    return SERVICE_REGISTRY.filter((s) => {
        if (s.status === "internal" && !includeInternal) return false;
        return true;
    });
}

/**
 * Get OAuth services
 */
export function getOAuthServices(): ServiceDefinition[] {
    return SERVICE_REGISTRY.filter((s) => s.authMethod === "oauth");
}

/**
 * Get API key services
 */
export function getApiKeyServices(): ServiceDefinition[] {
    return SERVICE_REGISTRY.filter((s) => s.authMethod === "api_key");
}

/**
 * Check if a service uses OAuth authentication
 */
export function isOAuthService(serviceId: string): boolean {
    const service = getServiceById(serviceId);
    return service?.authMethod === "oauth";
}

/**
 * Check if a service uses API key authentication
 */
export function isApiKeyService(serviceId: string): boolean {
    const service = getServiceById(serviceId);
    return service?.authMethod === "api_key";
}

/**
 * Get all service IDs (for validation schemas)
 * Include beta services by default since admin users may need them.
 */
export function getAvailableServiceIds(includeInternal = true): string[] {
    return SERVICE_REGISTRY.filter((s) => {
        if (s.status === "internal" && !includeInternal) return false;
        return true;
    }).map((s) => s.id);
}

/**
 * Get OAuth provider ID for a service
 * Returns undefined if service doesn't use OAuth.
 */
export function getOAuthProviderId(serviceId: string): string | undefined {
    const service = getServiceById(serviceId);
    return service?.oauthProviderId;
}
