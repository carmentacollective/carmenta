/**
 * CoinMarketCap Service Adapter
 *
 * Cryptocurrency market data via API key authentication.
 *
 * ## Code-Relevant Gotchas
 * - Symbol lookups can return multiple tokens with same symbol - use CMC ID for precision
 * - Error codes: 1002→401, 1006→403, 1008→429 (code maps these)
 * - Free tier blocks /v1/cryptocurrency/ohlcv and historical endpoints
 */

import { ServiceAdapter, HelpResponse, MCPToolResponse, RawAPIParams } from "./base";
import { getCredentials } from "@/lib/integrations/connection-manager";
import { isApiKeyCredentials } from "@/lib/integrations/encryption";
import { httpClient } from "@/lib/http-client";
import { env } from "@/lib/env";
import { ValidationError } from "@/lib/errors";

const CMC_API_BASE = "https://pro-api.coinmarketcap.com";

export class CoinMarketCapAdapter extends ServiceAdapter {
    serviceName = "coinmarketcap";
    serviceDisplayName = "CoinMarketCap";

    /**
     * Test the API key by making a lightweight API call
     * Uses /v1/key/info endpoint which returns info about the key's plan and usage
     */
    async testConnection(
        apiKey: string
    ): Promise<{ success: boolean; error?: string }> {
        try {
            const response = await httpClient
                .get(`${CMC_API_BASE}/v1/key/info`, {
                    headers: {
                        "X-CMC_PRO_API_KEY": apiKey,
                        Accept: "application/json",
                    },
                })
                .json<{
                    data: {
                        plan: {
                            plan_name: string;
                            credit_limit_monthly: number;
                        };
                    };
                }>();

            // If we got here, the API key is valid
            const planName = response.data?.plan?.plan_name || "Unknown";
            return {
                success: true,
                error: undefined,
            };
        } catch (error) {
            // Parse the error to give helpful feedback
            const errorMessage = error instanceof Error ? error.message : String(error);

            if (errorMessage.includes("401") || errorMessage.includes("Unauthorized")) {
                return {
                    success: false,
                    error: "Invalid API key. Please check your key and try again.",
                };
            }

            if (errorMessage.includes("403") || errorMessage.includes("Forbidden")) {
                return {
                    success: false,
                    error: "API key doesn't have permission. Check your subscription plan.",
                };
            }

            if (errorMessage.includes("429")) {
                return {
                    success: false,
                    error: "Rate limit exceeded. Please wait a moment and try again.",
                };
            }

            // Generic error
            return {
                success: false,
                error: `Connection test failed: ${errorMessage}`,
            };
        }
    }

