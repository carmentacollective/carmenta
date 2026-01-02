/**
 * Quo Service Adapter
 *
 * Business phone system (formerly OpenPhone) for calls, texts, and contacts.
 * Uses API key authentication (Authorization: API_KEY header - no Bearer prefix).
 *
 * ## Key API Details
 * - Base URL: https://api.openphone.com/v1
 * - Auth: API key in Authorization header (not Bearer)
 * - Rate limit: 10 requests/second
 * - SMS only (no MMS support)
 * - Messages require prepaid credits
 *
 * @see https://www.quo.com/docs/mdx/api-reference/introduction
 */

import { ServiceAdapter, HelpResponse, MCPToolResponse, RawAPIParams } from "./base";
import { httpClient } from "@/lib/http-client";

const QUO_API_BASE = "https://api.openphone.com/v1";

export class QuoAdapter extends ServiceAdapter {
    serviceName = "quo";
    serviceDisplayName = "Quo";

    /**
     * Build headers for Quo API requests.
     * Quo uses plain API key (no Bearer prefix).
     */
    private buildHeaders(apiKey: string): Record<string, string> {
        return {
            Authorization: apiKey,
            "Content-Type": "application/json",
        };
    }

    /**
     * Test the API key by fetching phone numbers (lightweight endpoint)
     */
    async testConnection(
        apiKey: string
    ): Promise<{ success: boolean; error?: string }> {
        return await this.testApiKeyWithEndpoint(
            apiKey,
            `${QUO_API_BASE}/phone-numbers?maxResults=1`,
            "Authorization",
            (k) => k // No prefix
        );
    }

