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

    /**
     * Keywords that trigger proactive integration suggestions.
     *
     * When a user's query contains these keywords and the integration
     * isn't connected, we suggest connecting it.
     *
     * @example ["bitcoin", "crypto", "ethereum", "price"] for CoinMarketCap
     */
    suggestKeywords?: string[];
}

/**
 * Service Registry
 *
 * IMPORTANT: Services are sorted alphabetically by ID to minimize merge conflicts
 * when multiple integrations are added concurrently. When adding a new service,
 * insert it in alphabetical order rather than at the end.
 */
export const SERVICE_REGISTRY: ServiceDefinition[] = [
    // Asana - OAuth (in-house)
    {
        id: "asana",
        name: "Asana",
        description: "Manage tasks, projects, and track work",
        logo: "/logos/asana.svg",
        authMethod: "oauth",
        status: "beta",
        oauthProviderId: "asana",
        supportsMultipleAccounts: true,
        docsUrl: "https://developers.asana.com/reference",
        capabilities: [
            "search_tasks",
            "create_task",
            "update_task",
            "list_projects",
            "get_task",
            "add_comment",
        ],
        suggestKeywords: [
            "asana",
            "my tasks",
            "my to-do",
            "task list",
            "in asana",
            "assigned to me",
        ],
    },

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
        suggestKeywords: [
            "clickup",
            "my tasks",
            "my to-do",
            "my backlog",
            "in clickup",
        ],
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
        suggestKeywords: [
            "bitcoin",
            "ethereum",
            "crypto",
            "cryptocurrency",
            "btc",
            "eth",
            "solana",
            "sol",
            "market cap",
            "coin price",
            "token",
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
        suggestKeywords: ["dropbox", "files in dropbox", "my dropbox"],
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
        suggestKeywords: [
            "fireflies",
            "meeting transcript",
            "meeting recording",
            "zoom recording",
            "what was said in the meeting",
            "meeting notes from",
        ],
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
        suggestKeywords: [
            "my calendar",
            "google calendar",
            "schedule a meeting",
            "my schedule",
            "when am i free",
            "my contacts",
            "contact info for",
        ],
    },

    // Google Internal - OAuth (unverified, ALL scopes, internal testing only)
    // Uses "internal" status - separate GCP project that will never go through CASA audit
    // Users will see "This app isn't verified by Google" warning - expected
    // NOTE: No adapter exists - this is for OAuth token acquisition/testing only
    {
        id: "google-internal",
        name: "Google Workspace",
        description: "Access Gmail, Google Drive, Calendar, Contacts, and Photos",
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
        suggestKeywords: [
            "google sheet",
            "google doc",
            "google slides",
            "export to sheets",
            "create a spreadsheet",
            "create a doc",
        ],
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
        suggestKeywords: [
            "limitless",
            "pendant",
            "what did i say",
            "conversation",
            "recording",
            "what did we talk about",
        ],
    },

    // LinkedIn - OAuth (in-house)
    {
        id: "linkedin",
        name: "LinkedIn",
        description: "Share posts and access your LinkedIn profile",
        logo: "/logos/linkedin.svg",
        authMethod: "oauth",
        status: "available",
        oauthProviderId: "linkedin",
        supportsMultipleAccounts: true,
        docsUrl: "https://learn.microsoft.com/en-us/linkedin/",
        capabilities: ["get_profile", "create_post", "get_organization"],
        suggestKeywords: [
            "linkedin",
            "post to linkedin",
            "share on linkedin",
            "linkedin profile",
        ],
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
        suggestKeywords: [
            "notion",
            "my notes",
            "wiki",
            "documentation",
            "notion page",
            "notion database",
        ],
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
        suggestKeywords: ["quo", "send a text", "send an sms", "text message"],
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
        suggestKeywords: [
            "slack",
            "slack message",
            "slack channel",
            "post to slack",
            "in slack",
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
        suggestKeywords: [
            "spotify",
            "play some music",
            "my playlist",
            "what am i listening to",
            "currently playing",
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
        suggestKeywords: ["tweet", "twitter", "x post", "post to x", "timeline"],
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

/**
 * Integration suggestion with reason for why it would help.
 */
export interface IntegrationSuggestion {
    /** Service ID */
    serviceId: string;
    /** Service display name */
    serviceName: string;
    /** Brief description of the service */
    description: string;
    /** What keywords triggered this suggestion */
    matchedKeywords: string[];
}

/**
 * Find integrations that could enhance a query based on keyword matching.
 *
 * Returns unconnected services whose suggestKeywords match the query.
 * Used by the Concierge to suggest relevant integrations.
 *
 * Matching strategy:
 * - Multi-word phrases: substring match (e.g., "my calendar" matches "check my calendar")
 * - Single words: word boundary match to avoid false positives (e.g., "play" won't match "display")
 *
 * @param query - User's query text
 * @param connectedServiceIds - Set of service IDs the user has connected
 * @param maxSuggestions - Maximum number of suggestions to return (default 2)
 */
export function findSuggestableIntegrations(
    query: string,
    connectedServiceIds: Set<string>,
    maxSuggestions = 2
): IntegrationSuggestion[] {
    // Guard against empty queries
    if (!query || !query.trim()) {
        return [];
    }

    const queryLower = query.toLowerCase();
    const suggestions: IntegrationSuggestion[] = [];

    for (const service of SERVICE_REGISTRY) {
        // Skip if already connected, internal-only, or no keywords
        if (connectedServiceIds.has(service.id)) continue;
        if (service.status === "internal") continue;
        if (!service.suggestKeywords || service.suggestKeywords.length === 0) continue;

        // Check for keyword matches with appropriate strategy
        const matchedKeywords = service.suggestKeywords.filter((keyword) => {
            const keywordLower = keyword.toLowerCase();
            // Multi-word phrases: use substring match
            if (keywordLower.includes(" ")) {
                return queryLower.includes(keywordLower);
            }
            // Single words: use word boundary match to avoid false positives
            const wordBoundary = new RegExp(`\\b${escapeRegex(keywordLower)}\\b`, "i");
            return wordBoundary.test(query);
        });

        if (matchedKeywords.length > 0) {
            suggestions.push({
                serviceId: service.id,
                serviceName: service.name,
                description: service.description,
                matchedKeywords,
            });
        }
    }

    // Sort by number of matched keywords (most relevant first)
    suggestions.sort((a, b) => b.matchedKeywords.length - a.matchedKeywords.length);

    return suggestions.slice(0, maxSuggestions);
}

/**
 * Escapes special regex characters in a string.
 */
function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