    getHelp(): HelpResponse {
        return {
            service: this.serviceDisplayName,
            description:
                "CoinMarketCap is the world's most-referenced cryptocurrency price tracker and market data provider",
            operations: [
                {
                    name: "get_listings",
                    description:
                        "Get latest market data for active cryptocurrencies (paginated list)",
                    annotations: { readOnlyHint: true },
                    parameters: [
                        {
                            name: "start",
                            type: "number",
                            required: false,
                            description: "Start index for pagination (default: 1)",
                            example: "1",
                        },
                        {
                            name: "limit",
                            type: "number",
                            required: false,
                            description:
                                "Number of results to return (default: 100, max: 5000)",
                            example: "10",
                        },
                        {
                            name: "convert",
                            type: "string",
                            required: false,
                            description: "Currency to convert prices to (default: USD)",
                            example: "EUR",
                        },
                        {
                            name: "sort",
                            type: "string",
                            required: false,
                            description:
                                "Field to sort by: market_cap, name, symbol, price, volume_24h, percent_change_24h",
                            example: "market_cap",
                        },
                        {
                            name: "sort_dir",
                            type: "string",
                            required: false,
                            description: "Sort direction: asc or desc (default: desc)",
                            example: "desc",
                        },
                    ],
                    returns:
                        "List of cryptocurrencies with price, market cap, volume, and percent changes",
                    example: `get_listings({ limit: 10, sort: "market_cap" })`,
                },
                {
                    name: "get_quotes",
                    description:
                        "Get latest market quotes for specific cryptocurrencies",
                    annotations: { readOnlyHint: true },
                    parameters: [
                        {
                            name: "symbol",
                            type: "string",
                            required: false,
                            description:
                                "Comma-separated list of cryptocurrency symbols (e.g., BTC,ETH,SOL)",
                        },
                        {
                            name: "id",
                            type: "string",
                            required: false,
                            description:
                                "Comma-separated list of CoinMarketCap cryptocurrency IDs",
                        },
                        {
                            name: "slug",
                            type: "string",
                            required: false,
                            description:
                                "Comma-separated list of cryptocurrency slugs (e.g., bitcoin,ethereum)",
                        },
                        {
                            name: "convert",
                            type: "string",
                            required: false,
                            description: "Currency to convert prices to (default: USD)",
                            example: "EUR",
                        },
                    ],
                    returns: "Latest market quotes with detailed price and volume data",
                    example: `get_quotes({ symbol: "BTC,ETH,SOL" })`,
                },
                {
                    name: "get_crypto_info",
                    description:
                        "Get static metadata for cryptocurrencies (logo, description, URLs)",
                    annotations: { readOnlyHint: true },
                    parameters: [
                        {
                            name: "symbol",
                            type: "string",
                            required: false,
                            description:
                                "Comma-separated list of cryptocurrency symbols (e.g., BTC,ETH)",
                        },
                        {
                            name: "id",
                            type: "string",
                            required: false,
                            description:
                                "Comma-separated list of CoinMarketCap cryptocurrency IDs",
                        },
                        {
                            name: "slug",
                            type: "string",
                            required: false,
                            description: "Comma-separated list of cryptocurrency slugs",
                        },
                    ],
                    returns:
                        "Cryptocurrency metadata including name, logo, description, website, social links",
                },
                {
                    name: "get_global_metrics",
                    description: "Get latest global cryptocurrency market metrics",
                    annotations: { readOnlyHint: true },
                    parameters: [
                        {
                            name: "convert",
                            type: "string",
                            required: false,
                            description: "Currency to convert values to (default: USD)",
                            example: "EUR",
                        },
                    ],
                    returns:
                        "Global metrics like total market cap, 24h volume, BTC dominance, active cryptocurrencies",
                },
                {
                    name: "get_categories",
                    description: "List all cryptocurrency categories",
                    annotations: { readOnlyHint: true },
                    parameters: [
                        {
                            name: "start",
                            type: "number",
                            required: false,
                            description: "Start index for pagination (default: 1)",
                        },
                        {
                            name: "limit",
                            type: "number",
                            required: false,
                            description: "Number of results (default: 100)",
                        },
                    ],
                    returns:
                        "List of categories (DeFi, NFT, Memes, etc.) with market data",
                },
                {
                    name: "get_category",
                    description:
                        "Get detailed data for a specific cryptocurrency category",
                    annotations: { readOnlyHint: true },
                    parameters: [
                        {
                            name: "id",
                            type: "string",
                            required: true,
                            description: "Category ID from get_categories",
                        },
                        {
                            name: "start",
                            type: "number",
                            required: false,
                            description: "Start index for tokens in category",
                        },
                        {
                            name: "limit",
                            type: "number",
                            required: false,
                            description: "Number of tokens to return",
                        },
                    ],
                    returns: "Category details with list of tokens and market data",
                },
                {
                    name: "get_crypto_map",
                    description:
                        "Get mapping of all cryptocurrencies to CoinMarketCap IDs",
                    annotations: { readOnlyHint: true },
                    parameters: [
                        {
                            name: "start",
                            type: "number",
                            required: false,
                            description: "Start index for pagination",
                        },
                        {
                            name: "limit",
                            type: "number",
                            required: false,
                            description: "Number of results (default: 100, max: 5000)",
                        },
                        {
                            name: "symbol",
                            type: "string",
                            required: false,
                            description: "Filter by symbol (e.g., BTC)",
                        },
                    ],
                    returns:
                        "Map of cryptocurrency names, symbols, and slugs to their IDs",
                },
                {
                    name: "convert_price",
                    description: "Convert an amount from one currency to another",
                    annotations: { readOnlyHint: true },
                    parameters: [
                        {
                            name: "amount",
                            type: "number",
                            required: true,
                            description: "Amount to convert",
                            example: "100",
                        },
                        {
                            name: "symbol",
                            type: "string",
                            required: false,
                            description: "Source currency symbol (e.g., BTC)",
                        },
                        {
                            name: "id",
                            type: "string",
                            required: false,
                            description: "Source currency CoinMarketCap ID",
                        },
                        {
                            name: "convert",
                            type: "string",
                            required: true,
                            description:
                                "Target currency symbol or comma-separated list (e.g., USD,EUR)",
                        },
                    ],
                    returns: "Converted amounts with exchange rates and timestamps",
                    example: `convert_price({ amount: 1, symbol: "BTC", convert: "USD,EUR" })`,
                },
                {
                    name: "get_exchange_map",
                    description: "Get mapping of all exchanges to CoinMarketCap IDs",
                    annotations: { readOnlyHint: true },
                    parameters: [
                        {
                            name: "start",
                            type: "number",
                            required: false,
                            description: "Start index for pagination",
                        },
                        {
                            name: "limit",
                            type: "number",
                            required: false,
                            description: "Number of results",
                        },
                    ],
                    returns: "List of exchanges with IDs, names, and slugs",
                },
                {
                    name: "get_exchange_info",
                    description: "Get metadata for one or more exchanges",
                    annotations: { readOnlyHint: true },
                    parameters: [
                        {
                            name: "id",
                            type: "string",
                            required: false,
                            description: "Comma-separated exchange IDs",
                        },
                        {
                            name: "slug",
                            type: "string",
                            required: false,
                            description: "Comma-separated exchange slugs",
                        },
                    ],
                    returns:
                        "Exchange details including logo, description, launch date, fees, URLs",
                },
                {
                    name: "raw_api",
                    description:
                        "Use this operation when the user requests functionality that doesn't have a dedicated operation listed above. " +
                        "This gives you direct access to the full CoinMarketCap API - you can perform nearly any operation supported by CoinMarketCap. " +
                        "If you're familiar with the CoinMarketCap API structure, construct the request directly. " +
                        "If unsure/errors: try context7 docs (/websites/coinmarketcap_api) or https://coinmarketcap.com/api/documentation/v1/",
                    parameters: [
                        {
                            name: "endpoint",
                            type: "string",
                            required: true,
                            description:
                                "CoinMarketCap API endpoint path (e.g., '/v1/cryptocurrency/listings/latest', '/v1/global-metrics/quotes/latest')",
                            example: "/v1/cryptocurrency/listings/latest",
                        },
                        {
                            name: "method",
                            type: "string",
                            required: true,
                            description: "HTTP method (GET, POST)",
                            example: "GET",
                        },
                        {
                            name: "query",
                            type: "object",
                            required: false,
                            description: "Query parameters as key-value pairs",
                        },
                    ],
                    returns: "Raw CoinMarketCap API response as JSON",
                },
            ],
            commonOperations: ["get_listings", "get_quotes", "get_crypto_info"],
            docsUrl: "https://coinmarketcap.com/api/documentation/v1/",
        };
    }

