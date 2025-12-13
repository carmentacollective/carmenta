/**
 * Google Calendar + Contacts Adapter
 *
 * Access to Google Calendar and Contacts (People API) via Nango proxy.
 * Uses "sensitive" OAuth scopes (Calendar + Contacts).
 *
 * ## Scope Tier
 * This is the "sensitive scopes" tier of Google OAuth:
 * - Login (Clerk): basic profile/email
 * - Sensitive (this): Calendar + Contacts
 * - Restricted (future): Drive, Photos, etc.
 *
 * ## API Hierarchy
 * - Calendar: CalendarList → Calendar → Events
 * - Contacts: People (contacts) and ContactGroups
 *
 * ## Scopes Required
 * - Calendar: https://www.googleapis.com/auth/calendar (read/write)
 * - Contacts: https://www.googleapis.com/auth/contacts (read/write)
 *
 * ## Code-Relevant Gotchas
 * - Calendar IDs are email-like strings (primary, user@gmail.com, or calendar IDs)
 * - People API resource names use format: "people/{id}" or "people/me"
 * - Event times use RFC3339 format with timezone
 * - People API requires "warmup" search request before real searches
 * - Batch operations limited to 200 contacts
 */

import { ServiceAdapter, HelpResponse, MCPToolResponse, RawAPIParams } from "./base";
import { getCredentials } from "@/lib/integrations/connection-manager";
import { httpClient } from "@/lib/http-client";
import { env } from "@/lib/env";
import { ValidationError } from "@/lib/errors";
import { logger } from "@/lib/logger";

/** Get and validate Nango secret key */
function getNangoSecretKey(): string {
    if (!env.NANGO_SECRET_KEY) {
        throw new Error("Missing required environment variable: NANGO_SECRET_KEY");
    }
    return env.NANGO_SECRET_KEY;
}

// Google Calendar API base URL (via Nango proxy)
const CALENDAR_API_BASE = "/proxy/calendar/v3";
// Google People API base URL (via Nango proxy)
const PEOPLE_API_BASE = "/proxy/v1";

export class GoogleCalendarContactsAdapter extends ServiceAdapter {
    serviceName = "google-calendar-contacts";
    serviceDisplayName = "Google Calendar & Contacts";

    private getNangoUrl(): string {
        if (!env.NANGO_API_URL) {
            throw new Error("Missing required environment variable: NANGO_API_URL");
        }
        return env.NANGO_API_URL;
    }

    /**
     * Fetch the Google account information
     * Used to populate accountIdentifier and accountDisplayName after OAuth
     *
     * @param connectionId - Nango connection ID (required for OAuth webhook flow)
     * @param userId - User ID (optional, only used for logging)
     */
    async fetchAccountInfo(
        connectionId: string,
        userId?: string
    ): Promise<{
        identifier: string;
        displayName: string;
    }> {
        const nangoUrl = this.getNangoUrl();
        const nangoSecretKey = getNangoSecretKey();

        try {
            // Get user info from People API (authenticated user)
            const response = await httpClient
                .get(`${nangoUrl}${PEOPLE_API_BASE}/people/me`, {
                    headers: {
                        Authorization: `Bearer ${nangoSecretKey}`,
                        "Connection-Id": connectionId,
                        "Provider-Config-Key": "google-calendar-contacts",
                    },
                    searchParams: {
                        personFields: "names,emailAddresses",
                    },
                })
                .json<{
                    resourceName: string;
                    names?: Array<{ displayName?: string }>;
                    emailAddresses?: Array<{ value?: string }>;
                }>();

            const email = response.emailAddresses?.[0]?.value || "unknown";
            const displayName = response.names?.[0]?.displayName || email;

            return {
                identifier: email,
                displayName,
            };
        } catch (error) {
            logger.error(
                { error, userId, connectionId },
                "Failed to fetch Google account info"
            );
            throw new ValidationError("Failed to fetch Google account information");
        }
    }

    /**
     * Test the OAuth connection by making a live API request
     * Called when user clicks "Test" button to verify credentials are working
     *
     * @param connectionId - Nango connection ID
     * @param userId - User ID (optional, only used for logging)
     */
    async testConnection(
        connectionId: string,
        userId?: string
    ): Promise<{ success: boolean; error?: string }> {
        const nangoUrl = this.getNangoUrl();
        const nangoSecretKey = getNangoSecretKey();

        try {
            // Make a simple request to People API to verify connection
            await httpClient
                .get(`${nangoUrl}${PEOPLE_API_BASE}/people/me`, {
                    headers: {
                        Authorization: `Bearer ${nangoSecretKey}`,
                        "Connection-Id": connectionId,
                        "Provider-Config-Key": "google-calendar-contacts",
                    },
                    searchParams: {
                        personFields: "names,emailAddresses",
                    },
                })
                .json<Record<string, unknown>>();

            return { success: true };
        } catch (error) {
            logger.error(
                { error, userId, connectionId },
                "Failed to verify Google connection"
            );
            return {
                success: false,
                error:
                    error instanceof Error
                        ? error.message
                        : "Connection verification failed",
            };
        }
    }