    getHelp(): HelpResponse {
        return {
            service: this.serviceDisplayName,
            description:
                "Quo (formerly OpenPhone) business phone system for SMS messaging. " +
                "IMPORTANT: Use 'list_messages' to see conversation history with a contact. " +
                "Use 'send_message' to send SMS (requires prepaid credits). " +
                "Use 'list_conversations' for an overview of all active conversations.",
            operations: [
                {
                    name: "list_messages",
                    description:
                        "Get message history for a conversation. Requires phoneNumberId and at least one participant phone number.",
                    annotations: { readOnlyHint: true },
                    parameters: [
                        {
                            name: "phoneNumberId",
                            type: "string",
                            required: true,
                            description:
                                "Your Quo phone number ID (get from list_phone_numbers)",
                            example: "PN123abc",
                        },
                        {
                            name: "participants",
                            type: "array",
                            required: true,
                            description:
                                "Phone numbers in E.164 format (excluding your Quo number)",
                            example: "['+14155551234']",
                        },
                        {
                            name: "limit",
                            type: "number",
                            required: false,
                            description: "Max results (1-100, default: 10)",
                            example: "20",
                        },
                        {
                            name: "createdAfter",
                            type: "string",
                            required: false,
                            description: "Filter messages after this ISO 8601 datetime",
                            example: "2024-01-15T00:00:00Z",
                        },
                        {
                            name: "createdBefore",
                            type: "string",
                            required: false,
                            description:
                                "Filter messages before this ISO 8601 datetime",
                        },
                    ],
                    returns:
                        "Messages with id, text, direction (incoming/outgoing), status, timestamps",
                    example: `list_messages({ phoneNumberId: "PN123", participants: ["+14155551234"], limit: 20 })`,
                },
                {
                    name: "get_message",
                    description: "Get a specific message by ID",
                    annotations: { readOnlyHint: true },
                    parameters: [
                        {
                            name: "messageId",
                            type: "string",
                            required: true,
                            description: "The message ID",
                        },
                    ],
                    returns:
                        "Full message details including text, direction, and status",
                },
                {
                    name: "send_message",
                    description:
                        "Send an SMS message. Requires prepaid credits. No MMS support.",
                    annotations: { readOnlyHint: false, destructiveHint: false },
                    parameters: [
                        {
                            name: "from",
                            type: "string",
                            required: true,
                            description: "Your Quo phone number in E.164 format",
                            example: "+14155550100",
                        },
                        {
                            name: "to",
                            type: "array",
                            required: true,
                            description: "Recipient phone numbers in E.164 format",
                            example: "['+14155551234']",
                        },
                        {
                            name: "content",
                            type: "string",
                            required: true,
                            description:
                                "Message text (160 chars = 1 segment, $0.01/segment)",
                        },
                    ],
                    returns: "202 Accepted - message queued for delivery",
                    example: `send_message({ from: "+14155550100", to: ["+14155551234"], content: "Hello!" })`,
                },
                {
                    name: "list_conversations",
                    description:
                        "List all conversations (message threads) for your workspace",
                    annotations: { readOnlyHint: true },
                    parameters: [
                        {
                            name: "phoneNumberIds",
                            type: "array",
                            required: false,
                            description: "Filter by specific Quo phone number IDs",
                        },
                        {
                            name: "userIds",
                            type: "array",
                            required: false,
                            description: "Filter by user IDs",
                        },
                        {
                            name: "limit",
                            type: "number",
                            required: false,
                            description: "Max results (default: 10)",
                        },
                    ],
                    returns: "Conversations with participant info and last activity",
                },
                {
                    name: "list_phone_numbers",
                    description: "List all Quo phone numbers in your workspace",
                    annotations: { readOnlyHint: true },
                    parameters: [
                        {
                            name: "limit",
                            type: "number",
                            required: false,
                            description: "Max results (default: 10)",
                        },
                    ],
                    returns: "Phone numbers with IDs, E.164 format, and assigned users",
                },
                {
                    name: "get_phone_number",
                    description: "Get details of a specific phone number",
                    annotations: { readOnlyHint: true },
                    parameters: [
                        {
                            name: "phoneNumberId",
                            type: "string",
                            required: true,
                            description: "The phone number ID",
                        },
                    ],
                    returns: "Phone number details including assigned users",
                },
                {
                    name: "list_calls",
                    description: "List calls for a specific phone number",
                    annotations: { readOnlyHint: true },
                    parameters: [
                        {
                            name: "phoneNumberId",
                            type: "string",
                            required: true,
                            description: "Your Quo phone number ID",
                        },
                        {
                            name: "limit",
                            type: "number",
                            required: false,
                            description: "Max results (default: 10)",
                        },
                        {
                            name: "createdAfter",
                            type: "string",
                            required: false,
                            description: "Filter calls after this ISO 8601 datetime",
                        },
                    ],
                    returns: "Calls with direction, duration, participants, and status",
                },
                {
                    name: "get_call",
                    description: "Get details of a specific call",
                    annotations: { readOnlyHint: true },
                    parameters: [
                        {
                            name: "callId",
                            type: "string",
                            required: true,
                            description: "The call ID",
                        },
                    ],
                    returns: "Full call details",
                },
                {
                    name: "get_call_recording",
                    description: "Get recording for a call (if available)",
                    annotations: { readOnlyHint: true },
                    parameters: [
                        {
                            name: "callId",
                            type: "string",
                            required: true,
                            description: "The call ID",
                        },
                    ],
                    returns: "Recording URL and metadata",
                },
                {
                    name: "get_call_transcript",
                    description:
                        "Get transcript for a call (Business/Scale plans only)",
                    annotations: { readOnlyHint: true },
                    parameters: [
                        {
                            name: "callId",
                            type: "string",
                            required: true,
                            description: "The call ID",
                        },
                    ],
                    returns: "Call transcript text",
                },
                {
                    name: "get_voicemail",
                    description: "Get voicemail for a call (if available)",
                    annotations: { readOnlyHint: true },
                    parameters: [
                        {
                            name: "callId",
                            type: "string",
                            required: true,
                            description: "The call ID",
                        },
                    ],
                    returns: "Voicemail audio URL and transcription",
                },
                {
                    name: "list_contacts",
                    description: "List contacts in your workspace",
                    annotations: { readOnlyHint: true },
                    parameters: [
                        {
                            name: "limit",
                            type: "number",
                            required: false,
                            description: "Max results (default: 10)",
                        },
                        {
                            name: "externalId",
                            type: "string",
                            required: false,
                            description: "Filter by external ID (from CRM sync)",
                        },
                    ],
                    returns: "Contacts with names, phone numbers, and custom fields",
                },
                {
                    name: "get_contact",
                    description: "Get a specific contact by ID",
                    annotations: { readOnlyHint: true },
                    parameters: [
                        {
                            name: "contactId",
                            type: "string",
                            required: true,
                            description: "The contact ID",
                        },
                    ],
                    returns: "Full contact details",
                },
                {
                    name: "create_contact",
                    description: "Create a new contact",
                    annotations: { readOnlyHint: false, destructiveHint: false },
                    parameters: [
                        {
                            name: "firstName",
                            type: "string",
                            required: false,
                            description: "First name",
                        },
                        {
                            name: "lastName",
                            type: "string",
                            required: false,
                            description: "Last name",
                        },
                        {
                            name: "company",
                            type: "string",
                            required: false,
                            description: "Company name",
                        },
                        {
                            name: "phoneNumbers",
                            type: "array",
                            required: false,
                            description:
                                "Phone numbers array [{name: 'mobile', value: '+1...'}]",
                        },
                        {
                            name: "emails",
                            type: "array",
                            required: false,
                            description: "Emails array [{name: 'work', value: '...'}]",
                        },
                    ],
                    returns: "Created contact with ID",
                },
                {
                    name: "update_contact",
                    description: "Update an existing contact",
                    annotations: { readOnlyHint: false, destructiveHint: false },
                    parameters: [
                        {
                            name: "contactId",
                            type: "string",
                            required: true,
                            description: "The contact ID to update",
                        },
                        {
                            name: "firstName",
                            type: "string",
                            required: false,
                            description: "First name",
                        },
                        {
                            name: "lastName",
                            type: "string",
                            required: false,
                            description: "Last name",
                        },
                        {
                            name: "company",
                            type: "string",
                            required: false,
                            description: "Company name",
                        },
                    ],
                    returns: "Updated contact",
                },
                {
                    name: "delete_contact",
                    description: "Delete a contact",
                    annotations: { readOnlyHint: false, destructiveHint: true },
                    parameters: [
                        {
                            name: "contactId",
                            type: "string",
                            required: true,
                            description: "The contact ID to delete",
                        },
                    ],
                    returns: "Confirmation of deletion",
                },
                {
                    name: "list_users",
                    description: "List users in your workspace",
                    annotations: { readOnlyHint: true },
                    parameters: [
                        {
                            name: "limit",
                            type: "number",
                            required: false,
                            description: "Max results (default: 10)",
                        },
                    ],
                    returns: "Users with names, emails, and roles",
                },
                {
                    name: "raw_api",
                    description:
                        "Direct Quo API access for operations not covered above. " +
                        "Consult https://www.quo.com/docs for endpoint details.",
                    annotations: {},
                    parameters: [
                        {
                            name: "endpoint",
                            type: "string",
                            required: true,
                            description: "API endpoint (e.g., '/v1/messages')",
                            example: "/v1/messages",
                        },
                        {
                            name: "method",
                            type: "string",
                            required: true,
                            description: "HTTP method (GET, POST, PATCH, DELETE)",
                        },
                        {
                            name: "body",
                            type: "object",
                            required: false,
                            description: "Request body for POST/PATCH",
                        },
                        {
                            name: "query",
                            type: "object",
                            required: false,
                            description: "Query parameters",
                        },
                    ],
                    returns: "Raw API response",
                },
            ],
            commonOperations: ["list_messages", "send_message", "list_phone_numbers"],
            docsUrl: "https://www.quo.com/docs/mdx/api-reference/introduction",
        };
    }