    async execute(
        action: string,
        params: unknown,
        userId: string,
        _accountId?: string // Multi-account support not yet implemented
    ): Promise<MCPToolResponse> {
        // Validate action and params
        const validation = this.validate(action, params);
        if (!validation.valid) {
            this.logError(
                `📥 [COINMARKETCAP ADAPTER] Validation failed for action '${action}':`,
                validation.errors
            );
            return this.createErrorResponse(
                `Validation errors:\n${validation.errors.join("\n")}`
            );
        }

        // Get user's API key credentials
        let apiKey: string;
        try {
            const connectionCreds = await getCredentials(userId, this.serviceName);

            if (connectionCreds.type !== "api_key" || !connectionCreds.credentials) {
                return this.createErrorResponse(
                    "Invalid credentials type for CoinMarketCap service"
                );
            }

            if (!isApiKeyCredentials(connectionCreds.credentials)) {
                return this.createErrorResponse(
                    "Invalid credential format for CoinMarketCap service"
                );
            }

            apiKey = connectionCreds.credentials.apiKey;
        } catch (error) {
            if (error instanceof ValidationError) {
                return this.createErrorResponse(
                    "CoinMarketCap isn't connected yet. Connect it in Integrations to use crypto market data."
                );
            }
            throw error;
        }

        // Route to appropriate handler
        try {
            switch (action) {
                case "get_listings":
                    return await this.handleGetListings(params, apiKey);
                case "get_quotes":
                    return await this.handleGetQuotes(params, apiKey);
                case "get_crypto_info":
                    return await this.handleGetCryptoInfo(params, apiKey);
                case "get_global_metrics":
                    return await this.handleGetGlobalMetrics(params, apiKey);
                case "get_categories":
                    return await this.handleGetCategories(params, apiKey);
                case "get_category":
                    return await this.handleGetCategory(params, apiKey);
                case "get_crypto_map":
                    return await this.handleGetCryptoMap(params, apiKey);
                case "convert_price":
                    return await this.handleConvertPrice(params, apiKey);
                case "get_exchange_map":
                    return await this.handleGetExchangeMap(params, apiKey);
                case "get_exchange_info":
                    return await this.handleGetExchangeInfo(params, apiKey);
                case "raw_api":
                    return await this.executeRawAPI(params as RawAPIParams, userId);
                default:
                    return this.createErrorResponse(
                        `Unknown action: ${action}. Use action='describe' to see available operations.`
                    );
            }
        } catch (error) {
            this.logError(
                `❌ [COINMARKETCAP ADAPTER] Failed to execute ${action} for user ${userId}:`,
                {
                    error: error instanceof Error ? error.message : String(error),
                    stack: error instanceof Error ? error.stack : undefined,
                    params,
                }
            );

            // Capture error to Sentry for monitoring and alerting
            this.captureError(error, {
                action,
                params: params as Record<string, unknown>,
                userId,
            });

            let errorMessage = `Failed to ${action}: `;
            if (error instanceof Error) {
                if (error.message.includes("401") || error.message.includes("1002")) {
                    errorMessage +=
                        "Authentication failed. Your API key may be invalid - try reconnecting in Integrations.";
                } else if (
                    error.message.includes("429") ||
                    error.message.includes("1008")
                ) {
                    errorMessage +=
                        "Rate limit exceeded. Please try again in a few moments.";
                } else if (
                    error.message.includes("403") ||
                    error.message.includes("1006")
                ) {
                    errorMessage +=
                        "Your API key subscription plan doesn't support this endpoint. Upgrade at https://coinmarketcap.com/api/pricing/";
                } else {
                    errorMessage += error.message;
                }
            } else {
                errorMessage += "Unknown error";
            }

            return this.createErrorResponse(errorMessage);
        }
    }