    getHelp(): HelpResponse {
        return {
            service: this.serviceDisplayName,
            description:
                "Access Google Calendar and Contacts. Calendar operations manage events and calendars. " +
                "Contact operations use the People API for managing your contacts.",
            commonOperations: [
                "list_events",
                "create_event",
                "search_contacts",
                "list_calendars",
            ],
            operations: [
                // ============== CALENDAR OPERATIONS ==============
                {
                    name: "list_calendars",
                    description: "Get all calendars in the user's calendar list",
                    parameters: [],
                    returns: "List of calendars with IDs, names, and access roles",
                    example: `list_calendars()`,
                    annotations: { readOnlyHint: true },
                },
                {
                    name: "list_events",
                    description: "Get events from a calendar with optional filters",
                    parameters: [
                        {
                            name: "calendar_id",
                            type: "string",
                            required: false,
                            description:
                                "Calendar ID (default: 'primary' for main calendar)",
                            example: "primary",
                        },
                        {
                            name: "time_min",
                            type: "string",
                            required: false,
                            description:
                                "Lower bound for event start time (RFC3339, e.g., 2025-01-15T00:00:00Z)",
                        },
                        {
                            name: "time_max",
                            type: "string",
                            required: false,
                            description:
                                "Upper bound for event start time (RFC3339, e.g., 2025-01-31T23:59:59Z)",
                        },
                        {
                            name: "max_results",
                            type: "number",
                            required: false,
                            description:
                                "Maximum number of events (default: 50, max: 2500)",
                        },
                        {
                            name: "q",
                            type: "string",
                            required: false,
                            description: "Free text search terms to find events",
                        },
                        {
                            name: "single_events",
                            type: "boolean",
                            required: false,
                            description:
                                "Expand recurring events into instances (default: true)",
                        },
                        {
                            name: "order_by",
                            type: "string",
                            required: false,
                            description:
                                "Order by: startTime (requires single_events) or updated",
                        },
                    ],
                    returns: "List of events with details",
                    example: `list_events({ calendar_id: "primary", time_min: "2025-01-01T00:00:00Z", max_results: 10 })`,
                    annotations: { readOnlyHint: true },
                },
                {
                    name: "get_event",
                    description: "Get detailed information about a specific event",
                    parameters: [
                        {
                            name: "calendar_id",
                            type: "string",
                            required: false,
                            description: "Calendar ID (default: 'primary')",
                        },
                        {
                            name: "event_id",
                            type: "string",
                            required: true,
                            description: "Event ID",
                        },
                    ],
                    returns:
                        "Full event details including attendees, description, location",
                    example: `get_event({ event_id: "abc123xyz" })`,
                    annotations: { readOnlyHint: true },
                },
                {
                    name: "create_event",
                    description: "Create a new calendar event",
                    parameters: [
                        {
                            name: "calendar_id",
                            type: "string",
                            required: false,
                            description: "Calendar ID (default: 'primary')",
                        },
                        {
                            name: "summary",
                            type: "string",
                            required: true,
                            description: "Event title",
                        },
                        {
                            name: "start",
                            type: "object",
                            required: true,
                            description:
                                "Start time: { dateTime: RFC3339, timeZone: string } or { date: YYYY-MM-DD } for all-day",
                            example:
                                '{ "dateTime": "2025-01-15T10:00:00", "timeZone": "America/New_York" }',
                        },
                        {
                            name: "end",
                            type: "object",
                            required: true,
                            description:
                                "End time: { dateTime: RFC3339, timeZone: string } or { date: YYYY-MM-DD }",
                            example:
                                '{ "dateTime": "2025-01-15T11:00:00", "timeZone": "America/New_York" }',
                        },
                        {
                            name: "description",
                            type: "string",
                            required: false,
                            description: "Event description (supports HTML)",
                        },
                        {
                            name: "location",
                            type: "string",
                            required: false,
                            description: "Event location",
                        },
                        {
                            name: "attendees",
                            type: "array",
                            required: false,
                            description: "List of attendee emails",
                            example: '["person@example.com"]',
                        },
                        {
                            name: "send_updates",
                            type: "string",
                            required: false,
                            description:
                                "Notification setting: all, externalOnly, none (default: none)",
                        },
                        {
                            name: "recurrence",
                            type: "array",
                            required: false,
                            description: "RRULE strings for recurring events",
                            example: '["RRULE:FREQ=WEEKLY;COUNT=10"]',
                        },
                    ],
                    returns: "Created event details including ID and HTML link",
                    example: `create_event({ summary: "Team Meeting", start: { dateTime: "2025-01-15T10:00:00", timeZone: "America/New_York" }, end: { dateTime: "2025-01-15T11:00:00", timeZone: "America/New_York" } })`,
                    annotations: { readOnlyHint: false, destructiveHint: false },
                },
                {
                    name: "update_event",
                    description: "Update an existing calendar event",
                    parameters: [
                        {
                            name: "calendar_id",
                            type: "string",
                            required: false,
                            description: "Calendar ID (default: 'primary')",
                        },
                        {
                            name: "event_id",
                            type: "string",
                            required: true,
                            description: "Event ID to update",
                        },
                        {
                            name: "summary",
                            type: "string",
                            required: false,
                            description: "New event title",
                        },
                        {
                            name: "start",
                            type: "object",
                            required: false,
                            description: "New start time",
                        },
                        {
                            name: "end",
                            type: "object",
                            required: false,
                            description: "New end time",
                        },
                        {
                            name: "description",
                            type: "string",
                            required: false,
                            description: "New description",
                        },
                        {
                            name: "location",
                            type: "string",
                            required: false,
                            description: "New location",
                        },
                        {
                            name: "send_updates",
                            type: "string",
                            required: false,
                            description:
                                "Notification setting: all, externalOnly, none",
                        },
                    ],
                    returns: "Updated event details",
                    example: `update_event({ event_id: "abc123", summary: "Updated Meeting Title" })`,
                    annotations: {
                        readOnlyHint: false,
                        destructiveHint: false,
                        idempotentHint: true,
                    },
                },
                {
                    name: "delete_event",
                    description: "Delete a calendar event",
                    parameters: [
                        {
                            name: "calendar_id",
                            type: "string",
                            required: false,
                            description: "Calendar ID (default: 'primary')",
                        },
                        {
                            name: "event_id",
                            type: "string",
                            required: true,
                            description: "Event ID to delete",
                        },
                        {
                            name: "send_updates",
                            type: "string",
                            required: false,
                            description:
                                "Notification setting: all, externalOnly, none",
                        },
                    ],
                    returns: "Confirmation of deletion",
                    example: `delete_event({ event_id: "abc123" })`,
                    annotations: { readOnlyHint: false, destructiveHint: true },
                },
                {
                    name: "quick_add",
                    description: "Create an event from natural language text",
                    parameters: [
                        {
                            name: "calendar_id",
                            type: "string",
                            required: false,
                            description: "Calendar ID (default: 'primary')",
                        },
                        {
                            name: "text",
                            type: "string",
                            required: true,
                            description:
                                "Quick add text (e.g., 'Dinner with John at 7pm tomorrow')",
                        },
                    ],
                    returns: "Created event details",
                    example: `quick_add({ text: "Team standup at 9am every Monday" })`,
                    annotations: { readOnlyHint: false, destructiveHint: false },
                },
                {
                    name: "freebusy",
                    description: "Check availability across calendars",
                    parameters: [
                        {
                            name: "time_min",
                            type: "string",
                            required: true,
                            description: "Start of time range (RFC3339)",
                        },
                        {
                            name: "time_max",
                            type: "string",
                            required: true,
                            description: "End of time range (RFC3339)",
                        },
                        {
                            name: "calendar_ids",
                            type: "array",
                            required: false,
                            description: "Calendar IDs to check (default: ['primary'])",
                            example: '["primary", "work@example.com"]',
                        },
                    ],
                    returns: "Busy periods for each calendar",
                    example: `freebusy({ time_min: "2025-01-15T00:00:00Z", time_max: "2025-01-16T00:00:00Z" })`,
                    annotations: { readOnlyHint: true },
                },
                // ============== CONTACTS OPERATIONS ==============
                {
                    name: "list_contacts",
                    description: "Get the user's contacts (paginated)",
                    parameters: [
                        {
                            name: "page_size",
                            type: "number",
                            required: false,
                            description:
                                "Number of contacts to return (default: 100, max: 1000)",
                        },
                        {
                            name: "page_token",
                            type: "string",
                            required: false,
                            description: "Token for next page of results",
                        },
                        {
                            name: "sort_order",
                            type: "string",
                            required: false,
                            description:
                                "Sort order: LAST_MODIFIED_ASCENDING, LAST_MODIFIED_DESCENDING, FIRST_NAME_ASCENDING, LAST_NAME_ASCENDING",
                        },
                    ],
                    returns: "List of contacts with names, emails, phone numbers",
                    example: `list_contacts({ page_size: 50 })`,
                    annotations: { readOnlyHint: true },
                },
                {
                    name: "search_contacts",
                    description:
                        "Search contacts by name, email, phone, or organization",
                    parameters: [
                        {
                            name: "query",
                            type: "string",
                            required: true,
                            description:
                                "Search query (matches names, emails, phones, organizations)",
                        },
                        {
                            name: "page_size",
                            type: "number",
                            required: false,
                            description: "Number of results (default: 10, max: 30)",
                        },
                    ],
                    returns: "Matching contacts",
                    example: `search_contacts({ query: "john smith" })`,
                    annotations: { readOnlyHint: true },
                },
                {
                    name: "get_contact",
                    description: "Get detailed information about a specific contact",
                    parameters: [
                        {
                            name: "resource_name",
                            type: "string",
                            required: true,
                            description:
                                "Contact resource name (e.g., 'people/c12345')",
                        },
                    ],
                    returns: "Full contact details",
                    example: `get_contact({ resource_name: "people/c12345" })`,
                    annotations: { readOnlyHint: true },
                },
                {
                    name: "create_contact",
                    description: "Create a new contact",
                    parameters: [
                        {
                            name: "given_name",
                            type: "string",
                            required: false,
                            description: "First name",
                        },
                        {
                            name: "family_name",
                            type: "string",
                            required: false,
                            description: "Last name",
                        },
                        {
                            name: "emails",
                            type: "array",
                            required: false,
                            description: "Email addresses",
                            example:
                                '[{ "value": "john@example.com", "type": "work" }]',
                        },
                        {
                            name: "phone_numbers",
                            type: "array",
                            required: false,
                            description: "Phone numbers",
                            example:
                                '[{ "value": "+1-555-123-4567", "type": "mobile" }]',
                        },
                        {
                            name: "organizations",
                            type: "array",
                            required: false,
                            description: "Organizations/companies",
                            example: '[{ "name": "Acme Corp", "title": "Engineer" }]',
                        },
                        {
                            name: "addresses",
                            type: "array",
                            required: false,
                            description: "Physical addresses",
                        },
                        {
                            name: "notes",
                            type: "string",
                            required: false,
                            description: "Notes about the contact",
                        },
                    ],
                    returns: "Created contact details",
                    example: `create_contact({ given_name: "John", family_name: "Smith", emails: [{ value: "john@example.com" }] })`,
                    annotations: { readOnlyHint: false, destructiveHint: false },
                },
                {
                    name: "update_contact",
                    description: "Update an existing contact",
                    parameters: [
                        {
                            name: "resource_name",
                            type: "string",
                            required: true,
                            description:
                                "Contact resource name (e.g., 'people/c12345')",
                        },
                        {
                            name: "etag",
                            type: "string",
                            required: true,
                            description:
                                "Contact etag (from get_contact) for concurrency control",
                        },
                        {
                            name: "given_name",
                            type: "string",
                            required: false,
                            description: "First name",
                        },
                        {
                            name: "family_name",
                            type: "string",
                            required: false,
                            description: "Last name",
                        },
                        {
                            name: "emails",
                            type: "array",
                            required: false,
                            description: "Email addresses (replaces existing)",
                        },
                        {
                            name: "phone_numbers",
                            type: "array",
                            required: false,
                            description: "Phone numbers (replaces existing)",
                        },
                        {
                            name: "organizations",
                            type: "array",
                            required: false,
                            description: "Organizations (replaces existing)",
                        },
                    ],
                    returns: "Updated contact details",
                    example: `update_contact({ resource_name: "people/c12345", etag: "abc", given_name: "Jonathan" })`,
                    annotations: {
                        readOnlyHint: false,
                        destructiveHint: false,
                        idempotentHint: true,
                    },
                },
                {
                    name: "delete_contact",
                    description: "Delete a contact",
                    parameters: [
                        {
                            name: "resource_name",
                            type: "string",
                            required: true,
                            description:
                                "Contact resource name (e.g., 'people/c12345')",
                        },
                    ],
                    returns: "Confirmation of deletion",
                    example: `delete_contact({ resource_name: "people/c12345" })`,
                    annotations: { readOnlyHint: false, destructiveHint: true },
                },
                {
                    name: "list_contact_groups",
                    description: "Get all contact groups/labels",
                    parameters: [],
                    returns: "List of contact groups with names and member counts",
                    example: `list_contact_groups()`,
                    annotations: { readOnlyHint: true },
                },
                {
                    name: "raw_api",
                    description:
                        "Use this operation when the user requests functionality that doesn't have a dedicated operation listed above. " +
                        "This gives you direct access to the full Google Calendar and People APIs. " +
                        "For Calendar: use endpoints like /calendar/v3/calendars/{calendarId}/events. " +
                        "For People: use endpoints like /v1/people/{resourceName}. " +
                        "If unsure: https://developers.google.com/calendar/api/v3/reference or https://developers.google.com/people/api/rest",
                    parameters: [
                        {
                            name: "endpoint",
                            type: "string",
                            required: true,
                            description:
                                "API endpoint path (e.g., '/calendar/v3/...', '/v1/people/...')",
                            example: "/calendar/v3/calendars/primary/events",
                        },
                        {
                            name: "method",
                            type: "string",
                            required: true,
                            description: "HTTP method (GET, POST, PUT, PATCH, DELETE)",
                            example: "GET",
                        },
                        {
                            name: "body",
                            type: "object",
                            required: false,
                            description: "Request body for POST/PUT/PATCH requests",
                        },
                        {
                            name: "query",
                            type: "object",
                            required: false,
                            description: "Query parameters",
                        },
                    ],
                    returns: "Raw API response as JSON",
                    example: `raw_api({ endpoint: "/calendar/v3/users/me/calendarList", method: "GET" })`,
                },
            ],
            docsUrl: "https://developers.google.com/workspace",
        };
    }

