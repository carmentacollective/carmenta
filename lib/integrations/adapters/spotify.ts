/**
 * Spotify Service Adapter
 *
 * Music streaming via Spotify API using in-house OAuth.
 *
 * ## Use Cases
 * - Music discovery: Search for tracks, albums, artists, playlists
 * - What's playing: Get currently playing track, playback state
 * - Playback control: Play, pause, skip (requires Premium)
 * - Listening insights: Top artists/tracks, recently played
 * - Playlist management: List playlists, get playlist details
 *
 * ## Premium vs Free
 * Playback control (play, pause, next, previous) requires Spotify Premium.
 * Free users will get a 403 error on these operations.
 */

import { ServiceAdapter, HelpResponse, MCPToolResponse, RawAPIParams } from "./base";
import { httpClient } from "@/lib/http-client";
import { logger } from "@/lib/logger";
import { SPOTIFY_API_BASE } from "../oauth/providers/spotify";

export class SpotifyAdapter extends ServiceAdapter {
    serviceName = "spotify";
    serviceDisplayName = "Spotify";

    /**
     * Build headers for Spotify API requests.
     * Spotify uses Bearer token authentication.
     */
    private buildHeaders(accessToken: string): Record<string, string> {
        return {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
        };
    }

    /**
     * Test the OAuth connection by making a live API request.
     * Called when user clicks "Test" button to verify credentials are working.
     */
    async testConnection(
        credentialOrToken: string,
        userId?: string
    ): Promise<{ success: boolean; error?: string }> {
        try {
            await httpClient
                .get(`${SPOTIFY_API_BASE}/me`, {
                    headers: this.buildHeaders(credentialOrToken),
                })
                .json<Record<string, unknown>>();

            return { success: true };
        } catch (error) {
            logger.error({ error, userId }, "Failed to verify Spotify connection");
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
                "Music streaming and discovery. Playback control requires Spotify Premium.",
            commonOperations: ["search", "get_currently_playing", "list_playlists"],
            operations: [
                {
                    name: "search",
                    description:
                        "Search for tracks, albums, artists, playlists, shows, or episodes",
                    parameters: [
                        {
                            name: "query",
                            type: "string",
                            required: true,
                            description:
                                "Search query (e.g., 'Bohemian Rhapsody', 'artist:Queen', 'genre:rock')",
                            example: "Bohemian Rhapsody",
                        },
                        {
                            name: "type",
                            type: "string",
                            required: false,
                            description:
                                "Type(s) to search for: track, album, artist, playlist, show, episode. Comma-separated for multiple.",
                            example: "track,artist",
                        },
                        {
                            name: "limit",
                            type: "number",
                            required: false,
                            description: "Max results to return (1-50, default: 20)",
                            example: "10",
                        },
                    ],
                    returns:
                        "List of matching items with name, artist, album info, and Spotify URLs",
                    example: `search({ query: "ambient focus music", type: "playlist", limit: 5 })`,
                    annotations: { readOnlyHint: true },
                },
                {
                    name: "get_currently_playing",
                    description: "Get the currently playing track with progress",
                    parameters: [],
                    returns:
                        "Current track info including name, artist, album, progress, and device",
                    example: `get_currently_playing()`,
                    annotations: { readOnlyHint: true },
                },
                {
                    name: "get_playback_state",
                    description:
                        "Get full playback state including device info, shuffle, repeat mode",
                    parameters: [],
                    returns:
                        "Detailed playback state with device, shuffle/repeat settings, and current track",
                    example: `get_playback_state()`,
                    annotations: { readOnlyHint: true },
                },
                {
                    name: "play",
                    description:
                        "Start or resume playback. Optionally specify what to play. Requires Premium.",
                    parameters: [
                        {
                            name: "uri",
                            type: "string",
                            required: false,
                            description:
                                "Spotify URI to play (track, album, playlist, artist). If omitted, resumes current playback.",
                            example: "spotify:track:4iV5W9uYEdYUVa79Axb7Rh",
                        },
                        {
                            name: "device_id",
                            type: "string",
                            required: false,
                            description:
                                "Device ID to play on. If omitted, uses active device.",
                        },
                    ],
                    returns: "Confirmation that playback started",
                    example: `play({ uri: "spotify:playlist:37i9dQZF1DX3rxVfibe1L0" })`,
                    annotations: { readOnlyHint: false, destructiveHint: false },
                },
                {
                    name: "pause",
                    description: "Pause playback. Requires Premium.",
                    parameters: [
                        {
                            name: "device_id",
                            type: "string",
                            required: false,
                            description:
                                "Device ID to pause. If omitted, uses active device.",
                        },
                    ],
                    returns: "Confirmation that playback paused",
                    example: `pause()`,
                    annotations: { readOnlyHint: false, destructiveHint: false },
                },
                {
                    name: "next",
                    description: "Skip to next track. Requires Premium.",
                    parameters: [
                        {
                            name: "device_id",
                            type: "string",
                            required: false,
                            description: "Device ID. If omitted, uses active device.",
                        },
                    ],
                    returns: "Confirmation that skipped to next track",
                    example: `next()`,
                    annotations: { readOnlyHint: false, destructiveHint: false },
                },
                {
                    name: "previous",
                    description: "Skip to previous track. Requires Premium.",
                    parameters: [
                        {
                            name: "device_id",
                            type: "string",
                            required: false,
                            description: "Device ID. If omitted, uses active device.",
                        },
                    ],
                    returns: "Confirmation that skipped to previous track",
                    example: `previous()`,
                    annotations: { readOnlyHint: false, destructiveHint: false },
                },
                {
                    name: "get_recently_played",
                    description: "Get recently played tracks",
                    parameters: [
                        {
                            name: "limit",
                            type: "number",
                            required: false,
                            description: "Max tracks to return (1-50, default: 20)",
                            example: "10",
                        },
                    ],
                    returns: "List of recently played tracks with timestamps",
                    example: `get_recently_played({ limit: 10 })`,
                    annotations: { readOnlyHint: true },
                },
                {
                    name: "get_top_items",
                    description:
                        "Get user's top artists or tracks based on listening history",
                    parameters: [
                        {
                            name: "type",
                            type: "string",
                            required: true,
                            description: "Type of items: 'artists' or 'tracks'",
                            example: "artists",
                        },
                        {
                            name: "time_range",
                            type: "string",
                            required: false,
                            description:
                                "Time range: 'short_term' (~4 weeks), 'medium_term' (~6 months), 'long_term' (~years). Default: medium_term",
                            example: "short_term",
                        },
                        {
                            name: "limit",
                            type: "number",
                            required: false,
                            description: "Max items to return (1-50, default: 20)",
                            example: "10",
                        },
                    ],
                    returns: "Top artists or tracks for the specified time period",
                    example: `get_top_items({ type: "artists", time_range: "short_term", limit: 10 })`,
                    annotations: { readOnlyHint: true },
                },
                {
                    name: "list_playlists",
                    description: "Get user's playlists (owned and followed)",
                    parameters: [
                        {
                            name: "limit",
                            type: "number",
                            required: false,
                            description: "Max playlists to return (1-50, default: 20)",
                            example: "10",
                        },
                        {
                            name: "offset",
                            type: "number",
                            required: false,
                            description: "Offset for pagination (default: 0)",
                            example: "0",
                        },
                    ],
                    returns:
                        "List of user's playlists with names, track counts, and owners",
                    example: `list_playlists({ limit: 20 })`,
                    annotations: { readOnlyHint: true },
                },
                {
                    name: "get_playlist",
                    description: "Get playlist details with tracks",
                    parameters: [
                        {
                            name: "playlist_id",
                            type: "string",
                            required: true,
                            description: "Spotify playlist ID",
                            example: "37i9dQZF1DX3rxVfibe1L0",
                        },
                        {
                            name: "limit",
                            type: "number",
                            required: false,
                            description: "Max tracks to return (1-100, default: 50)",
                            example: "50",
                        },
                    ],
                    returns:
                        "Playlist info with tracks including name, artists, and duration",
                    example: `get_playlist({ playlist_id: "37i9dQZF1DX3rxVfibe1L0" })`,
                    annotations: { readOnlyHint: true },
                },
                {
                    name: "raw_api",
                    description:
                        "Direct Spotify API access for operations not listed above. " +
                        "Use when you need to access endpoints not covered by standard operations. " +
                        "Consult: https://developer.spotify.com/documentation/web-api",
                    parameters: [
                        {
                            name: "endpoint",
                            type: "string",
                            required: true,
                            description:
                                "Spotify API endpoint path (e.g., '/v1/me', '/v1/playlists/{id}')",
                            example: "/v1/me",
                        },
                        {
                            name: "method",
                            type: "string",
                            required: true,
                            description: "HTTP method (GET, POST, PUT, DELETE)",
                            example: "GET",
                        },
                        {
                            name: "body",
                            type: "object",
                            required: false,
                            description: "Request body for POST/PUT requests",
                        },
                        {
                            name: "query",
                            type: "object",
                            required: false,
                            description: "Query parameters as key-value pairs",
                        },
                    ],
                    returns: "Raw Spotify API response as JSON",
                    example: `raw_api({ endpoint: "/v1/me", method: "GET" })`,
                },
            ],
            docsUrl: "https://developer.spotify.com/documentation/web-api",
        };
    }