    private async handleGetListings(
        params: unknown,
        apiKey: string
    ): Promise<MCPToolResponse> {
        const {
            start = 1,
            limit = 100,
            convert = "USD",
            sort,
            sort_dir,
        } = params as {
            start?: number;
            limit?: number;
            convert?: string;
            sort?: string;
            sort_dir?: string;
        };

        const queryParams: Record<string, string> = {
            start: start.toString(),
            limit: Math.min(limit, 5000).toString(),
            convert,
        };

        if (sort) queryParams.sort = sort;
        if (sort_dir) queryParams.sort_dir = sort_dir;

        this.logInfo(`📊 [COINMARKETCAP ADAPTER] Getting listings (limit: ${limit})`);

        const response = await httpClient
            .get(`${CMC_API_BASE}/v1/cryptocurrency/listings/latest`, {
                headers: {
                    "X-CMC_PRO_API_KEY": apiKey,
                    Accept: "application/json",
                },
                searchParams: queryParams,
            })
            .json<{
                data: Array<{
                    id: number;
                    name: string;
                    symbol: string;
                    slug: string;
                    cmc_rank: number;
                    quote: Record<
                        string,
                        {
                            price: number;
                            volume_24h: number;
                            market_cap: number;
                            percent_change_1h: number;
                            percent_change_24h: number;
                            percent_change_7d: number;
                        }
                    >;
                }>;
                status: {
                    timestamp: string;
                    credit_count: number;
                };
            }>();

        if (!response.data || response.data.length === 0) {
            return this.createJSONResponse({
                message: "No cryptocurrencies found",
                total: 0,
                results: [],
            });
        }

        this.logInfo(
            `✅ [COINMARKETCAP ADAPTER] Retrieved ${response.data.length} cryptocurrencies`
        );

        return this.createJSONResponse({
            total: response.data.length,
            results: response.data.map((crypto) => ({
                id: crypto.id,
                name: crypto.name,
                symbol: crypto.symbol,
                slug: crypto.slug,
                rank: crypto.cmc_rank,
                quote: crypto.quote,
            })),
            status: response.status,
        });
    }