    async execute(
        action: string,
        params: unknown,
        userId: string,
        accountId?: string
    ): Promise<MCPToolResponse> {
        // Validate action and params
        const validation = this.validate(action, params);
        if (!validation.valid) {
            this.logError(
                `[GOOGLE ADAPTER] Validation failed for action '${action}':`,
                validation.errors
            );
            return this.createErrorResponse(
                `Validation errors:\n${validation.errors.join("\n")}`
            );
        }

        // Get user's Google credentials via connection manager
        let connectionId: string;
        try {
            const credentials = await getCredentials(
                userId,
                this.serviceName,
                accountId
            );
            if (!credentials.connectionId) {
                return this.createErrorResponse(
                    `No connection ID found for Google. Please reconnect at: ` +
                        `${env.NEXT_PUBLIC_APP_URL}/integrations/google-calendar-contacts`
                );
            }
            connectionId = credentials.connectionId;
        } catch (error) {
            if (error instanceof ValidationError) {
                return this.createErrorResponse(error.message);
            }
            throw error;
        }

        // Route to appropriate handler
        try {
            switch (action) {
                // Calendar operations
                case "list_calendars":
                    return await this.handleListCalendars(connectionId);
                case "list_events":
                    return await this.handleListEvents(params, connectionId);
                case "get_event":
                    return await this.handleGetEvent(params, connectionId);
                case "create_event":
                    return await this.handleCreateEvent(params, connectionId);
                case "update_event":
                    return await this.handleUpdateEvent(params, connectionId);
                case "delete_event":
                    return await this.handleDeleteEvent(params, connectionId);
                case "quick_add":
                    return await this.handleQuickAdd(params, connectionId);
                case "freebusy":
                    return await this.handleFreebusy(params, connectionId);
                // Contacts operations
                case "list_contacts":
                    return await this.handleListContacts(params, connectionId);
                case "search_contacts":
                    return await this.handleSearchContacts(params, connectionId);
                case "get_contact":
                    return await this.handleGetContact(params, connectionId);
                case "create_contact":
                    return await this.handleCreateContact(params, connectionId);
                case "update_contact":
                    return await this.handleUpdateContact(params, connectionId);
                case "delete_contact":
                    return await this.handleDeleteContact(params, connectionId);
                case "list_contact_groups":
                    return await this.handleListContactGroups(connectionId);
                case "raw_api":
                    return await this.executeRawAPI(
                        params as RawAPIParams,
                        userId,
                        accountId
                    );
                default:
                    this.logError(
                        `[GOOGLE ADAPTER] Unknown action '${action}' requested by user ${userId}`
                    );
                    return this.createErrorResponse(
                        `Unknown action: ${action}. Use action='describe' to see available operations.`
                    );
            }
        } catch (error) {
            this.logError(
                `[GOOGLE ADAPTER] Failed to execute ${action} for user ${userId}:`,
                {
                    error: error instanceof Error ? error.message : String(error),
                    stack: error instanceof Error ? error.stack : undefined,
                    params,
                    connectionId,
                }
            );

            this.captureError(error, {
                action,
                params: params as Record<string, unknown>,
                userId,
            });

            return this.createErrorResponse(this.handleCommonAPIError(error, action));
        }
    }