    async execute(
        action: string,
        params: unknown,
        userId: string,
        accountId?: string
    ): Promise<MCPToolResponse> {
        const validation = this.validate(action, params);
        if (!validation.valid) {
            this.logError(
                `[SPOTIFY ADAPTER] Validation failed for action '${action}':`,
                validation.errors
            );
            return this.createErrorResponse(
                `Validation errors:\n${validation.errors.join("\n")}`
            );
        }

        // Get credentials via base adapter helper
        const tokenResult = await this.getOAuthAccessToken(userId, accountId);
        if ("content" in tokenResult) {
            return tokenResult;
        }
        const { accessToken } = tokenResult;

        try {
            switch (action) {
                case "search":
                    return await this.handleSearch(params, accessToken);
                case "get_currently_playing":
                    return await this.handleGetCurrentlyPlaying(accessToken);
                case "get_playback_state":
                    return await this.handleGetPlaybackState(accessToken);
                case "play":
                    return await this.handlePlay(params, accessToken);
                case "pause":
                    return await this.handlePause(params, accessToken);
                case "next":
                    return await this.handleNext(params, accessToken);
                case "previous":
                    return await this.handlePrevious(params, accessToken);
                case "get_recently_played":
                    return await this.handleGetRecentlyPlayed(params, accessToken);
                case "get_top_items":
                    return await this.handleGetTopItems(params, accessToken);
                case "list_playlists":
                    return await this.handleListPlaylists(params, accessToken);
                case "get_playlist":
                    return await this.handleGetPlaylist(params, accessToken);
                case "raw_api":
                    return await this.executeRawAPI(
                        params as RawAPIParams,
                        userId,
                        accountId
                    );
                default:
                    this.logError(
                        `[SPOTIFY ADAPTER] Unknown action '${action}' requested by user ${userId}`
                    );
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

    private async handleSearch(
        params: unknown,
        accessToken: string
    ): Promise<MCPToolResponse> {
        const {
            query,
            type = "track",
            limit = 20,
        } = params as {
            query: string;
            type?: string;
            limit?: number;
        };

        const cappedLimit = Math.min(Math.max(1, limit), 50);

        const response = await httpClient
            .get(`${SPOTIFY_API_BASE}/search`, {
                headers: this.buildHeaders(accessToken),
                searchParams: {
                    q: query,
                    type,
                    limit: cappedLimit.toString(),
                },
            })
            .json<{
                tracks?: { items: SpotifyTrack[] };
                albums?: { items: SpotifyAlbum[] };
                artists?: { items: SpotifyArtist[] };
                playlists?: { items: SpotifyPlaylist[] };
            }>();

        const results: Record<string, unknown[]> = {};

        if (response.tracks?.items) {
            results.tracks = response.tracks.items.map(this.formatTrack);
        }
        if (response.albums?.items) {
            results.albums = response.albums.items.map(this.formatAlbum);
        }
        if (response.artists?.items) {
            results.artists = response.artists.items.map(this.formatArtist);
        }
        if (response.playlists?.items) {
            results.playlists = response.playlists.items.map(
                this.formatPlaylistSummary
            );
        }

        return this.createJSONResponse({
            query,
            type,
            ...results,
            note: "Use Spotify URIs with play() to start playback.",
        });
    }

    private async handleGetCurrentlyPlaying(
        accessToken: string
    ): Promise<MCPToolResponse> {
        try {
            const response = await httpClient
                .get(`${SPOTIFY_API_BASE}/me/player/currently-playing`, {
                    headers: this.buildHeaders(accessToken),
                })
                .json<SpotifyCurrentlyPlaying | null>();

            if (!response || !response.item) {
                return this.createJSONResponse({
                    isPlaying: false,
                    message: "Nothing is currently playing",
                    note: "Open Spotify on a device to start listening.",
                });
            }

            const track = response.item as SpotifyTrack;
            return this.createJSONResponse({
                isPlaying: response.is_playing,
                track: this.formatTrack(track),
                progressMs: response.progress_ms,
                progressFormatted: this.formatDuration(response.progress_ms || 0),
                durationMs: track.duration_ms,
                durationFormatted: this.formatDuration(track.duration_ms),
                device: response.device
                    ? {
                          name: response.device.name,
                          type: response.device.type,
                          volumePercent: response.device.volume_percent,
                      }
                    : null,
            });
        } catch (error) {
            // 204 means no active device/playback
            if (error instanceof Error && error.message.includes("204")) {
                return this.createJSONResponse({
                    isPlaying: false,
                    message: "No active playback",
                    note: "Open Spotify on a device to start listening.",
                });
            }
            throw error;
        }
    }

    private async handleGetPlaybackState(
        accessToken: string
    ): Promise<MCPToolResponse> {
        try {
            const response = await httpClient
                .get(`${SPOTIFY_API_BASE}/me/player`, {
                    headers: this.buildHeaders(accessToken),
                })
                .json<SpotifyPlaybackState | null>();

            if (!response) {
                return this.createJSONResponse({
                    isPlaying: false,
                    message: "No active playback state",
                    note: "Open Spotify on a device to start listening.",
                });
            }

            const track = response.item as SpotifyTrack | null;
            return this.createJSONResponse({
                isPlaying: response.is_playing,
                shuffleState: response.shuffle_state,
                repeatState: response.repeat_state,
                track: track ? this.formatTrack(track) : null,
                progressMs: response.progress_ms,
                device: response.device
                    ? {
                          id: response.device.id,
                          name: response.device.name,
                          type: response.device.type,
                          isActive: response.device.is_active,
                          volumePercent: response.device.volume_percent,
                      }
                    : null,
            });
        } catch (error) {
            if (error instanceof Error && error.message.includes("204")) {
                return this.createJSONResponse({
                    isPlaying: false,
                    message: "No active playback state",
                    note: "Open Spotify on a device to start listening.",
                });
            }
            throw error;
        }
    }

    private async handlePlay(
        params: unknown,
        accessToken: string
    ): Promise<MCPToolResponse> {
        const { uri, device_id } = params as {
            uri?: string;
            device_id?: string;
        };

        const searchParams: Record<string, string> = {};
        if (device_id) searchParams.device_id = device_id;

        const body: Record<string, unknown> = {};
        if (uri) {
            // Determine if it's a context URI (album, playlist, artist) or track URI
            if (uri.includes(":track:")) {
                body.uris = [uri];
            } else {
                body.context_uri = uri;
            }
        }

        try {
            await httpClient.put(`${SPOTIFY_API_BASE}/me/player/play`, {
                headers: this.buildHeaders(accessToken),
                searchParams:
                    Object.keys(searchParams).length > 0 ? searchParams : undefined,
                json: Object.keys(body).length > 0 ? body : undefined,
            });

            return this.createSuccessResponse(
                uri ? `🎵 Started playing ${uri}` : "🎵 Resumed playback"
            );
        } catch (error) {
            return this.handlePlaybackError(error, "play");
        }
    }

    private async handlePause(
        params: unknown,
        accessToken: string
    ): Promise<MCPToolResponse> {
        const { device_id } = params as { device_id?: string };

        const searchParams: Record<string, string> = {};
        if (device_id) searchParams.device_id = device_id;

        try {
            await httpClient.put(`${SPOTIFY_API_BASE}/me/player/pause`, {
                headers: this.buildHeaders(accessToken),
                searchParams:
                    Object.keys(searchParams).length > 0 ? searchParams : undefined,
            });

            return this.createSuccessResponse("⏸️ Paused playback");
        } catch (error) {
            return this.handlePlaybackError(error, "pause");
        }
    }

    private async handleNext(
        params: unknown,
        accessToken: string
    ): Promise<MCPToolResponse> {
        const { device_id } = params as { device_id?: string };

        const searchParams: Record<string, string> = {};
        if (device_id) searchParams.device_id = device_id;

        try {
            await httpClient.post(`${SPOTIFY_API_BASE}/me/player/next`, {
                headers: this.buildHeaders(accessToken),
                searchParams:
                    Object.keys(searchParams).length > 0 ? searchParams : undefined,
            });

            return this.createSuccessResponse("⏭️ Skipped to next track");
        } catch (error) {
            return this.handlePlaybackError(error, "skip");
        }
    }

    private async handlePrevious(
        params: unknown,
        accessToken: string
    ): Promise<MCPToolResponse> {
        const { device_id } = params as { device_id?: string };

        const searchParams: Record<string, string> = {};
        if (device_id) searchParams.device_id = device_id;

        try {
            await httpClient.post(`${SPOTIFY_API_BASE}/me/player/previous`, {
                headers: this.buildHeaders(accessToken),
                searchParams:
                    Object.keys(searchParams).length > 0 ? searchParams : undefined,
            });

            return this.createSuccessResponse("⏮️ Skipped to previous track");
        } catch (error) {
            return this.handlePlaybackError(error, "go back");
        }
    }

    private async handleGetRecentlyPlayed(
        params: unknown,
        accessToken: string
    ): Promise<MCPToolResponse> {
        const { limit = 20 } = params as { limit?: number };
        const cappedLimit = Math.min(Math.max(1, limit), 50);

        const response = await httpClient
            .get(`${SPOTIFY_API_BASE}/me/player/recently-played`, {
                headers: this.buildHeaders(accessToken),
                searchParams: {
                    limit: cappedLimit.toString(),
                },
            })
            .json<{
                items: Array<{
                    track: SpotifyTrack;
                    played_at: string;
                }>;
            }>();

        return this.createJSONResponse({
            totalCount: response.items.length,
            tracks: response.items.map((item) => ({
                ...this.formatTrack(item.track),
                playedAt: item.played_at,
            })),
        });
    }

    private async handleGetTopItems(
        params: unknown,
        accessToken: string
    ): Promise<MCPToolResponse> {
        const {
            type,
            time_range = "medium_term",
            limit = 20,
        } = params as {
            type: "artists" | "tracks";
            time_range?: "short_term" | "medium_term" | "long_term";
            limit?: number;
        };

        const cappedLimit = Math.min(Math.max(1, limit), 50);

        const response = await httpClient
            .get(`${SPOTIFY_API_BASE}/me/top/${type}`, {
                headers: this.buildHeaders(accessToken),
                searchParams: {
                    time_range,
                    limit: cappedLimit.toString(),
                },
            })
            .json<{
                items: SpotifyTrack[] | SpotifyArtist[];
            }>();

        const timeRangeLabel =
            time_range === "short_term"
                ? "last 4 weeks"
                : time_range === "long_term"
                  ? "all time"
                  : "last 6 months";

        if (type === "artists") {
            return this.createJSONResponse({
                type: "artists",
                timeRange: timeRangeLabel,
                totalCount: response.items.length,
                artists: (response.items as SpotifyArtist[]).map(this.formatArtist),
            });
        } else {
            return this.createJSONResponse({
                type: "tracks",
                timeRange: timeRangeLabel,
                totalCount: response.items.length,
                tracks: (response.items as SpotifyTrack[]).map(this.formatTrack),
            });
        }
    }

    private async handleListPlaylists(
        params: unknown,
        accessToken: string
    ): Promise<MCPToolResponse> {
        const { limit = 20, offset = 0 } = params as {
            limit?: number;
            offset?: number;
        };

        const cappedLimit = Math.min(Math.max(1, limit), 50);

        const response = await httpClient
            .get(`${SPOTIFY_API_BASE}/me/playlists`, {
                headers: this.buildHeaders(accessToken),
                searchParams: {
                    limit: cappedLimit.toString(),
                    offset: offset.toString(),
                },
            })
            .json<{
                items: SpotifyPlaylist[];
                total: number;
            }>();

        return this.createJSONResponse({
            totalCount: response.total,
            returnedCount: response.items.length,
            offset,
            playlists: response.items.map(this.formatPlaylistSummary),
            note: "Use get_playlist with a playlist_id for full track listing.",
        });
    }

    private async handleGetPlaylist(
        params: unknown,
        accessToken: string
    ): Promise<MCPToolResponse> {
        const { playlist_id, limit = 50 } = params as {
            playlist_id: string;
            limit?: number;
        };

        const cappedLimit = Math.min(Math.max(1, limit), 100);

        const response = await httpClient
            .get(`${SPOTIFY_API_BASE}/playlists/${playlist_id}`, {
                headers: this.buildHeaders(accessToken),
                searchParams: {
                    limit: cappedLimit.toString(),
                },
            })
            .json<SpotifyPlaylistFull>();

        return this.createJSONResponse({
            id: response.id,
            name: response.name,
            description: response.description,
            owner: response.owner.display_name || response.owner.id,
            public: response.public,
            collaborative: response.collaborative,
            totalTracks: response.tracks.total,
            returnedTracks: response.tracks.items.length,
            uri: response.uri,
            url: response.external_urls.spotify,
            tracks: response.tracks.items
                .filter((item) => item.track)
                .map((item) => this.formatTrack(item.track as SpotifyTrack)),
            note:
                response.tracks.total > response.tracks.items.length
                    ? `Showing first ${response.tracks.items.length} of ${response.tracks.total} tracks. Use raw_api to paginate.`
                    : undefined,
        });
    }

    /**
     * Execute a raw Spotify API request
     */
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
                "raw_api requires 'method' parameter (GET, POST, PUT, DELETE)"
            );
        }

        if (!endpoint.startsWith("/v1")) {
            return this.createErrorResponse(
                "Invalid endpoint: must start with '/v1'. " +
                    `Got: ${endpoint}. Example: '/v1/me'`
            );
        }

        const tokenResult = await this.getOAuthAccessToken(userId, accountId);
        if ("content" in tokenResult) {
            return tokenResult;
        }
        const { accessToken } = tokenResult;

        const requestOptions: {
            headers: Record<string, string>;
            searchParams?: Record<string, string>;
            json?: Record<string, unknown>;
        } = {
            headers: this.buildHeaders(accessToken),
        };

        if (query && typeof query === "object") {
            requestOptions.searchParams = Object.fromEntries(
                Object.entries(query).map(([k, v]) => [k, String(v)])
            );
        }

        if (["POST", "PUT", "PATCH"].includes(method.toUpperCase()) && body) {
            requestOptions.json = body;
        }

        try {
            const httpMethod = method.toLowerCase() as
                | "get"
                | "post"
                | "put"
                | "delete"
                | "patch";
            const fullUrl = `https://api.spotify.com${endpoint}`;

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

            let errorMessage = `Raw API request failed: `;
            if (error instanceof Error) {
                if (error.message.includes("404")) {
                    errorMessage +=
                        "Endpoint not found. Check the Spotify API docs: https://developer.spotify.com/documentation/web-api";
                } else {
                    errorMessage += this.getAPIErrorDescription(error);
                }
            } else {
                errorMessage += "Unknown error";
            }

            return this.createErrorResponse(errorMessage);
        }
    }

