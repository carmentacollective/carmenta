/**
 * DCOS Tool Integration Tests
 *
 * Tests the main flow for each DCOS action:
 * - describe: Returns operation documentation
 * - list: Lists user's automations
 * - get: Retrieves automation by ID or name
 * - update: Updates automation prompt/name/integrations
 * - runs: Gets run history for an automation
 * - run: Gets details of a specific run
 */

import { describe, it, expect, beforeEach } from "vitest";
import { setupTestDb } from "@/vitest.setup";
import {
    createTestUser,
    createTestJob,
    createTestJobRun,
    createSampleExecutionTrace,
} from "@/__tests__/fixtures/integration-fixtures";
import { createDcosTool } from "@/lib/ai-team/agents/dcos-tool";
import { encodeJobId } from "@/lib/sqids";
import type {
    SubagentContext,
    SubagentResult,
    SubagentDescription,
} from "@/lib/ai-team/dcos/types";

setupTestDb();

type ToolResult = SubagentResult<any> | SubagentDescription;

/**
 * Helper to execute tool and get typed result
 */
async function executeTool(
    tool: ReturnType<typeof createDcosTool>,
    params: Parameters<NonNullable<ReturnType<typeof createDcosTool>["execute"]>>[0]
): Promise<ToolResult> {
    const result = await tool.execute!(params, { toolCallId: "test", messages: [] });
    return result as ToolResult;
}

/**
 * Create a minimal SubagentContext for testing
 */
function createTestContext(userId: string): SubagentContext {
    return {
        userId,
        userEmail: "test@example.com",
        writer: {
            // Mock writer - not used in these tests
            write: () => {},
            close: () => {},
        } as unknown as SubagentContext["writer"],
    };
}