    private async handleGetQuotes(
        params: unknown,
        apiKey: string
    ): Promise<MCPToolResponse> {
        const {
            symbol,
            id,
            slug,
            convert = "USD",
        } = params as {
            symbol?: string;
            id?: string;
            slug?: string;
            convert?: string;
        };

        if (!symbol && !id && !slug) {
            return this.createErrorResponse(
                "At least one of symbol, id, or slug is required"
            );
        }

        const queryParams: Record<string, string> = { convert };
        if (symbol) queryParams.symbol = symbol;
        if (id) queryParams.id = id;
        if (slug) queryParams.slug = slug;

        this.logInfo(
            `💱 [COINMARKETCAP ADAPTER] Getting quotes for ${symbol || id || slug}`
        );

        const response = await httpClient
            .get(`${CMC_API_BASE}/v2/cryptocurrency/quotes/latest`, {
                headers: {
                    "X-CMC_PRO_API_KEY": apiKey,
                    Accept: "application/json",
                },
                searchParams: queryParams,
            })
            .json<{
                data: Record<
                    string,
                    Array<{
                        id: number;
                        name: string;
                        symbol: string;
                        slug: string;
                        quote: Record<
                            string,
                            {
                                price: number;
                                volume_24h: number;
                                market_cap: number;
                                percent_change_1h: number;
                                percent_change_24h: number;
                                percent_change_7d: number;
                                last_updated: string;
                            }
                        >;
                    }>
                >;
                status: {
                    timestamp: string;
                    credit_count: number;
                };
            }>();

        this.logInfo(`✅ [COINMARKETCAP ADAPTER] Retrieved quotes`);

        return this.createJSONResponse(response);
    }

    private async handleGetCryptoInfo(
        params: unknown,
        apiKey: string
    ): Promise<MCPToolResponse> {
        const { symbol, id, slug } = params as {
            symbol?: string;
            id?: string;
            slug?: string;
        };

        if (!symbol && !id && !slug) {
            return this.createErrorResponse(
                "At least one of symbol, id, or slug is required"
            );
        }

        const queryParams: Record<string, string> = {};
        if (symbol) queryParams.symbol = symbol;
        if (id) queryParams.id = id;
        if (slug) queryParams.slug = slug;

        this.logInfo(
            `ℹ️ [COINMARKETCAP ADAPTER] Getting crypto info for ${symbol || id || slug}`
        );

        const response = await httpClient
            .get(`${CMC_API_BASE}/v2/cryptocurrency/info`, {
                headers: {
                    "X-CMC_PRO_API_KEY": apiKey,
                    Accept: "application/json",
                },
                searchParams: queryParams,
            })
            .json<{
                data: Record<
                    string,
                    {
                        id: number;
                        name: string;
                        symbol: string;
                        category: string;
                        description: string;
                        logo: string;
                        urls: {
                            website: string[];
                            twitter: string[];
                            technical_doc: string[];
                            reddit: string[];
                        };
                    }
                >;
            }>();

        this.logInfo(`✅ [COINMARKETCAP ADAPTER] Retrieved crypto info`);

        return this.createJSONResponse(response);
    }

    private async handleGetGlobalMetrics(
        params: unknown,
        apiKey: string
    ): Promise<MCPToolResponse> {
        const { convert = "USD" } = params as { convert?: string };

        this.logInfo(`🌍 [COINMARKETCAP ADAPTER] Getting global metrics`);

        const response = await httpClient
            .get(`${CMC_API_BASE}/v1/global-metrics/quotes/latest`, {
                headers: {
                    "X-CMC_PRO_API_KEY": apiKey,
                    Accept: "application/json",
                },
                searchParams: { convert },
            })
            .json<{
                data: {
                    active_cryptocurrencies: number;
                    active_exchanges: number;
                    active_market_pairs: number;
                    quote: Record<
                        string,
                        {
                            total_market_cap: number;
                            total_volume_24h: number;
                            btc_dominance: number;
                            eth_dominance: number;
                            last_updated: string;
                        }
                    >;
                };
            }>();

        this.logInfo(`✅ [COINMARKETCAP ADAPTER] Retrieved global metrics`);

        return this.createJSONResponse(response);
    }

    private async handleGetCategories(
        params: unknown,
        apiKey: string
    ): Promise<MCPToolResponse> {
        const { start = 1, limit = 100 } = params as {
            start?: number;
            limit?: number;
        };

        this.logInfo(`🏷️ [COINMARKETCAP ADAPTER] Getting categories`);

        const response = await httpClient
            .get(`${CMC_API_BASE}/v1/cryptocurrency/categories`, {
                headers: {
                    "X-CMC_PRO_API_KEY": apiKey,
                    Accept: "application/json",
                },
                searchParams: {
                    start: start.toString(),
                    limit: limit.toString(),
                },
            })
            .json<Record<string, unknown>>();

        this.logInfo(`✅ [COINMARKETCAP ADAPTER] Retrieved categories`);

        return this.createJSONResponse(response);
    }