    /**
     * Handle playback-specific errors (Premium required, no active device, etc.)
     */
    private handlePlaybackError(error: unknown, action: string): MCPToolResponse {
        if (!(error instanceof Error)) {
            return this.createErrorResponse(
                `Couldn't ${action}: The bots have been alerted. 🤖`
            );
        }

        const errMsg = error.message;

        // Premium required
        if (errMsg.includes("403") || errMsg.includes("PREMIUM_REQUIRED")) {
            return this.createErrorResponse(
                `🔒 Spotify Premium required to ${action}. ` +
                    "Playback control is only available for Premium subscribers."
            );
        }

        // No active device
        if (errMsg.includes("404") || errMsg.includes("NO_ACTIVE_DEVICE")) {
            return this.createErrorResponse(
                `📱 No active Spotify device found. ` +
                    "Open Spotify on a device first, then try again."
            );
        }

        // Rate limit
        if (errMsg.includes("429")) {
            return this.createErrorResponse(
                `⏳ Spotify rate limit hit. Give it a moment and try again.`
            );
        }

        return this.createErrorResponse(`Couldn't ${action}: ${errMsg}`);
    }

    /**
     * Format duration from milliseconds to human-readable string
     */
    private formatDuration(ms: number): string {
        const minutes = Math.floor(ms / 60000);
        const seconds = Math.floor((ms % 60000) / 1000);
        return `${minutes}:${seconds.toString().padStart(2, "0")}`;
    }