    // ============== CALENDAR HANDLERS ==============

    private async handleListCalendars(connectionId: string): Promise<MCPToolResponse> {
        const nangoUrl = this.getNangoUrl();
        const nangoSecretKey = getNangoSecretKey();

        const response = await httpClient
            .get(`${nangoUrl}${CALENDAR_API_BASE}/users/me/calendarList`, {
                headers: {
                    Authorization: `Bearer ${nangoSecretKey}`,
                    "Connection-Id": connectionId,
                    "Provider-Config-Key": "google-calendar-contacts",
                },
            })
            .json<{
                items: Array<{
                    id: string;
                    summary: string;
                    description?: string;
                    primary?: boolean;
                    accessRole: string;
                    backgroundColor?: string;
                }>;
            }>();

        return this.createJSONResponse({
            calendars: (response.items || []).map((cal) => ({
                id: cal.id,
                name: cal.summary,
                description: cal.description,
                primary: cal.primary || false,
                accessRole: cal.accessRole,
            })),
        });
    }

    private async handleListEvents(
        params: unknown,
        connectionId: string
    ): Promise<MCPToolResponse> {
        const {
            calendar_id = "primary",
            time_min,
            time_max,
            max_results = 50,
            q,
            single_events = true,
            order_by,
        } = params as {
            calendar_id?: string;
            time_min?: string;
            time_max?: string;
            max_results?: number;
            q?: string;
            single_events?: boolean;
            order_by?: string;
        };

        const nangoUrl = this.getNangoUrl();
        const nangoSecretKey = getNangoSecretKey();

        const searchParams: Record<string, string> = {
            singleEvents: String(single_events),
            maxResults: String(Math.min(max_results, 2500)),
        };

        if (time_min) searchParams.timeMin = time_min;
        if (time_max) searchParams.timeMax = time_max;
        if (q) searchParams.q = q;
        if (order_by) searchParams.orderBy = order_by;

        const response = await httpClient
            .get(
                `${nangoUrl}${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendar_id)}/events`,
                {
                    headers: {
                        Authorization: `Bearer ${nangoSecretKey}`,
                        "Connection-Id": connectionId,
                        "Provider-Config-Key": "google-calendar-contacts",
                    },
                    searchParams,
                }
            )
            .json<{
                items: Array<{
                    id: string;
                    summary?: string;
                    description?: string;
                    location?: string;
                    start: { dateTime?: string; date?: string };
                    end: { dateTime?: string; date?: string };
                    status: string;
                    htmlLink: string;
                    attendees?: Array<{ email: string; responseStatus?: string }>;
                    organizer?: { email: string };
                }>;
                nextPageToken?: string;
            }>();

        return this.createJSONResponse({
            events: (response.items || []).map((event) => ({
                id: event.id,
                summary: event.summary || "(No title)",
                description: event.description,
                location: event.location,
                start: event.start.dateTime || event.start.date,
                end: event.end.dateTime || event.end.date,
                status: event.status,
                link: event.htmlLink,
                attendees: event.attendees?.map((a) => ({
                    email: a.email,
                    status: a.responseStatus,
                })),
            })),
            nextPageToken: response.nextPageToken,
        });
    }

