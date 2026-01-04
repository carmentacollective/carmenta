/**
 * Spotify Adapter Tests
 *
 * Tests authentication and core operations for the Spotify adapter.
 */

import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { SpotifyAdapter } from "@/lib/integrations/adapters/spotify";
import { ValidationError } from "@/lib/errors";

// Mock connection manager
vi.mock("@/lib/integrations/connection-manager", () => ({
    getCredentials: vi.fn(),
}));

// Mock HTTP client
vi.mock("@/lib/http-client", () => ({
    httpClient: {
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
    },
}));

// Mock env
vi.mock("@/lib/env", () => ({
    env: {
        NEXT_PUBLIC_APP_URL: "https://carmenta.ai",
        SPOTIFY_CLIENT_ID: "test-client-id",
        SPOTIFY_CLIENT_SECRET: "test-client-secret",
    },
}));

describe("SpotifyAdapter", () => {
    let adapter: SpotifyAdapter;
    const testUserEmail = "test@example.com";

    beforeEach(() => {
        adapter = new SpotifyAdapter();
        vi.clearAllMocks();
    });

    describe("Authentication", () => {
        it("returns friendly error when service not connected", async () => {
            const { getCredentials } =
                await import("@/lib/integrations/connection-manager");
            (getCredentials as Mock).mockRejectedValue(
                new ValidationError("spotify is not connected")
            );

            const result = await adapter.execute(
                "search",
                { query: "test" },
                testUserEmail
            );

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain("spotify");
        });

        it("proceeds with valid OAuth credentials", async () => {
            const { getCredentials } =
                await import("@/lib/integrations/connection-manager");
            (getCredentials as Mock).mockResolvedValue({
                type: "oauth",
                accessToken: "test-access-token",
                accountId: "test@spotify.com",
                accountDisplayName: "Test User",
                isDefault: true,
            });

            const { httpClient } = await import("@/lib/http-client");
            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    tracks: {
                        items: [
                            {
                                id: "track-123",
                                name: "Test Song",
                                artists: [{ name: "Test Artist" }],
                                album: { name: "Test Album" },
                                duration_ms: 180000,
                                uri: "spotify:track:track-123",
                                external_urls: {
                                    spotify: "https://open.spotify.com/track/track-123",
                                },
                            },
                        ],
                    },
                }),
            } as never);

            const result = await adapter.execute(
                "search",
                { query: "test song" },
                testUserEmail
            );

            expect(result.isError).toBe(false);
            expect(getCredentials).toHaveBeenCalledWith(
                testUserEmail,
                "spotify",
                undefined
            );
        });
    });

    describe("Search Operation", () => {
        beforeEach(async () => {
            const { getCredentials } =
                await import("@/lib/integrations/connection-manager");
            (getCredentials as Mock).mockResolvedValue({
                type: "oauth",
                accessToken: "test-access-token",
                accountId: "test@spotify.com",
                accountDisplayName: "Test User",
                isDefault: true,
            });
        });

        it("searches for tracks", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    tracks: {
                        items: [
                            {
                                id: "track-123",
                                name: "Bohemian Rhapsody",
                                artists: [{ name: "Queen" }],
                                album: { name: "A Night at the Opera" },
                                duration_ms: 354000,
                                uri: "spotify:track:track-123",
                                external_urls: {
                                    spotify: "https://open.spotify.com/track/track-123",
                                },
                            },
                        ],
                    },
                }),
            } as never);

            const result = await adapter.execute(
                "search",
                { query: "Bohemian Rhapsody", type: "track" },
                testUserEmail
            );

            expect(result.isError).toBe(false);
            const content = JSON.parse(result.content[0].text as string);
            expect(content.tracks).toHaveLength(1);
            expect(content.tracks[0].name).toBe("Bohemian Rhapsody");
            expect(content.tracks[0].artists).toBe("Queen");
        });

        it("searches for playlists", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    playlists: {
                        items: [
                            {
                                id: "playlist-123",
                                name: "Focus Music",
                                description: "Music for concentration",
                                owner: { id: "spotify", display_name: "Spotify" },
                                public: true,
                                tracks: { total: 50 },
                                uri: "spotify:playlist:playlist-123",
                                external_urls: {
                                    spotify:
                                        "https://open.spotify.com/playlist/playlist-123",
                                },
                            },
                        ],
                    },
                }),
            } as never);

            const result = await adapter.execute(
                "search",
                { query: "focus music", type: "playlist" },
                testUserEmail
            );

            expect(result.isError).toBe(false);
            const content = JSON.parse(result.content[0].text as string);
            expect(content.playlists).toHaveLength(1);
            expect(content.playlists[0].name).toBe("Focus Music");
        });
    });

    describe("Currently Playing", () => {
        beforeEach(async () => {
            const { getCredentials } =
                await import("@/lib/integrations/connection-manager");
            (getCredentials as Mock).mockResolvedValue({
                type: "oauth",
                accessToken: "test-access-token",
                accountId: "test@spotify.com",
                accountDisplayName: "Test User",
                isDefault: true,
            });
        });

        it("returns currently playing track", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    is_playing: true,
                    progress_ms: 60000,
                    item: {
                        id: "track-123",
                        name: "Test Song",
                        artists: [{ name: "Test Artist" }],
                        album: { name: "Test Album" },
                        duration_ms: 180000,
                        uri: "spotify:track:track-123",
                        external_urls: {
                            spotify: "https://open.spotify.com/track/track-123",
                        },
                    },
                    device: {
                        name: "My Computer",
                        type: "Computer",
                        volume_percent: 50,
                    },
                }),
            } as never);

            const result = await adapter.execute(
                "get_currently_playing",
                {},
                testUserEmail
            );

            expect(result.isError).toBe(false);
            const content = JSON.parse(result.content[0].text as string);
            expect(content.isPlaying).toBe(true);
            expect(content.track.name).toBe("Test Song");
            expect(content.progressFormatted).toBe("1:00");
        });

        it("handles no active playback gracefully", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockRejectedValue(new Error("204")),
            } as never);

            const result = await adapter.execute(
                "get_currently_playing",
                {},
                testUserEmail
            );

            expect(result.isError).toBe(false);
            const content = JSON.parse(result.content[0].text as string);
            expect(content.isPlaying).toBe(false);
            expect(content.message).toContain("No active playback");
        });
    });

    describe("Playback Control", () => {
        beforeEach(async () => {
            const { getCredentials } =
                await import("@/lib/integrations/connection-manager");
            (getCredentials as Mock).mockResolvedValue({
                type: "oauth",
                accessToken: "test-access-token",
                accountId: "test@spotify.com",
                accountDisplayName: "Test User",
                isDefault: true,
            });
        });

        it("starts playback", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.put as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({}),
            } as never);

            const result = await adapter.execute(
                "play",
                { uri: "spotify:track:track-123" },
                testUserEmail
            );

            expect(result.isError).toBe(false);
            expect(result.content[0].text).toContain("Started playing");
            expect(httpClient.put).toHaveBeenCalled();
        });

        it("pauses playback", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.put as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({}),
            } as never);

            const result = await adapter.execute("pause", {}, testUserEmail);

            expect(result.isError).toBe(false);
            expect(result.content[0].text).toContain("Paused");
        });

        it("handles Premium required error", async () => {
            const { httpClient } = await import("@/lib/http-client");
            // PUT for play returns a thenable that rejects, not an object with .json()
            (httpClient.put as Mock).mockRejectedValue(
                new Error("HTTP 403: Forbidden")
            );

            const result = await adapter.execute("play", {}, testUserEmail);

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain("Premium required");
        });

        it("handles no active device error", async () => {
            const { httpClient } = await import("@/lib/http-client");
            // PUT for play returns a thenable that rejects, not an object with .json()
            (httpClient.put as Mock).mockRejectedValue(
                new Error("HTTP 404: Not Found")
            );

            const result = await adapter.execute("play", {}, testUserEmail);

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain("No active Spotify device");
        });
    });

    describe("Top Items", () => {
        beforeEach(async () => {
            const { getCredentials } =
                await import("@/lib/integrations/connection-manager");
            (getCredentials as Mock).mockResolvedValue({
                type: "oauth",
                accessToken: "test-access-token",
                accountId: "test@spotify.com",
                accountDisplayName: "Test User",
                isDefault: true,
            });
        });

        it("gets top artists", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    items: [
                        {
                            id: "artist-123",
                            name: "Test Artist",
                            genres: ["rock", "alternative"],
                            followers: { total: 1000000 },
                            popularity: 85,
                            uri: "spotify:artist:artist-123",
                            external_urls: {
                                spotify: "https://open.spotify.com/artist/artist-123",
                            },
                        },
                    ],
                }),
            } as never);

            const result = await adapter.execute(
                "get_top_items",
                { type: "artists", time_range: "short_term" },
                testUserEmail
            );

            expect(result.isError).toBe(false);
            const content = JSON.parse(result.content[0].text as string);
            expect(content.type).toBe("artists");
            expect(content.timeRange).toBe("last 4 weeks");
            expect(content.artists[0].name).toBe("Test Artist");
        });

        it("gets top tracks", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    items: [
                        {
                            id: "track-123",
                            name: "Top Song",
                            artists: [{ name: "Popular Artist" }],
                            album: { name: "Hit Album" },
                            duration_ms: 200000,
                            uri: "spotify:track:track-123",
                            external_urls: {
                                spotify: "https://open.spotify.com/track/track-123",
                            },
                        },
                    ],
                }),
            } as never);

            const result = await adapter.execute(
                "get_top_items",
                { type: "tracks", time_range: "long_term" },
                testUserEmail
            );

            expect(result.isError).toBe(false);
            const content = JSON.parse(result.content[0].text as string);
            expect(content.type).toBe("tracks");
            expect(content.timeRange).toBe("all time");
            expect(content.tracks[0].name).toBe("Top Song");
        });
    });

    describe("Playlists", () => {
        beforeEach(async () => {
            const { getCredentials } =
                await import("@/lib/integrations/connection-manager");
            (getCredentials as Mock).mockResolvedValue({
                type: "oauth",
                accessToken: "test-access-token",
                accountId: "test@spotify.com",
                accountDisplayName: "Test User",
                isDefault: true,
            });
        });

        it("lists user playlists", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    items: [
                        {
                            id: "playlist-123",
                            name: "My Playlist",
                            description: "A test playlist",
                            owner: { id: "user123", display_name: "Test User" },
                            public: true,
                            tracks: { total: 25 },
                            uri: "spotify:playlist:playlist-123",
                            external_urls: {
                                spotify:
                                    "https://open.spotify.com/playlist/playlist-123",
                            },
                        },
                    ],
                    total: 10,
                }),
            } as never);

            const result = await adapter.execute("list_playlists", {}, testUserEmail);

            expect(result.isError).toBe(false);
            const content = JSON.parse(result.content[0].text as string);
            expect(content.totalCount).toBe(10);
            expect(content.playlists[0].name).toBe("My Playlist");
        });

        it("gets playlist details with tracks", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    id: "playlist-123",
                    name: "My Playlist",
                    description: "A test playlist",
                    owner: { id: "user123", display_name: "Test User" },
                    public: true,
                    collaborative: false,
                    uri: "spotify:playlist:playlist-123",
                    external_urls: {
                        spotify: "https://open.spotify.com/playlist/playlist-123",
                    },
                    tracks: {
                        total: 2,
                        items: [
                            {
                                track: {
                                    id: "track-1",
                                    name: "Song One",
                                    artists: [{ name: "Artist One" }],
                                    album: { name: "Album One" },
                                    duration_ms: 180000,
                                    uri: "spotify:track:track-1",
                                    external_urls: {
                                        spotify:
                                            "https://open.spotify.com/track/track-1",
                                    },
                                },
                                added_at: "2024-01-01T00:00:00Z",
                            },
                            {
                                track: {
                                    id: "track-2",
                                    name: "Song Two",
                                    artists: [{ name: "Artist Two" }],
                                    album: { name: "Album Two" },
                                    duration_ms: 240000,
                                    uri: "spotify:track:track-2",
                                    external_urls: {
                                        spotify:
                                            "https://open.spotify.com/track/track-2",
                                    },
                                },
                                added_at: "2024-01-02T00:00:00Z",
                            },
                        ],
                    },
                }),
            } as never);

            const result = await adapter.execute(
                "get_playlist",
                { playlist_id: "playlist-123" },
                testUserEmail
            );

            expect(result.isError).toBe(false);
            const content = JSON.parse(result.content[0].text as string);
            expect(content.name).toBe("My Playlist");
            expect(content.totalTracks).toBe(2);
            expect(content.tracks).toHaveLength(2);
        });
    });

    describe("Validation", () => {
        it("requires query for search", async () => {
            const result = await adapter.execute("search", {}, testUserEmail);

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain("query");
        });

        it("requires type for get_top_items", async () => {
            const { getCredentials } =
                await import("@/lib/integrations/connection-manager");
            (getCredentials as Mock).mockResolvedValue({
                type: "oauth",
                accessToken: "test-access-token",
                accountId: "test@spotify.com",
                accountDisplayName: "Test User",
                isDefault: true,
            });

            const result = await adapter.execute("get_top_items", {}, testUserEmail);

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain("type");
        });

        it("requires playlist_id for get_playlist", async () => {
            const { getCredentials } =
                await import("@/lib/integrations/connection-manager");
            (getCredentials as Mock).mockResolvedValue({
                type: "oauth",
                accessToken: "test-access-token",
                accountId: "test@spotify.com",
                accountDisplayName: "Test User",
                isDefault: true,
            });

            const result = await adapter.execute("get_playlist", {}, testUserEmail);

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain("playlist_id");
        });
    });

    describe("Error Handling", () => {
        beforeEach(async () => {
            const { getCredentials } =
                await import("@/lib/integrations/connection-manager");
            (getCredentials as Mock).mockResolvedValue({
                type: "oauth",
                accessToken: "test-access-token",
                accountId: "test@spotify.com",
                accountDisplayName: "Test User",
                isDefault: true,
            });
        });

        it("handles 401 authentication errors", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockRejectedValue(new Error("HTTP 401: Unauthorized")),
            } as never);

            const result = await adapter.execute(
                "search",
                { query: "test" },
                testUserEmail
            );

            expect(result.isError).toBe(true);
        });

        it("handles 429 rate limit errors", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.get as Mock).mockReturnValue({
                json: vi
                    .fn()
                    .mockRejectedValue(new Error("HTTP 429: Too Many Requests")),
            } as never);

            const result = await adapter.execute(
                "search",
                { query: "test" },
                testUserEmail
            );

            expect(result.isError).toBe(true);
        });
    });

    describe("Help Documentation", () => {
        it("returns help documentation", () => {
            const help = adapter.getHelp();

            expect(help.service).toBe("Spotify");
            expect(help.operations).toHaveLength(12); // 11 core + raw_api
            expect(help.commonOperations).toContain("search");
            expect(help.commonOperations).toContain("get_currently_playing");
        });

        it("documents all required parameters", () => {
            const help = adapter.getHelp();
            const searchOp = help.operations.find((op) => op.name === "search");

            expect(searchOp).toBeDefined();
            expect(searchOp?.parameters.find((p) => p.name === "query")?.required).toBe(
                true
            );
        });
    });
});