    private async handleGetCategory(
        params: unknown,
        apiKey: string
    ): Promise<MCPToolResponse> {
        const {
            id,
            start = 1,
            limit = 100,
        } = params as {
            id: string;
            start?: number;
            limit?: number;
        };

        this.logInfo(`🏷️ [COINMARKETCAP ADAPTER] Getting category: ${id}`);

        const response = await httpClient
            .get(`${CMC_API_BASE}/v1/cryptocurrency/category`, {
                headers: {
                    "X-CMC_PRO_API_KEY": apiKey,
                    Accept: "application/json",
                },
                searchParams: {
                    id,
                    start: start.toString(),
                    limit: limit.toString(),
                },
            })
            .json<Record<string, unknown>>();

        this.logInfo(`✅ [COINMARKETCAP ADAPTER] Retrieved category`);

        return this.createJSONResponse(response);
    }

    private async handleGetCryptoMap(
        params: unknown,
        apiKey: string
    ): Promise<MCPToolResponse> {
        const {
            start = 1,
            limit = 100,
            symbol,
        } = params as {
            start?: number;
            limit?: number;
            symbol?: string;
        };

        const queryParams: Record<string, string> = {
            start: start.toString(),
            limit: Math.min(limit, 5000).toString(),
        };
        if (symbol) queryParams.symbol = symbol;

        this.logInfo(`🗺️ [COINMARKETCAP ADAPTER] Getting crypto map`);

        const response = await httpClient
            .get(`${CMC_API_BASE}/v1/cryptocurrency/map`, {
                headers: {
                    "X-CMC_PRO_API_KEY": apiKey,
                    Accept: "application/json",
                },
                searchParams: queryParams,
            })
            .json<Record<string, unknown>>();

        this.logInfo(`✅ [COINMARKETCAP ADAPTER] Retrieved crypto map`);

        return this.createJSONResponse(response);
    }

    private async handleConvertPrice(
        params: unknown,
        apiKey: string
    ): Promise<MCPToolResponse> {
        const { amount, symbol, id, convert } = params as {
            amount: number;
            symbol?: string;
            id?: string;
            convert: string;
        };

        if (!symbol && !id) {
            return this.createErrorResponse("Either symbol or id is required");
        }
        if (typeof amount !== "number" || !convert) {
            return this.createErrorResponse("amount and convert are required");
        }

        const queryParams: Record<string, string> = {
            amount: amount.toString(),
            convert,
        };
        if (symbol) queryParams.symbol = symbol;
        if (id) queryParams.id = id;

        this.logInfo(
            `💱 [COINMARKETCAP ADAPTER] Converting ${amount} ${symbol || id} to ${convert}`
        );

        const response = await httpClient
            .get(`${CMC_API_BASE}/v2/tools/price-conversion`, {
                headers: {
                    "X-CMC_PRO_API_KEY": apiKey,
                    Accept: "application/json",
                },
                searchParams: queryParams,
            })
            .json<Record<string, unknown>>();

        this.logInfo(`✅ [COINMARKETCAP ADAPTER] Converted price`);

        return this.createJSONResponse(response);
    }

    private async handleGetExchangeMap(
        params: unknown,
        apiKey: string
    ): Promise<MCPToolResponse> {
        const { start = 1, limit = 100 } = params as {
            start?: number;
            limit?: number;
        };

        this.logInfo(`🏦 [COINMARKETCAP ADAPTER] Getting exchange map`);

        const response = await httpClient
            .get(`${CMC_API_BASE}/v1/exchange/map`, {
                headers: {
                    "X-CMC_PRO_API_KEY": apiKey,
                    Accept: "application/json",
                },
                searchParams: {
                    start: start.toString(),
                    limit: limit.toString(),
                },
            })
            .json<Record<string, unknown>>();

        this.logInfo(`✅ [COINMARKETCAP ADAPTER] Retrieved exchange map`);

        return this.createJSONResponse(response);
    }