    private async handleGetEvent(
        params: unknown,
        connectionId: string
    ): Promise<MCPToolResponse> {
        const { calendar_id = "primary", event_id } = params as {
            calendar_id?: string;
            event_id: string;
        };

        const nangoUrl = this.getNangoUrl();
        const nangoSecretKey = getNangoSecretKey();

        const response = await httpClient
            .get(
                `${nangoUrl}${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendar_id)}/events/${encodeURIComponent(event_id)}`,
                {
                    headers: {
                        Authorization: `Bearer ${nangoSecretKey}`,
                        "Connection-Id": connectionId,
                        "Provider-Config-Key": "google-calendar-contacts",
                    },
                }
            )
            .json<Record<string, unknown>>();

        return this.createJSONResponse(response);
    }

    private async handleCreateEvent(
        params: unknown,
        connectionId: string
    ): Promise<MCPToolResponse> {
        const {
            calendar_id = "primary",
            summary,
            start,
            end,
            description,
            location,
            attendees,
            send_updates = "none",
            recurrence,
        } = params as {
            calendar_id?: string;
            summary: string;
            start: { dateTime?: string; date?: string; timeZone?: string };
            end: { dateTime?: string; date?: string; timeZone?: string };
            description?: string;
            location?: string;
            attendees?: string[];
            send_updates?: string;
            recurrence?: string[];
        };

        const nangoUrl = this.getNangoUrl();
        const nangoSecretKey = getNangoSecretKey();

        const body: Record<string, unknown> = {
            summary,
            start,
            end,
        };

        if (description) body.description = description;
        if (location) body.location = location;
        if (attendees) body.attendees = attendees.map((email) => ({ email }));
        if (recurrence) body.recurrence = recurrence;

        const response = await httpClient
            .post(
                `${nangoUrl}${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendar_id)}/events`,
                {
                    headers: {
                        Authorization: `Bearer ${nangoSecretKey}`,
                        "Connection-Id": connectionId,
                        "Provider-Config-Key": "google-calendar-contacts",
                        "Content-Type": "application/json",
                    },
                    searchParams: {
                        sendUpdates: send_updates,
                    },
                    json: body,
                }
            )
            .json<{
                id: string;
                htmlLink: string;
                summary: string;
                start: { dateTime?: string; date?: string };
                end: { dateTime?: string; date?: string };
            }>();

        return this.createJSONResponse({
            success: true,
            event_id: response.id,
            link: response.htmlLink,
            summary: response.summary,
            start: response.start.dateTime || response.start.date,
            end: response.end.dateTime || response.end.date,
        });
    }

    private async handleUpdateEvent(
        params: unknown,
        connectionId: string
    ): Promise<MCPToolResponse> {
        const {
            calendar_id = "primary",
            event_id,
            summary,
            start,
            end,
            description,
            location,
            send_updates = "none",
        } = params as {
            calendar_id?: string;
            event_id: string;
            summary?: string;
            start?: { dateTime?: string; date?: string; timeZone?: string };
            end?: { dateTime?: string; date?: string; timeZone?: string };
            description?: string;
            location?: string;
            send_updates?: string;
        };

        const nangoUrl = this.getNangoUrl();
        const nangoSecretKey = getNangoSecretKey();

        // First get the existing event
        const existing = await httpClient
            .get(
                `${nangoUrl}${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendar_id)}/events/${encodeURIComponent(event_id)}`,
                {
                    headers: {
                        Authorization: `Bearer ${nangoSecretKey}`,
                        "Connection-Id": connectionId,
                        "Provider-Config-Key": "google-calendar-contacts",
                    },
                }
            )
            .json<Record<string, unknown>>();

        // Merge updates
        const body = { ...existing };
        if (summary !== undefined) body.summary = summary;
        if (start !== undefined) body.start = start;
        if (end !== undefined) body.end = end;
        if (description !== undefined) body.description = description;
        if (location !== undefined) body.location = location;

        const response = await httpClient
            .put(
                `${nangoUrl}${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendar_id)}/events/${encodeURIComponent(event_id)}`,
                {
                    headers: {
                        Authorization: `Bearer ${nangoSecretKey}`,
                        "Connection-Id": connectionId,
                        "Provider-Config-Key": "google-calendar-contacts",
                        "Content-Type": "application/json",
                    },
                    searchParams: {
                        sendUpdates: send_updates,
                    },
                    json: body,
                }
            )
            .json<{
                id: string;
                htmlLink: string;
                summary: string;
            }>();

        return this.createJSONResponse({
            success: true,
            event_id: response.id,
            link: response.htmlLink,
            summary: response.summary,
        });
    }