    async execute(
        action: string,
        params: unknown,
        userId: string,
        _accountId?: string
    ): Promise<MCPToolResponse> {
        // Validate action and params
        const validation = this.validate(action, params);
        if (!validation.valid) {
            this.logError(
                `[QUO ADAPTER] Validation failed for action '${action}':`,
                validation.errors
            );
            return this.createErrorResponse(
                `Validation errors:\n${validation.errors.join("\n")}`
            );
        }

        // Get user's API key credentials using base class helper
        const result = await this.getApiKeyForExecution(userId);
        if ("isError" in result) return result;
        const { apiKey } = result;

        // Route to appropriate handler
        try {
            switch (action) {
                case "list_messages":
                    return await this.handleListMessages(params, apiKey);
                case "get_message":
                    return await this.handleGetMessage(params, apiKey);
                case "send_message":
                    return await this.handleSendMessage(params, apiKey);
                case "list_conversations":
                    return await this.handleListConversations(params, apiKey);
                case "list_phone_numbers":
                    return await this.handleListPhoneNumbers(params, apiKey);
                case "get_phone_number":
                    return await this.handleGetPhoneNumber(params, apiKey);
                case "list_calls":
                    return await this.handleListCalls(params, apiKey);
                case "get_call":
                    return await this.handleGetCall(params, apiKey);
                case "get_call_recording":
                    return await this.handleGetCallRecording(params, apiKey);
                case "get_call_transcript":
                    return await this.handleGetCallTranscript(params, apiKey);
                case "get_voicemail":
                    return await this.handleGetVoicemail(params, apiKey);
                case "list_contacts":
                    return await this.handleListContacts(params, apiKey);
                case "get_contact":
                    return await this.handleGetContact(params, apiKey);
                case "create_contact":
                    return await this.handleCreateContact(params, apiKey);
                case "update_contact":
                    return await this.handleUpdateContact(params, apiKey);
                case "delete_contact":
                    return await this.handleDeleteContact(params, apiKey);
                case "list_users":
                    return await this.handleListUsers(params, apiKey);
                case "raw_api":
                    return await this.executeRawAPI(params as RawAPIParams, userId);
                default:
                    return this.createErrorResponse(
                        `Unknown action: ${action}. Use action='describe' to see available operations.`
                    );
            }
        } catch (error) {
            return this.handleOperationError(
                error,
                action,
                params as Record<string, unknown>,
                userId
            );
        }
    }

