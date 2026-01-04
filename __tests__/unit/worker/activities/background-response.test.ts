/**
 * Background Response Activities Unit Tests
 *
 * Tests Temporal activities in isolation with mocked dependencies.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies before importing activities
vi.mock("@/lib/db", () => ({
    getConnectionWithMessages: vi.fn(),
    mapConnectionMessagesToUI: vi.fn(),
    upsertMessage: vi.fn(),
    updateStreamingStatus: vi.fn(),
    findUserById: vi.fn(),
}));

vi.mock("@/lib/ai/gateway", () => ({
    getGatewayClient: vi.fn(() => vi.fn()),
    translateModelId: vi.fn((id) => id),
    translateOptions: vi.fn((_, opts) => opts),
}));

vi.mock("@/lib/model-config", () => ({
    getModel: vi.fn(() => ({ supportsTools: false })),
    getFallbackChain: vi.fn(() => []),
}));

vi.mock("@/lib/streaming/stream-context", () => ({
    getBackgroundStreamContext: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
    logger: {
        child: vi.fn(() => ({
            info: vi.fn(),
            error: vi.fn(),
            warn: vi.fn(),
        })),
        info: vi.fn(),
        error: vi.fn(),
    },
}));

vi.mock("@sentry/node", () => ({
    addBreadcrumb: vi.fn(),
    captureException: vi.fn(),
}));

import {
    loadConnectionContext,
    saveBackgroundResponse,
    updateConnectionStatus,
    type BackgroundResponseInput,
} from "@/worker/activities/background-response";
import {
    getConnectionWithMessages,
    mapConnectionMessagesToUI,
    upsertMessage,
    updateStreamingStatus,
    findUserById,
} from "@/lib/db";

const mockInput: BackgroundResponseInput = {
    connectionId: 123,
    userId: "user-abc",
    streamId: "stream-xyz",
    modelId: "anthropic/claude-sonnet-4.5",
    temperature: 0.7,
    reasoning: { enabled: true, effort: "medium" },
};

describe("loadConnectionContext", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("loads connection and returns context", async () => {
        const mockConnection = {
            id: 123,
            userId: "user-abc",
            messages: [{ id: "msg-1", role: "user", content: "Hello" }],
        };
        const mockUser = { id: "user-abc", email: "test@example.com" };
        const mockUIMessages = [
            { id: "msg-1", role: "user", parts: [{ type: "text", text: "Hello" }] },
        ];

        vi.mocked(getConnectionWithMessages).mockResolvedValue(mockConnection as any);
        vi.mocked(findUserById).mockResolvedValue(mockUser as any);
        vi.mocked(mapConnectionMessagesToUI).mockReturnValue(mockUIMessages as any);

        const result = await loadConnectionContext(mockInput);

        expect(getConnectionWithMessages).toHaveBeenCalledWith(123);
        expect(findUserById).toHaveBeenCalledWith("user-abc");
        expect(result.userEmail).toBe("test@example.com");
        expect(result.messages).toEqual(mockUIMessages);
    });

    it("throws if connection not found", async () => {
        vi.mocked(getConnectionWithMessages).mockResolvedValue(null);

        await expect(loadConnectionContext(mockInput)).rejects.toThrow(
            "Connection 123 not found"
        );
    });

    it("throws if connection belongs to different user", async () => {
        const mockConnection = {
            id: 123,
            userId: "different-user",
            messages: [],
        };

        vi.mocked(getConnectionWithMessages).mockResolvedValue(mockConnection as any);

        await expect(loadConnectionContext(mockInput)).rejects.toThrow(
            "Authorization failed"
        );
    });

    it("throws if user not found", async () => {
        const mockConnection = {
            id: 123,
            userId: "user-abc",
            messages: [],
        };

        vi.mocked(getConnectionWithMessages).mockResolvedValue(mockConnection as any);
        vi.mocked(findUserById).mockResolvedValue(null);

        await expect(loadConnectionContext(mockInput)).rejects.toThrow(
            "User user-abc not found"
        );
    });
});

describe("saveBackgroundResponse", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("saves message to database", async () => {
        const parts = [{ type: "text", text: "Response text" }];

        await saveBackgroundResponse(123, "stream-xyz", parts as any);

        expect(upsertMessage).toHaveBeenCalledWith(123, {
            id: "bg-stream-xyz",
            role: "assistant",
            parts,
        });
    });

    it("handles empty parts array", async () => {
        await saveBackgroundResponse(123, "stream-xyz", []);

        expect(upsertMessage).toHaveBeenCalledWith(123, {
            id: "bg-stream-xyz",
            role: "assistant",
            parts: [],
        });
    });
});

describe("updateConnectionStatus", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("updates status to completed", async () => {
        await updateConnectionStatus(123, "completed");

        expect(updateStreamingStatus).toHaveBeenCalledWith(123, "completed");
    });

    it("updates status to failed", async () => {
        await updateConnectionStatus(123, "failed");

        expect(updateStreamingStatus).toHaveBeenCalledWith(123, "failed");
    });

    it("adds Sentry breadcrumb for completed", async () => {
        const { addBreadcrumb } = await import("@sentry/node");

        await updateConnectionStatus(123, "completed");

        expect(addBreadcrumb).toHaveBeenCalledWith({
            category: "temporal",
            message: "Background response completed",
            level: "info",
            data: { connectionId: 123 },
        });
    });

    it("adds Sentry breadcrumb for failed", async () => {
        const { addBreadcrumb } = await import("@sentry/node");

        await updateConnectionStatus(123, "failed");

        expect(addBreadcrumb).toHaveBeenCalledWith({
            category: "temporal",
            message: "Background response failed",
            level: "error",
            data: { connectionId: 123 },
        });
    });
});