    private async handleDeleteEvent(
        params: unknown,
        connectionId: string
    ): Promise<MCPToolResponse> {
        const {
            calendar_id = "primary",
            event_id,
            send_updates = "none",
        } = params as {
            calendar_id?: string;
            event_id: string;
            send_updates?: string;
        };

        const nangoUrl = this.getNangoUrl();
        const nangoSecretKey = getNangoSecretKey();

        await httpClient.delete(
            `${nangoUrl}${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendar_id)}/events/${encodeURIComponent(event_id)}`,
            {
                headers: {
                    Authorization: `Bearer ${nangoSecretKey}`,
                    "Connection-Id": connectionId,
                    "Provider-Config-Key": "google-calendar-contacts",
                },
                searchParams: {
                    sendUpdates: send_updates,
                },
            }
        );

        return this.createJSONResponse({
            success: true,
            message: `Event ${event_id} deleted successfully`,
        });
    }

    private async handleQuickAdd(
        params: unknown,
        connectionId: string
    ): Promise<MCPToolResponse> {
        const { calendar_id = "primary", text } = params as {
            calendar_id?: string;
            text: string;
        };

        const nangoUrl = this.getNangoUrl();
        const nangoSecretKey = getNangoSecretKey();

        const response = await httpClient
            .post(
                `${nangoUrl}${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendar_id)}/events/quickAdd`,
                {
                    headers: {
                        Authorization: `Bearer ${nangoSecretKey}`,
                        "Connection-Id": connectionId,
                        "Provider-Config-Key": "google-calendar-contacts",
                    },
                    searchParams: {
                        text,
                    },
                }
            )
            .json<{
                id: string;
                htmlLink: string;
                summary: string;
                start: { dateTime?: string; date?: string };
                end: { dateTime?: string; date?: string };
            }>();

        return this.createJSONResponse({
            success: true,
            event_id: response.id,
            link: response.htmlLink,
            summary: response.summary,
            start: response.start?.dateTime || response.start?.date,
            end: response.end?.dateTime || response.end?.date,
        });
    }

    private async handleFreebusy(
        params: unknown,
        connectionId: string
    ): Promise<MCPToolResponse> {
        const {
            time_min,
            time_max,
            calendar_ids = ["primary"],
        } = params as {
            time_min: string;
            time_max: string;
            calendar_ids?: string[];
        };

        const nangoUrl = this.getNangoUrl();
        const nangoSecretKey = getNangoSecretKey();

        const response = await httpClient
            .post(`${nangoUrl}${CALENDAR_API_BASE}/freeBusy`, {
                headers: {
                    Authorization: `Bearer ${nangoSecretKey}`,
                    "Connection-Id": connectionId,
                    "Provider-Config-Key": "google-calendar-contacts",
                    "Content-Type": "application/json",
                },
                json: {
                    timeMin: time_min,
                    timeMax: time_max,
                    items: calendar_ids.map((id) => ({ id })),
                },
            })
            .json<{
                calendars: Record<
                    string,
                    {
                        busy: Array<{ start: string; end: string }>;
                        errors?: Array<{ domain: string; reason: string }>;
                    }
                >;
            }>();

        return this.createJSONResponse({
            timeMin: time_min,
            timeMax: time_max,
            calendars: response.calendars,
        });
    }

    // ============== CONTACTS HANDLERS ==============

    private async handleListContacts(
        params: unknown,
        connectionId: string
    ): Promise<MCPToolResponse> {
        const {
            page_size = 100,
            page_token,
            sort_order,
        } = params as {
            page_size?: number;
            page_token?: string;
            sort_order?: string;
        };

        const nangoUrl = this.getNangoUrl();
        const nangoSecretKey = getNangoSecretKey();

        const searchParams: Record<string, string> = {
            pageSize: String(Math.min(page_size, 1000)),
            personFields: "names,emailAddresses,phoneNumbers,organizations,metadata",
        };

        if (page_token) searchParams.pageToken = page_token;
        if (sort_order) searchParams.sortOrder = sort_order;

        const response = await httpClient
            .get(`${nangoUrl}${PEOPLE_API_BASE}/people/me/connections`, {
                headers: {
                    Authorization: `Bearer ${nangoSecretKey}`,
                    "Connection-Id": connectionId,
                    "Provider-Config-Key": "google-calendar-contacts",
                },
                searchParams,
            })
            .json<{
                connections?: Array<{
                    resourceName: string;
                    etag: string;
                    names?: Array<{
                        displayName?: string;
                        givenName?: string;
                        familyName?: string;
                    }>;
                    emailAddresses?: Array<{ value?: string; type?: string }>;
                    phoneNumbers?: Array<{ value?: string; type?: string }>;
                    organizations?: Array<{ name?: string; title?: string }>;
                }>;
                nextPageToken?: string;
                totalPeople?: number;
            }>();

        const contacts = (response.connections || []).map((contact) => ({
            resourceName: contact.resourceName,
            etag: contact.etag,
            name: contact.names?.[0]?.displayName || "Unknown",
            givenName: contact.names?.[0]?.givenName,
            familyName: contact.names?.[0]?.familyName,
            emails: contact.emailAddresses?.map((e) => ({
                value: e.value,
                type: e.type,
            })),
            phones: contact.phoneNumbers?.map((p) => ({
                value: p.value,
                type: p.type,
            })),
            organization: contact.organizations?.[0]?.name,
            title: contact.organizations?.[0]?.title,
        }));

        return this.createJSONResponse({
            contacts,
            nextPageToken: response.nextPageToken,
            totalCount: response.totalPeople,
        });
    }