    /**
     * Format a Spotify track for output
     */
    private formatTrack = (track: SpotifyTrack): Record<string, unknown> => ({
        id: track.id,
        name: track.name,
        artists: track.artists.map((a) => a.name).join(", "),
        album: track.album?.name,
        duration: this.formatDuration(track.duration_ms),
        durationMs: track.duration_ms,
        uri: track.uri,
        url: track.external_urls.spotify,
    });

    /**
     * Format a Spotify album for output
     */
    private formatAlbum = (album: SpotifyAlbum): Record<string, unknown> => ({
        id: album.id,
        name: album.name,
        artists: album.artists.map((a) => a.name).join(", "),
        releaseDate: album.release_date,
        totalTracks: album.total_tracks,
        uri: album.uri,
        url: album.external_urls.spotify,
    });

    /**
     * Format a Spotify artist for output
     */
    private formatArtist = (artist: SpotifyArtist): Record<string, unknown> => ({
        id: artist.id,
        name: artist.name,
        genres: artist.genres,
        followers: artist.followers?.total,
        popularity: artist.popularity,
        uri: artist.uri,
        url: artist.external_urls.spotify,
    });

    /**
     * Format a Spotify playlist summary for output
     */
    private formatPlaylistSummary = (
        playlist: SpotifyPlaylist
    ): Record<string, unknown> => ({
        id: playlist.id,
        name: playlist.name,
        description: playlist.description,
        owner: playlist.owner.display_name || playlist.owner.id,
        public: playlist.public,
        trackCount: playlist.tracks.total,
        uri: playlist.uri,
        url: playlist.external_urls.spotify,
    });
}

