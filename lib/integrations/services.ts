/**
 * Service Registry - Single Source of Truth
 *
 * All external integrations are defined here. This registry controls:
 * - Which services are available in the UI
 * - Auth method (OAuth via Nango or API key)
 * - Rollout status (available, beta, internal)
 * - Service metadata (logos, descriptions, docs)
 */

export type AuthMethod = "oauth" | "api_key";

export type RolloutStatus =
    | "available" // Visible and usable by all users
    | "beta" // Only visible to users with showBetaIntegrations permission
    | "internal"; // Only visible to users with showInternalIntegrations permission

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

    /** Nango integration key for OAuth services */
    nangoIntegrationKey?: string;

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
 * Add new services here. The order determines display order in the UI.
 */
export const SERVICE_REGISTRY: ServiceDefinition[] = [
    // OAuth Services (via Nango)
    {
        id: "notion",
        name: "Notion",
        description: "Search, read, and manage your Notion workspace",
        logo: "/logos/notion.svg",
        authMethod: "oauth",
        status: "beta",
        nangoIntegrationKey: "notion",
        supportsMultipleAccounts: true,
        docsUrl: "https://developers.notion.com/",
        capabilities: ["search_pages", "get_page", "create_page", "update_page"],
    },
    {
        id: "clickup",
        name: "ClickUp",
        description: "Manage tasks, projects, and workspaces",
        logo: "/logos/clickup.svg",
        authMethod: "oauth",
        status: "beta",
        nangoIntegrationKey: "clickup",
        supportsMultipleAccounts: true,
        docsUrl: "https://clickup.com/api",
        capabilities: ["list_tasks", "create_task", "update_task", "list_spaces"],
    },
    {
        id: "dropbox",
        name: "Dropbox",
        description: "Access files and folders in your Dropbox",
        logo: "/logos/dropbox.svg",
        authMethod: "oauth",
        status: "beta",
        nangoIntegrationKey: "dropbox",
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

    // API Key Services
    {
        id: "giphy",
        name: "Giphy",
        description: "Search for GIFs and stickers",
        logo: "/logos/giphy.svg",
        authMethod: "api_key",
        status: "available",
        getApiKeyUrl: "https://developers.giphy.com/",
        apiKeyPlaceholder: "Enter your Giphy API key",
        supportsMultipleAccounts: false,
        docsUrl: "https://developers.giphy.com/docs/api",
        capabilities: ["search", "get_trending", "get_random"],
    },
    {
        id: "fireflies",
        name: "Fireflies.ai",
        description: "Search and analyze meeting transcripts",
        logo: "/logos/fireflies.svg",
        authMethod: "api_key",
        status: "available",
        getApiKeyUrl: "https://app.fireflies.ai/integrations/custom/api",
        apiKeyPlaceholder: "Enter your Fireflies API key",
        supportsMultipleAccounts: false,
        docsUrl: "https://docs.fireflies.ai/",
        capabilities: ["list_transcripts", "search_transcripts", "get_transcript"],
    },
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
 * Get services that can be connected
 */
export function getConnectableServices(includeInternal = false): ServiceDefinition[] {
    return SERVICE_REGISTRY.filter((s) => {
        if (s.status === "internal" && !includeInternal) return false;
        return true;
    });
}

/**
 * Get OAuth services (for Nango integration)
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