    // =========================================================================
    // Message Operations
    // =========================================================================

    private async handleListMessages(
        params: unknown,
        apiKey: string
    ): Promise<MCPToolResponse> {
        const {
            phoneNumberId,
            participants,
            limit = 10,
            createdAfter,
            createdBefore,
            pageToken,
        } = params as {
            phoneNumberId: string;
            participants: string[];
            limit?: number;
            createdAfter?: string;
            createdBefore?: string;
            pageToken?: string;
        };

        const searchParams: Record<string, string> = {
            phoneNumberId,
            maxResults: Math.min(limit, 100).toString(),
            // Participants must be comma-separated in the query string
            participants: participants.join(","),
        };

        if (createdAfter) searchParams.createdAfter = createdAfter;
        if (createdBefore) searchParams.createdBefore = createdBefore;
        if (pageToken) searchParams.pageToken = pageToken;

        const response = await httpClient
            .get(`${QUO_API_BASE}/messages`, {
                headers: this.buildHeaders(apiKey),
                searchParams,
            })
            .json<{
                data: Array<{
                    id: string;
                    from: string;
                    to: string[];
                    text: string;
                    direction: "incoming" | "outgoing";
                    status: string;
                    createdAt: string;
                    phoneNumberId: string;
                }>;
                totalItems?: number;
                nextPageToken?: string;
            }>();

        return this.createJSONResponse({
            phoneNumberId,
            participants,
            messages: response.data.map((msg) => ({
                id: msg.id,
                from: msg.from,
                to: msg.to,
                text: msg.text,
                direction: msg.direction,
                status: msg.status,
                createdAt: msg.createdAt,
            })),
            count: response.data.length,
            totalItems: response.totalItems,
            nextPageToken: response.nextPageToken,
        });
    }