    private async handleSearchContacts(
        params: unknown,
        connectionId: string
    ): Promise<MCPToolResponse> {
        const { query, page_size = 10 } = params as {
            query: string;
            page_size?: number;
        };

        const nangoUrl = this.getNangoUrl();
        const nangoSecretKey = getNangoSecretKey();

        const response = await httpClient
            .get(`${nangoUrl}${PEOPLE_API_BASE}/people:searchContacts`, {
                headers: {
                    Authorization: `Bearer ${nangoSecretKey}`,
                    "Connection-Id": connectionId,
                    "Provider-Config-Key": "google-calendar-contacts",
                },
                searchParams: {
                    query,
                    pageSize: String(Math.min(page_size, 30)),
                    readMask:
                        "names,emailAddresses,phoneNumbers,organizations,metadata",
                },
            })
            .json<{
                results?: Array<{
                    person: {
                        resourceName: string;
                        etag: string;
                        names?: Array<{ displayName?: string }>;
                        emailAddresses?: Array<{ value?: string }>;
                        phoneNumbers?: Array<{ value?: string }>;
                        organizations?: Array<{ name?: string; title?: string }>;
                    };
                }>;
            }>();

        const contacts = (response.results || []).map((result) => ({
            resourceName: result.person.resourceName,
            etag: result.person.etag,
            name: result.person.names?.[0]?.displayName || "Unknown",
            emails: result.person.emailAddresses?.map((e) => e.value),
            phones: result.person.phoneNumbers?.map((p) => p.value),
            organization: result.person.organizations?.[0]?.name,
        }));

        return this.createJSONResponse({
            query,
            contacts,
        });
    }

    private async handleGetContact(
        params: unknown,
        connectionId: string
    ): Promise<MCPToolResponse> {
        const { resource_name } = params as { resource_name: string };

        const nangoUrl = this.getNangoUrl();
        const nangoSecretKey = getNangoSecretKey();

        const response = await httpClient
            .get(`${nangoUrl}${PEOPLE_API_BASE}/${resource_name}`, {
                headers: {
                    Authorization: `Bearer ${nangoSecretKey}`,
                    "Connection-Id": connectionId,
                    "Provider-Config-Key": "google-calendar-contacts",
                },
                searchParams: {
                    personFields:
                        "names,emailAddresses,phoneNumbers,organizations,addresses,biographies,birthdays,metadata",
                },
            })
            .json<Record<string, unknown>>();

        return this.createJSONResponse(response);
    }

    private async handleCreateContact(
        params: unknown,
        connectionId: string
    ): Promise<MCPToolResponse> {
        const {
            given_name,
            family_name,
            emails,
            phone_numbers,
            organizations,
            addresses,
            notes,
        } = params as {
            given_name?: string;
            family_name?: string;
            emails?: Array<{ value: string; type?: string }>;
            phone_numbers?: Array<{ value: string; type?: string }>;
            organizations?: Array<{ name?: string; title?: string }>;
            addresses?: Array<{
                streetAddress?: string;
                city?: string;
                region?: string;
                country?: string;
            }>;
            notes?: string;
        };

        const nangoUrl = this.getNangoUrl();
        const nangoSecretKey = getNangoSecretKey();

        const body: Record<string, unknown> = {};

        if (given_name || family_name) {
            body.names = [{ givenName: given_name, familyName: family_name }];
        }
        if (emails) body.emailAddresses = emails;
        if (phone_numbers) body.phoneNumbers = phone_numbers;
        if (organizations) body.organizations = organizations;
        if (addresses) body.addresses = addresses;
        if (notes) body.biographies = [{ value: notes }];

        const response = await httpClient
            .post(`${nangoUrl}${PEOPLE_API_BASE}/people:createContact`, {
                headers: {
                    Authorization: `Bearer ${nangoSecretKey}`,
                    "Connection-Id": connectionId,
                    "Provider-Config-Key": "google-calendar-contacts",
                    "Content-Type": "application/json",
                },
                json: body,
            })
            .json<{
                resourceName: string;
                etag: string;
                names?: Array<{ displayName?: string }>;
            }>();

        return this.createJSONResponse({
            success: true,
            resourceName: response.resourceName,
            etag: response.etag,
            name: response.names?.[0]?.displayName,
        });
    }