describe("DCOS Tool", () => {
    let testUser: Awaited<ReturnType<typeof createTestUser>>;
    let testJob: Awaited<ReturnType<typeof createTestJob>>;
    let testJobRun: Awaited<ReturnType<typeof createTestJobRun>>;
    let dcosTool: ReturnType<typeof createDcosTool>;
    let context: SubagentContext;

    beforeEach(async () => {
        // Create test data
        testUser = await createTestUser();
        testJob = await createTestJob({
            userId: testUser.id,
            name: "Morning Briefing",
            prompt: "Check email and calendar, summarize my day.",
        });
        testJobRun = await createTestJobRun({
            jobId: testJob.id,
            status: "completed",
            summary: "Found 5 emails and 3 calendar events.",
            toolCallsExecuted: 4,
            notificationsSent: 1,
            executionTrace: createSampleExecutionTrace(),
        });

        // Create tool and context
        context = createTestContext(testUser.id);
        dcosTool = createDcosTool(context);
    });

    describe("describe action", () => {
        it("returns operation documentation", async () => {
            const result = (await executeTool(dcosTool, {
                action: "describe",
            })) as SubagentDescription;

            expect(result).toHaveProperty("id", "dcos");
            expect(result).toHaveProperty("name", "Digital Chief of Staff");
            expect(result).toHaveProperty("operations");
            expect(Array.isArray(result.operations)).toBe(true);
            expect(result.operations.length).toBe(5);

            // Verify operation names
            const opNames = result.operations.map((op) => op.name);
            expect(opNames).toContain("list");
            expect(opNames).toContain("get");
            expect(opNames).toContain("update");
            expect(opNames).toContain("runs");
            expect(opNames).toContain("run");
        });
    });

    describe("list action", () => {
        it("lists automations for the user", async () => {
            const result = (await executeTool(dcosTool, {
                action: "list",
            })) as SubagentResult<{ automations: unknown[]; total: number }>;

            expect(result.success).toBe(true);
            expect(result.data).toHaveProperty("automations");
            expect(result.data).toHaveProperty("total", 1);

            const automations = result.data!.automations;
            expect(automations).toHaveLength(1);
            expect(automations[0]).toHaveProperty("name", "Morning Briefing");
            expect(automations[0]).toHaveProperty("isActive", true);
        });

        it("returns empty list for user with no automations", async () => {
            // Create a different user with no jobs
            const otherUser = await createTestUser();
            const otherContext = createTestContext(otherUser.id);
            const otherTool = createDcosTool(otherContext);

            const result = (await executeTool(otherTool, {
                action: "list",
            })) as SubagentResult<{ automations: unknown[]; total: number }>;

            expect(result.success).toBe(true);
            expect(result.data!.automations).toHaveLength(0);
            expect(result.data!.total).toBe(0);
        });
    });

    describe("get action", () => {
        it("retrieves automation by encoded ID", async () => {
            const encodedId = encodeJobId(testJob.seqId);

            const result = (await executeTool(dcosTool, {
                action: "get",
                id: encodedId,
            })) as SubagentResult<{ automation: unknown; found: boolean }>;

            expect(result.success).toBe(true);
            expect(result.data).toHaveProperty("found", true);
            expect(result.data!.automation).toHaveProperty("name", "Morning Briefing");
            expect(result.data!.automation).toHaveProperty(
                "prompt",
                "Check email and calendar, summarize my day."
            );
        });

        it("retrieves automation by name (partial match)", async () => {
            const result = (await executeTool(dcosTool, {
                action: "get",
                name: "Morning",
            })) as SubagentResult<{ automation: unknown; found: boolean }>;

            expect(result.success).toBe(true);
            expect(result.data).toHaveProperty("found", true);
            expect(result.data!.automation).toHaveProperty("name", "Morning Briefing");
        });

        it("returns not found for non-existent automation", async () => {
            const result = (await executeTool(dcosTool, {
                action: "get",
                name: "NonExistent",
            })) as SubagentResult<{ automation: unknown; found: boolean }>;

            expect(result.success).toBe(true);
            expect(result.data).toHaveProperty("found", false);
            expect(result.data!.automation).toBeNull();
        });

        it("returns validation error when neither id nor name provided", async () => {
            const result = (await executeTool(dcosTool, {
                action: "get",
            })) as SubagentResult<unknown>;

            expect(result.success).toBe(false);
            expect(result.error).toHaveProperty("code", "VALIDATION");
        });
    });

    describe("update action", () => {
        it("updates automation prompt", async () => {
            const encodedId = encodeJobId(testJob.seqId);
            const newPrompt = "New improved prompt for daily briefing.";

            const result = (await executeTool(dcosTool, {
                action: "update",
                id: encodedId,
                prompt: newPrompt,
            })) as SubagentResult<{ updated: boolean; automation: unknown }>;

            expect(result.success).toBe(true);
            expect(result.data).toHaveProperty("updated", true);
            expect(result.data!.automation).toHaveProperty("prompt", newPrompt);
        });

        it("updates automation name", async () => {
            const encodedId = encodeJobId(testJob.seqId);
            const newName = "Daily Digest";

            const result = (await executeTool(dcosTool, {
                action: "update",
                id: encodedId,
                name: newName,
            })) as SubagentResult<{ updated: boolean; automation: unknown }>;

            expect(result.success).toBe(true);
            expect(result.data!.automation).toHaveProperty("name", newName);
        });

        it("returns validation error when no update fields provided", async () => {
            const encodedId = encodeJobId(testJob.seqId);

            const result = (await executeTool(dcosTool, {
                action: "update",
                id: encodedId,
            })) as SubagentResult<unknown>;

            expect(result.success).toBe(false);
            expect(result.error).toHaveProperty("code", "VALIDATION");
        });
    });

    describe("runs action", () => {
        it("retrieves run history for automation", async () => {
            const encodedId = encodeJobId(testJob.seqId);

            const result = (await executeTool(dcosTool, {
                action: "runs",
                id: encodedId,
            })) as SubagentResult<{ runs: unknown[]; total: number }>;

            expect(result.success).toBe(true);
            expect(result.data).toHaveProperty("runs");
            expect(result.data!.runs).toHaveLength(1);

            const run = result.data!.runs[0];
            expect(run).toHaveProperty("id", testJobRun.id);
            expect(run).toHaveProperty("status", "completed");
            expect(run).toHaveProperty(
                "summary",
                "Found 5 emails and 3 calendar events."
            );
            expect(run).toHaveProperty("toolCallsExecuted", 4);
        });

        it("respects limit parameter", async () => {
            // Create additional runs
            await createTestJobRun({ jobId: testJob.id, status: "completed" });
            await createTestJobRun({ jobId: testJob.id, status: "failed" });

            const encodedId = encodeJobId(testJob.seqId);

            const result = (await executeTool(dcosTool, {
                action: "runs",
                id: encodedId,
                limit: 2,
            })) as SubagentResult<{ runs: unknown[]; total: number }>;

            expect(result.success).toBe(true);
            expect(result.data!.runs).toHaveLength(2);
        });
    });

    describe("run action", () => {
        it("retrieves detailed run information", async () => {
            const result = (await executeTool(dcosTool, {
                action: "run",
                runId: testJobRun.id,
            })) as SubagentResult<{ run: { executionTrace: unknown }; found: boolean }>;

            expect(result.success).toBe(true);
            expect(result.data).toHaveProperty("found", true);

            const run = result.data!.run;
            expect(run).toHaveProperty("id", testJobRun.id);
            expect(run).toHaveProperty("status", "completed");
            expect(run).toHaveProperty("executionTrace");
            expect(run.executionTrace).toHaveProperty("steps");
        });

        it("returns not found for non-existent run", async () => {
            // Use a valid UUID format that doesn't exist in the database
            const nonExistentUuid = "00000000-0000-0000-0000-000000000000";

            const result = (await executeTool(dcosTool, {
                action: "run",
                runId: nonExistentUuid,
            })) as SubagentResult<{ run: unknown; found: boolean }>;

            expect(result.success).toBe(true);
            expect(result.data).toHaveProperty("found", false);
            expect(result.data!.run).toBeNull();
        });

        it("does not expose runs from other users", async () => {
            // Create a run owned by a different user
            const otherUser = await createTestUser();
            const otherJob = await createTestJob({ userId: otherUser.id });
            const otherRun = await createTestJobRun({ jobId: otherJob.id });

            // Try to access it with our test context
            const result = (await executeTool(dcosTool, {
                action: "run",
                runId: otherRun.id,
            })) as SubagentResult<{ run: unknown; found: boolean }>;

            expect(result.success).toBe(true);
            expect(result.data).toHaveProperty("found", false);
        });
    });
});
