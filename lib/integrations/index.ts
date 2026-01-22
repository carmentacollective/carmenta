/**
 * External Integrations
 *
 * This module provides the foundation for connecting to external services.
 *
 * Usage:
 * ```ts
 * import { getCredentials, getConnectedServices } from "@/lib/integrations";
 * import { SERVICE_REGISTRY, getServiceById } from "@/lib/integrations/services";
 * import { ServiceAdapter } from "@/lib/integrations/adapters/base";
 * ```
 */

// Connection management
export {
    getCredentials,
    listServiceAccounts,
    getConnectionStatus,
    disconnectService,
    getDefaultAccount,
    hasConnection,
    getConnectedServices,
} from "./connection-manager";

// Service registry
export {
    SERVICE_REGISTRY,
    getServiceById,
    getAvailableServices,
    getOAuthServices,
    getApiKeyServices,
    type ServiceDefinition,
    type AuthMethod,
    type RolloutStatus,
} from "./services";

// Encryption
export {
    encryptCredentials,
    decryptCredentials,
    isApiKeyCredentials,
    isBearerTokenCredentials,
    type Credentials,
    type ApiKeyCredentials,
    type BearerTokenCredentials,
} from "./encryption";

// Adapters
export {
    ServiceAdapter,
    ClickUpAdapter,
    FirefliesAdapter,
    LimitlessAdapter,
    NotionAdapter,
} from "./adapters";

// Tools factory for Vercel AI SDK
export {
    getIntegrationTools,
    getPermissionsByEmail,
    type IntegrationPermissions,
} from "./tools";

// Types
export type {
    IntegrationStatus,
    CredentialType,
    Integration,
    IntegrationWithService,
    ConnectionCredentials,
    ConnectResult,
    ToolAnnotations,
    OperationParameter,
    HelpOperation,
    HelpResponse,
    AdapterResponse,
    RawAPIParams,
    ValidationResult,
} from "./types";