    private async handleGetMessage(
        params: unknown,
        apiKey: string
    ): Promise<MCPToolResponse> {
        const { messageId } = params as { messageId: string };

        const response = await httpClient
            .get(`${QUO_API_BASE}/messages/${messageId}`, {
                headers: this.buildHeaders(apiKey),
            })
            .json<{
                id: string;
                from: string;
                to: string[];
                text: string;
                direction: "incoming" | "outgoing";
                status: string;
                createdAt: string;
                updatedAt: string;
                phoneNumberId: string;
                userId?: string;
            }>();

        return this.createJSONResponse(response);
    }

    private async handleSendMessage(
        params: unknown,
        apiKey: string
    ): Promise<MCPToolResponse> {
        const { from, to, content } = params as {
            from: string;
            to: string[];
            content: string;
        };

        this.logInfo(`📤 [QUO] Sending message from ${from} to ${to.join(", ")}`);

        const response = await httpClient
            .post(`${QUO_API_BASE}/messages`, {
                headers: this.buildHeaders(apiKey),
                json: {
                    from,
                    to,
                    content,
                },
            })
            .json<{
                id: string;
                from: string;
                to: string[];
                status: string;
                createdAt: string;
            }>();

        this.logInfo(`✅ [QUO] Message sent, id: ${response.id}`);

        return this.createJSONResponse({
            success: true,
            id: response.id,
            from: response.from,
            to: response.to,
            status: response.status,
            note: "Message queued for delivery (202 Accepted). Status will update via webhooks.",
        });
    }

    // =========================================================================
    // Conversation Operations
    // =========================================================================

    private async handleListConversations(
        params: unknown,
        apiKey: string
    ): Promise<MCPToolResponse> {
        const {
            phoneNumberIds,
            userIds,
            limit = 10,
            pageToken,
        } = params as {
            phoneNumberIds?: string[];
            userIds?: string[];
            limit?: number;
            pageToken?: string;
        };

        const searchParams: Record<string, string> = {
            maxResults: Math.min(limit, 100).toString(),
        };

        if (phoneNumberIds?.length) {
            searchParams.phoneNumberIds = phoneNumberIds.join(",");
        }
        if (userIds?.length) {
            searchParams.userIds = userIds.join(",");
        }
        if (pageToken) searchParams.pageToken = pageToken;

        const response = await httpClient
            .get(`${QUO_API_BASE}/conversations`, {
                headers: this.buildHeaders(apiKey),
                searchParams,
            })
            .json<{
                data: Array<{
                    id: string;
                    phoneNumberId: string;
                    participants: string[];
                    lastMessageAt?: string;
                    createdAt: string;
                }>;
                nextPageToken?: string;
            }>();

        return this.createJSONResponse({
            conversations: response.data,
            count: response.data.length,
            nextPageToken: response.nextPageToken,
        });
    }

    // =========================================================================
    // Phone Number Operations
    // =========================================================================

    private async handleListPhoneNumbers(
        params: unknown,
        apiKey: string
    ): Promise<MCPToolResponse> {
        const { limit = 10, pageToken } = params as {
            limit?: number;
            pageToken?: string;
        };

        const searchParams: Record<string, string> = {
            maxResults: Math.min(limit, 100).toString(),
        };
        if (pageToken) searchParams.pageToken = pageToken;

        const response = await httpClient
            .get(`${QUO_API_BASE}/phone-numbers`, {
                headers: this.buildHeaders(apiKey),
                searchParams,
            })
            .json<{
                data: Array<{
                    id: string;
                    phoneNumber: string;
                    name?: string;
                    users: Array<{ userId: string; role: string }>;
                    createdAt: string;
                }>;
                nextPageToken?: string;
            }>();

        return this.createJSONResponse({
            phoneNumbers: response.data.map((pn) => ({
                id: pn.id,
                phoneNumber: pn.phoneNumber,
                name: pn.name,
                users: pn.users,
            })),
            count: response.data.length,
            nextPageToken: response.nextPageToken,
        });
    }