// Type definitions for Spotify API responses
interface SpotifyTrack {
    id: string;
    name: string;
    artists: Array<{ name: string }>;
    album?: { name: string };
    duration_ms: number;
    uri: string;
    external_urls: { spotify: string };
}

interface SpotifyAlbum {
    id: string;
    name: string;
    artists: Array<{ name: string }>;
    release_date: string;
    total_tracks: number;
    uri: string;
    external_urls: { spotify: string };
}

interface SpotifyArtist {
    id: string;
    name: string;
    genres?: string[];
    followers?: { total: number };
    popularity?: number;
    uri: string;
    external_urls: { spotify: string };
}

interface SpotifyPlaylist {
    id: string;
    name: string;
    description: string | null;
    owner: { id: string; display_name: string | null };
    public: boolean;
    tracks: { total: number };
    uri: string;
    external_urls: { spotify: string };
}

interface SpotifyPlaylistFull extends SpotifyPlaylist {
    collaborative: boolean;
    tracks: {
        total: number;
        items: Array<{
            track: SpotifyTrack | null;
            added_at: string;
        }>;
    };
}

interface SpotifyDevice {
    id: string;
    name: string;
    type: string;
    is_active: boolean;
    volume_percent: number;
}

interface SpotifyCurrentlyPlaying {
    is_playing: boolean;
    progress_ms: number | null;
    item: SpotifyTrack | null;
    device?: SpotifyDevice;
}

interface SpotifyPlaybackState {
    is_playing: boolean;
    shuffle_state: boolean;
    repeat_state: string;
    progress_ms: number | null;
    item: SpotifyTrack | null;
    device: SpotifyDevice | null;
}