    private async handleGetExchangeInfo(
        params: unknown,
        apiKey: string
    ): Promise<MCPToolResponse> {
        const { id, slug } = params as { id?: string; slug?: string };

        if (!id && !slug) {
            return this.createErrorResponse("Either id or slug is required");
        }

        const queryParams: Record<string, string> = {};
        if (id) queryParams.id = id;
        if (slug) queryParams.slug = slug;

        this.logInfo(
            `🏦 [COINMARKETCAP ADAPTER] Getting exchange info for ${id || slug}`
        );

        const response = await httpClient
            .get(`${CMC_API_BASE}/v1/exchange/info`, {
                headers: {
                    "X-CMC_PRO_API_KEY": apiKey,
                    Accept: "application/json",
                },
                searchParams: queryParams,
            })
            .json<Record<string, unknown>>();

        this.logInfo(`✅ [COINMARKETCAP ADAPTER] Retrieved exchange info`);

        return this.createJSONResponse(response);
    }

    async executeRawAPI(
        params: RawAPIParams,
        userId: string
    ): Promise<MCPToolResponse> {
        const { endpoint, method, query } = params;

        // Validate parameters
        if (!endpoint || typeof endpoint !== "string") {
            return this.createErrorResponse(
                "raw_api requires 'endpoint' parameter (string)"
            );
        }
        if (!method || typeof method !== "string") {
            return this.createErrorResponse(
                "raw_api requires 'method' parameter (GET, POST)"
            );
        }

        // Security: validate endpoint starts with /v1 or /v2 or /v3 or /v4
        if (!endpoint.match(/^\/v[1-4]\//)) {
            return this.createErrorResponse(
                "Invalid endpoint: must start with '/v1/', '/v2/', '/v3/', or '/v4/'. " +
                    `Got: ${endpoint}. ` +
                    "Example: '/v1/cryptocurrency/listings/latest'"
            );
        }

        // Get API key
        let apiKey: string;
        try {
            const connectionCreds = await getCredentials(userId, this.serviceName);
            if (connectionCreds.type !== "api_key" || !connectionCreds.credentials) {
                return this.createErrorResponse("Invalid credentials");
            }
            if (!isApiKeyCredentials(connectionCreds.credentials)) {
                return this.createErrorResponse("Invalid credential format");
            }
            apiKey = connectionCreds.credentials.apiKey;
        } catch (error) {
            if (error instanceof ValidationError) {
                return this.createErrorResponse(
                    "CoinMarketCap isn't connected yet. Connect it in Integrations to use crypto market data."
                );
            }
            throw error;
        }

        // Build request options
        const requestOptions: {
            headers: Record<string, string>;
            searchParams?: Record<string, string>;
        } = {
            headers: {
                "X-CMC_PRO_API_KEY": apiKey,
                Accept: "application/json",
            },
        };

        if (query && typeof query === "object") {
            requestOptions.searchParams = Object.fromEntries(
                Object.entries(query).map(([k, v]) => [k, String(v)])
            );
        }

        try {
            const httpMethod = method.toLowerCase() as "get" | "post";

            // Build full URL
            const fullUrl = `${CMC_API_BASE}${endpoint}`;

            this.logInfo(`🔧 [COINMARKETCAP ADAPTER] Raw API: ${method} ${endpoint}`);

            const response = await httpClient[httpMethod](fullUrl, requestOptions).json<
                Record<string, unknown>
            >();

            this.logInfo(`✅ [COINMARKETCAP ADAPTER] Raw API call successful`);

            return this.createJSONResponse(response);
        } catch (error) {
            this.logError(
                `❌ [COINMARKETCAP ADAPTER] Raw API request failed for user ${userId}:`,
                {
                    endpoint,
                    method,
                    error: error instanceof Error ? error.message : String(error),
                }
            );

            // Capture error to Sentry for monitoring and alerting
            this.captureError(error, {
                action: "raw_api",
                params: { endpoint, method },
                userId,
            });

            let errorMessage = `Raw API request failed: `;
            if (error instanceof Error) {
                if (error.message.includes("404")) {
                    errorMessage += "Endpoint not found. Check the API documentation.";
                } else if (
                    error.message.includes("401") ||
                    error.message.includes("1002")
                ) {
                    errorMessage += "Authentication failed. Please check your API key.";
                } else if (
                    error.message.includes("403") ||
                    error.message.includes("1006")
                ) {
                    errorMessage +=
                        "Your subscription plan doesn't support this endpoint.";
                } else {
                    errorMessage += error.message;
                }
            } else {
                errorMessage += "Unknown error";
            }

            return this.createErrorResponse(errorMessage);
        }
    }
}