    private async handleGetPhoneNumber(
        params: unknown,
        apiKey: string
    ): Promise<MCPToolResponse> {
        const { phoneNumberId } = params as { phoneNumberId: string };

        const response = await httpClient
            .get(`${QUO_API_BASE}/phone-numbers/${phoneNumberId}`, {
                headers: this.buildHeaders(apiKey),
            })
            .json<{
                id: string;
                phoneNumber: string;
                name?: string;
                users: Array<{ userId: string; role: string }>;
                createdAt: string;
            }>();

        return this.createJSONResponse(response);
    }

    // =========================================================================
    // Call Operations
    // =========================================================================

    private async handleListCalls(
        params: unknown,
        apiKey: string
    ): Promise<MCPToolResponse> {
        const {
            phoneNumberId,
            limit = 10,
            createdAfter,
            pageToken,
        } = params as {
            phoneNumberId: string;
            limit?: number;
            createdAfter?: string;
            pageToken?: string;
        };

        const searchParams: Record<string, string> = {
            phoneNumberId,
            maxResults: Math.min(limit, 100).toString(),
        };
        if (createdAfter) searchParams.createdAfter = createdAfter;
        if (pageToken) searchParams.pageToken = pageToken;

        const response = await httpClient
            .get(`${QUO_API_BASE}/calls`, {
                headers: this.buildHeaders(apiKey),
                searchParams,
            })
            .json<{
                data: Array<{
                    id: string;
                    from: string;
                    to: string;
                    direction: "incoming" | "outgoing";
                    status: string;
                    duration?: number;
                    createdAt: string;
                    answeredAt?: string;
                    completedAt?: string;
                }>;
                nextPageToken?: string;
            }>();

        return this.createJSONResponse({
            calls: response.data,
            count: response.data.length,
            nextPageToken: response.nextPageToken,
        });
    }

    private async handleGetCall(
        params: unknown,
        apiKey: string
    ): Promise<MCPToolResponse> {
        const { callId } = params as { callId: string };

        const response = await httpClient
            .get(`${QUO_API_BASE}/calls/${callId}`, {
                headers: this.buildHeaders(apiKey),
            })
            .json<Record<string, unknown>>();

        return this.createJSONResponse(response);
    }

    private async handleGetCallRecording(
        params: unknown,
        apiKey: string
    ): Promise<MCPToolResponse> {
        const { callId } = params as { callId: string };

        const response = await httpClient
            .get(`${QUO_API_BASE}/call-recordings/${callId}`, {
                headers: this.buildHeaders(apiKey),
            })
            .json<{
                data?: Array<{
                    id: string;
                    url: string;
                    duration?: number;
                    createdAt: string;
                }>;
            }>();

        if (!response.data?.length) {
            return this.createErrorResponse("No recording available for this call.");
        }

        return this.createJSONResponse({
            recordings: response.data,
        });
    }

    private async handleGetCallTranscript(
        params: unknown,
        apiKey: string
    ): Promise<MCPToolResponse> {
        const { callId } = params as { callId: string };

        const response = await httpClient
            .get(`${QUO_API_BASE}/call-transcripts/${callId}`, {
                headers: this.buildHeaders(apiKey),
            })
            .json<{
                id?: string;
                text?: string;
                segments?: Array<{
                    speaker: string;
                    text: string;
                    startTime: number;
                    endTime: number;
                }>;
            }>();

        if (!response.text && !response.segments?.length) {
            return this.createErrorResponse(
                "No transcript available. Transcripts are only available on Business/Scale plans."
            );
        }

        return this.createJSONResponse(response);
    }