    private async handleUpdateContact(
        params: unknown,
        connectionId: string
    ): Promise<MCPToolResponse> {
        const {
            resource_name,
            etag,
            given_name,
            family_name,
            emails,
            phone_numbers,
            organizations,
        } = params as {
            resource_name: string;
            etag: string;
            given_name?: string;
            family_name?: string;
            emails?: Array<{ value: string; type?: string }>;
            phone_numbers?: Array<{ value: string; type?: string }>;
            organizations?: Array<{ name?: string; title?: string }>;
        };

        const nangoUrl = this.getNangoUrl();
        const nangoSecretKey = getNangoSecretKey();

        // Build update fields
        const updateFields: string[] = [];
        const body: Record<string, unknown> = {
            etag,
            resourceName: resource_name,
        };

        if (given_name !== undefined || family_name !== undefined) {
            const nameObj: { givenName?: string; familyName?: string } = {};
            if (given_name !== undefined) nameObj.givenName = given_name;
            if (family_name !== undefined) nameObj.familyName = family_name;
            body.names = [nameObj];
            updateFields.push("names");
        }
        if (emails !== undefined) {
            body.emailAddresses = emails;
            updateFields.push("emailAddresses");
        }
        if (phone_numbers !== undefined) {
            body.phoneNumbers = phone_numbers;
            updateFields.push("phoneNumbers");
        }
        if (organizations !== undefined) {
            body.organizations = organizations;
            updateFields.push("organizations");
        }

        if (updateFields.length === 0) {
            throw new ValidationError(
                "At least one field must be provided to update contact"
            );
        }

        const response = await httpClient
            .patch(`${nangoUrl}${PEOPLE_API_BASE}/${resource_name}:updateContact`, {
                headers: {
                    Authorization: `Bearer ${nangoSecretKey}`,
                    "Connection-Id": connectionId,
                    "Provider-Config-Key": "google-calendar-contacts",
                    "Content-Type": "application/json",
                },
                searchParams: {
                    updatePersonFields: updateFields.join(","),
                },
                json: body,
            })
            .json<{
                resourceName: string;
                etag: string;
                names?: Array<{ displayName?: string }>;
            }>();

        return this.createJSONResponse({
            success: true,
            resourceName: response.resourceName,
            etag: response.etag,
            name: response.names?.[0]?.displayName,
        });
    }

    private async handleDeleteContact(
        params: unknown,
        connectionId: string
    ): Promise<MCPToolResponse> {
        const { resource_name } = params as { resource_name: string };

        const nangoUrl = this.getNangoUrl();
        const nangoSecretKey = getNangoSecretKey();

        await httpClient.delete(
            `${nangoUrl}${PEOPLE_API_BASE}/${resource_name}:deleteContact`,
            {
                headers: {
                    Authorization: `Bearer ${nangoSecretKey}`,
                    "Connection-Id": connectionId,
                    "Provider-Config-Key": "google-calendar-contacts",
                },
            }
        );

        return this.createJSONResponse({
            success: true,
            message: `Contact ${resource_name} deleted successfully`,
        });
    }

    private async handleListContactGroups(
        connectionId: string
    ): Promise<MCPToolResponse> {
        const nangoUrl = this.getNangoUrl();
        const nangoSecretKey = getNangoSecretKey();

        const response = await httpClient
            .get(`${nangoUrl}${PEOPLE_API_BASE}/contactGroups`, {
                headers: {
                    Authorization: `Bearer ${nangoSecretKey}`,
                    "Connection-Id": connectionId,
                    "Provider-Config-Key": "google-calendar-contacts",
                },
            })
            .json<{
                contactGroups: Array<{
                    resourceName: string;
                    etag: string;
                    name: string;
                    formattedName?: string;
                    memberCount?: number;
                    groupType: string;
                }>;
            }>();

        return this.createJSONResponse({
            groups: (response.contactGroups || []).map((group) => ({
                resourceName: group.resourceName,
                name: group.formattedName || group.name,
                memberCount: group.memberCount || 0,
                type: group.groupType,
            })),
        });
    }

    // ============== RAW API ==============

    async executeRawAPI(
        params: RawAPIParams,
        userId: string,
        accountId?: string
    ): Promise<MCPToolResponse> {
        const { endpoint, method, body, query } = params;

        if (!endpoint || typeof endpoint !== "string") {
            return this.createErrorResponse(
                "raw_api requires 'endpoint' parameter (string)"
            );
        }
        if (!method || typeof method !== "string") {
            return this.createErrorResponse(
                "raw_api requires 'method' parameter (GET, POST, PUT, PATCH, DELETE)"
            );
        }

        // Validate endpoint starts with expected prefixes
        if (!endpoint.startsWith("/calendar/v3") && !endpoint.startsWith("/v1")) {
            return this.createErrorResponse(
                "Invalid endpoint: must start with '/calendar/v3' (Calendar API) or '/v1' (People API). " +
                    `Got: ${endpoint}`
            );
        }

        let connectionId: string;
        try {
            const credentials = await getCredentials(
                userId,
                this.serviceName,
                accountId
            );
            if (!credentials.connectionId) {
                return this.createErrorResponse(
                    `No connection ID found for Google. Please reconnect at: ` +
                        `${env.NEXT_PUBLIC_APP_URL}/integrations/google-calendar-contacts`
                );
            }
            connectionId = credentials.connectionId;
        } catch (error) {
            if (error instanceof ValidationError) {
                return this.createErrorResponse(error.message);
            }
            throw error;
        }

        const nangoUrl = this.getNangoUrl();
        const nangoSecretKey = getNangoSecretKey();

        const requestOptions: {
            headers: Record<string, string>;
            searchParams?: Record<string, string>;
            json?: Record<string, unknown>;
        } = {
            headers: {
                Authorization: `Bearer ${nangoSecretKey}`,
                "Connection-Id": connectionId,
                "Provider-Config-Key": "google-calendar-contacts",
            },
        };

        if (query && typeof query === "object") {
            requestOptions.searchParams = Object.fromEntries(
                Object.entries(query).map(([k, v]) => [k, String(v)])
            );
        }

        if (["POST", "PUT", "PATCH"].includes(method.toUpperCase()) && body) {
            requestOptions.json = body;
            requestOptions.headers["Content-Type"] = "application/json";
        }

        try {
            const httpMethod = method.toLowerCase() as
                | "get"
                | "post"
                | "put"
                | "delete"
                | "patch";
            const fullUrl = `${nangoUrl}/proxy${endpoint}`;

            const response = await httpClient[httpMethod](fullUrl, requestOptions).json<
                Record<string, unknown>
            >();

            return this.createJSONResponse(response);
        } catch (error) {
            logger.error(
                {
                    endpoint,
                    method,
                    userId,
                    error: error instanceof Error ? error.message : String(error),
                },
                "[GOOGLE ADAPTER] Raw API request failed"
            );

            this.captureError(error, {
                action: "raw_api",
                params: { endpoint, method },
                userId,
            });

            return this.createErrorResponse(
                this.handleCommonAPIError(error, "raw_api")
            );
        }
    }
}