    private async handleGetVoicemail(
        params: unknown,
        apiKey: string
    ): Promise<MCPToolResponse> {
        const { callId } = params as { callId: string };

        const response = await httpClient
            .get(`${QUO_API_BASE}/call-voicemails/${callId}`, {
                headers: this.buildHeaders(apiKey),
            })
            .json<{
                id?: string;
                url?: string;
                transcription?: string;
                duration?: number;
            }>();

        if (!response.url) {
            return this.createErrorResponse(
                "No voicemail available for this call (may still be processing)."
            );
        }

        return this.createJSONResponse(response);
    }

    // =========================================================================
    // Contact Operations
    // =========================================================================

    private async handleListContacts(
        params: unknown,
        apiKey: string
    ): Promise<MCPToolResponse> {
        const {
            limit = 10,
            externalId,
            pageToken,
        } = params as {
            limit?: number;
            externalId?: string;
            pageToken?: string;
        };

        const searchParams: Record<string, string> = {
            maxResults: Math.min(limit, 100).toString(),
        };
        if (externalId) searchParams.externalId = externalId;
        if (pageToken) searchParams.pageToken = pageToken;

        const response = await httpClient
            .get(`${QUO_API_BASE}/contacts`, {
                headers: this.buildHeaders(apiKey),
                searchParams,
            })
            .json<{
                data: Array<{
                    id: string;
                    firstName?: string;
                    lastName?: string;
                    company?: string;
                    emails?: Array<{ name: string; value: string }>;
                    phoneNumbers?: Array<{ name: string; value: string }>;
                    createdAt: string;
                }>;
                nextPageToken?: string;
            }>();

        return this.createJSONResponse({
            contacts: response.data,
            count: response.data.length,
            nextPageToken: response.nextPageToken,
        });
    }

    private async handleGetContact(
        params: unknown,
        apiKey: string
    ): Promise<MCPToolResponse> {
        const { contactId } = params as { contactId: string };

        const response = await httpClient
            .get(`${QUO_API_BASE}/contacts/${contactId}`, {
                headers: this.buildHeaders(apiKey),
            })
            .json<Record<string, unknown>>();

        return this.createJSONResponse(response);
    }

    private async handleCreateContact(
        params: unknown,
        apiKey: string
    ): Promise<MCPToolResponse> {
        const { firstName, lastName, company, phoneNumbers, emails } = params as {
            firstName?: string;
            lastName?: string;
            company?: string;
            phoneNumbers?: Array<{ name: string; value: string }>;
            emails?: Array<{ name: string; value: string }>;
        };

        const body: Record<string, unknown> = {};
        if (firstName) body.firstName = firstName;
        if (lastName) body.lastName = lastName;
        if (company) body.company = company;
        if (phoneNumbers) body.phoneNumbers = phoneNumbers;
        if (emails) body.emails = emails;

        const response = await httpClient
            .post(`${QUO_API_BASE}/contacts`, {
                headers: this.buildHeaders(apiKey),
                json: body,
            })
            .json<{
                id: string;
                firstName?: string;
                lastName?: string;
                createdAt: string;
            }>();

        this.logInfo(`✅ [QUO] Contact created: ${response.id}`);

        return this.createJSONResponse({
            success: true,
            contact: response,
        });
    }

    private async handleUpdateContact(
        params: unknown,
        apiKey: string
    ): Promise<MCPToolResponse> {
        const { contactId, firstName, lastName, company } = params as {
            contactId: string;
            firstName?: string;
            lastName?: string;
            company?: string;
        };

        const body: Record<string, unknown> = {};
        if (firstName !== undefined) body.firstName = firstName;
        if (lastName !== undefined) body.lastName = lastName;
        if (company !== undefined) body.company = company;

        const response = await httpClient
            .patch(`${QUO_API_BASE}/contacts/${contactId}`, {
                headers: this.buildHeaders(apiKey),
                json: body,
            })
            .json<Record<string, unknown>>();

        return this.createJSONResponse({
            success: true,
            contact: response,
        });
    }

    private async handleDeleteContact(
        params: unknown,
        apiKey: string
    ): Promise<MCPToolResponse> {
        const { contactId } = params as { contactId: string };

        await httpClient.delete(`${QUO_API_BASE}/contacts/${contactId}`, {
            headers: this.buildHeaders(apiKey),
        });

        this.logInfo(`🗑️ [QUO] Contact deleted: ${contactId}`);

        return this.createSuccessResponse(`Contact ${contactId} deleted successfully.`);
    }

    // =========================================================================
    // User Operations
    // =========================================================================

    private async handleListUsers(
        params: unknown,
        apiKey: string
    ): Promise<MCPToolResponse> {
        const { limit = 10, pageToken } = params as {
            limit?: number;
            pageToken?: string;
        };

        const searchParams: Record<string, string> = {
            maxResults: Math.min(limit, 100).toString(),
        };
        if (pageToken) searchParams.pageToken = pageToken;

        const response = await httpClient
            .get(`${QUO_API_BASE}/users`, {
                headers: this.buildHeaders(apiKey),
                searchParams,
            })
            .json<{
                data: Array<{
                    id: string;
                    email: string;
                    firstName?: string;
                    lastName?: string;
                    role: string;
                    createdAt: string;
                }>;
                nextPageToken?: string;
            }>();

        return this.createJSONResponse({
            users: response.data,
            count: response.data.length,
            nextPageToken: response.nextPageToken,
        });
    }

    // =========================================================================
    // Raw API
    // =========================================================================

    async executeRawAPI(
        params: RawAPIParams,
        userId: string
    ): Promise<MCPToolResponse> {
        const { endpoint, method, body, query } = params;

        if (!endpoint || typeof endpoint !== "string") {
            return this.createErrorResponse(
                "raw_api requires 'endpoint' parameter (string)"
            );
        }
        if (!method || typeof method !== "string") {
            return this.createErrorResponse(
                "raw_api requires 'method' parameter (GET, POST, PATCH, DELETE)"
            );
        }

        // Security: validate endpoint starts with /v1
        if (!endpoint.startsWith("/v1/")) {
            return this.createErrorResponse(
                "Invalid endpoint: must start with '/v1/'. Example: '/v1/messages'"
            );
        }

        // Get API key using base class helper
        const keyResult = await this.getApiKeyForExecution(userId);
        if ("isError" in keyResult) return keyResult;
        const { apiKey } = keyResult;

        // Build request options
        const requestOptions: {
            headers: Record<string, string>;
            searchParams?: Record<string, string>;
            json?: Record<string, unknown>;
        } = {
            headers: this.buildHeaders(apiKey),
        };

        if (query && typeof query === "object") {
            requestOptions.searchParams = Object.fromEntries(
                Object.entries(query).map(([k, v]) => [k, String(v)])
            );
        }

        if (["POST", "PATCH"].includes(method.toUpperCase()) && body) {
            requestOptions.json = body;
        }

        try {
            const httpMethod = method.toLowerCase() as
                | "get"
                | "post"
                | "patch"
                | "delete";
            const fullUrl = `https://api.openphone.com${endpoint}`;

            const response = await httpClient[httpMethod](fullUrl, requestOptions).json<
                Record<string, unknown>
            >();

            return this.createJSONResponse(response);
        } catch (error) {
            this.captureAndLogError(error, {
                action: "raw_api",
                params: { endpoint, method },
                userId,
            });

            return this.createErrorResponse(
                `Raw API request failed: ${error instanceof Error ? error.message : "Unknown error"}`
            );
        }
    }
}
