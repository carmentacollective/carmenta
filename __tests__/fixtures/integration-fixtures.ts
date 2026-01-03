/**
 * Test fixtures for integration tests
 *
 * Provides helper functions to create test data for integrations, users, connections, and jobs.
 */

import { db, schema } from "@/lib/db";
import {
    encryptCredentials,
    type ApiKeyCredentials,
} from "@/lib/integrations/encryption";
import type {
    JobExecutionTrace,
    JobErrorDetails,
    JobTokenUsage,
} from "@/lib/db/schema";
import { v4 as uuid } from "uuid";

/**
 * Options for creating a test user
 */
export interface TestUserOptions {
    email?: string;
    clerkId?: string;
    firstName?: string;
    lastName?: string;
}

/**
 * Create a test user in the database
 *
 * @param options - User creation options
 * @returns The created user
 */
export async function createTestUser(options: TestUserOptions = {}) {
    const [user] = await db
        .insert(schema.users)
        .values({
            email: options.email ?? `test-${uuid().slice(0, 8)}@example.com`,
            clerkId: options.clerkId ?? `clerk_${uuid()}`,
            firstName: options.firstName ?? "Test",
            lastName: options.lastName ?? "User",
        })
        .returning();
    return user;
}

/**
 * Options for creating a test integration
 */
export interface TestIntegrationOptions {
    userEmail: string;
    service: string;
    credentialType: "api_key" | "oauth";
    status?: "connected" | "expired" | "error" | "disconnected";
    accountId?: string;
    isDefault?: boolean;
    apiKey?: string;
    accessToken?: string; // For OAuth - direct access token
    accountDisplayName?: string;
    errorMessage?: string;
}

/**
 * Create a test integration in the database
 *
 * @param options - Integration creation options
 * @returns The created integration
 */
export async function createTestIntegration(options: TestIntegrationOptions) {
    const {
        userEmail,
        service,
        credentialType,
        status = "connected",
        accountId = "default",
        isDefault = false,
        apiKey,
        accessToken,
        accountDisplayName,
        errorMessage,
    } = options;

    // Prepare encrypted credentials
    let encryptedCreds: string | null = null;
    if (credentialType === "api_key" && apiKey) {
        const credentials: ApiKeyCredentials = { apiKey };
        encryptedCreds = encryptCredentials(credentials);
    } else if (credentialType === "oauth" && accessToken) {
        // For OAuth integrations with in-house auth, encrypt the token
        const credentials = { token: accessToken };
        encryptedCreds = encryptCredentials(credentials);
    }

    const [integration] = await db
        .insert(schema.integrations)
        .values({
            userEmail,
            service,
            credentialType,
            status,
            accountId,
            isDefault,
            encryptedCredentials: encryptedCreds,
            accountDisplayName,
            errorMessage,
        })
        .returning();

    return integration;
}

/**
 * Create a test API key integration
 *
 * @param userEmail - User's email address
 * @param service - Service ID (e.g., "giphy", "limitless")
 * @param apiKey - API key (defaults to "test-api-key")
 * @param options - Additional options
 * @returns The created integration
 */
export async function createTestApiKeyIntegration(
    userEmail: string,
    service: string,
    apiKey: string = "test-api-key",
    options: Partial<TestIntegrationOptions> = {}
) {
    return createTestIntegration({
        ...options,
        userEmail,
        service,
        credentialType: "api_key",
        apiKey,
    });
}

/**
 * Create a test OAuth integration
 *
 * @param userEmail - User's email address
 * @param service - Service ID (e.g., "notion", "clickup")
 * @param accessToken - OAuth access token
 * @param options - Additional options
 * @returns The created integration
 */
export async function createTestOAuthIntegration(
    userEmail: string,
    service: string,
    accessToken?: string,
    options: Partial<TestIntegrationOptions> = {}
) {
    return createTestIntegration({
        ...options,
        userEmail,
        service,
        credentialType: "oauth",
        accessToken,
    });
}

/**
 * Create a user with connected integrations
 *
 * @param services - Array of service IDs to connect
 * @param userOptions - User creation options
 * @returns Object with user and integrations
 */
export async function createUserWithIntegrations(
    services: string[],
    userOptions: TestUserOptions = {}
) {
    const user = await createTestUser(userOptions);

    const integrations = await Promise.all(
        services.map((service) =>
            createTestApiKeyIntegration(user.email, service, `${service}-test-key`)
        )
    );

    return { user, integrations };
}

/**
 * Options for creating a test scheduled job
 */
export interface TestJobOptions {
    userId: string;
    name?: string;
    prompt?: string;
    scheduleCron?: string;
    timezone?: string;
    integrations?: string[];
    isActive?: boolean;
}

/**
 * Create a test scheduled job in the database
 *
 * @param options - Job creation options
 * @returns The created job with its seqId for encoding
 */
export async function createTestJob(options: TestJobOptions) {
    const [job] = await db
        .insert(schema.scheduledJobs)
        .values({
            userId: options.userId,
            name: options.name ?? `Test Job ${uuid().slice(0, 8)}`,
            prompt: options.prompt ?? "Test job prompt",
            scheduleCron: options.scheduleCron ?? "0 9 * * *",
            timezone: options.timezone ?? "America/Los_Angeles",
            integrations: options.integrations ?? [],
            isActive: options.isActive ?? true,
        })
        .returning();
    return job;
}

/**
 * Options for creating a test job run
 */
export interface TestJobRunOptions {
    jobId: string;
    status?: "pending" | "running" | "completed" | "failed";
    summary?: string;
    error?: string;
    toolCallsExecuted?: number;
    notificationsSent?: number;
    temporalWorkflowId?: string;
    sentryTraceId?: string;
    executionTrace?: JobExecutionTrace;
    errorDetails?: JobErrorDetails;
    tokenUsage?: JobTokenUsage;
    modelId?: string;
    durationMs?: number;
    startedAt?: Date;
    completedAt?: Date;
}

/**
 * Create a test job run in the database
 *
 * @param options - Run creation options
 * @returns The created run
 */
export async function createTestJobRun(options: TestJobRunOptions) {
    const now = new Date();
    const [run] = await db
        .insert(schema.jobRuns)
        .values({
            jobId: options.jobId,
            status: options.status ?? "completed",
            summary: options.summary ?? "Test run completed successfully",
            error: options.error,
            toolCallsExecuted: options.toolCallsExecuted ?? 0,
            notificationsSent: options.notificationsSent ?? 0,
            temporalWorkflowId: options.temporalWorkflowId,
            sentryTraceId: options.sentryTraceId,
            executionTrace: options.executionTrace,
            errorDetails: options.errorDetails,
            tokenUsage: options.tokenUsage,
            modelId: options.modelId ?? "claude-sonnet-4-20250514",
            durationMs: options.durationMs ?? 1500,
            startedAt: options.startedAt ?? now,
            completedAt: options.completedAt ?? now,
        })
        .returning();
    return run;
}

/**
 * Options for creating a test job notification
 */
export interface TestJobNotificationOptions {
    userId: string;
    jobId: string;
    runId?: string;
    title?: string;
    body?: string;
    priority?: "urgent" | "high" | "normal" | "low";
}

/**
 * Create a test job notification in the database
 *
 * @param options - Notification creation options
 * @returns The created notification
 */
export async function createTestJobNotification(options: TestJobNotificationOptions) {
    const [notification] = await db
        .insert(schema.jobNotifications)
        .values({
            userId: options.userId,
            jobId: options.jobId,
            runId: options.runId,
            title: options.title ?? "Test Notification",
            body: options.body ?? "Test notification body",
            priority: options.priority ?? "normal",
        })
        .returning();
    return notification;
}

/**
 * Create a sample execution trace for testing
 *
 * @param options - Trace configuration
 * @returns A JobExecutionTrace with realistic data
 */
export function createSampleExecutionTrace(options?: {
    stepCount?: number;
    includeToolCalls?: boolean;
    includeErrors?: boolean;
}): JobExecutionTrace {
    const stepCount = options?.stepCount ?? 2;
    const includeToolCalls = options?.includeToolCalls ?? true;
    const includeErrors = options?.includeErrors ?? false;

    const steps = Array.from({ length: stepCount }, (_, i) => {
        const step: JobExecutionTrace["steps"][0] = {
            stepIndex: i,
            startedAt: new Date(Date.now() - (stepCount - i) * 1000).toISOString(),
            completedAt: new Date(
                Date.now() - (stepCount - i - 1) * 1000
            ).toISOString(),
            text: i === stepCount - 1 ? "Task completed successfully" : undefined,
        };

        if (includeToolCalls && i < stepCount - 1) {
            step.toolCalls = [
                {
                    toolCallId: `tc_${uuid().slice(0, 8)}`,
                    toolName: "search_files",
                    input: { query: "test query" },
                    output: { results: ["file1.ts", "file2.ts"] },
                    durationMs: 250,
                },
            ];

            if (includeErrors && i === 0) {
                step.toolCalls.push({
                    toolCallId: `tc_${uuid().slice(0, 8)}`,
                    toolName: "send_email",
                    input: { to: "test@example.com" },
                    error: "Failed to send email: Connection timeout",
                    durationMs: 5000,
                });
            }
        }

        return step;
    });

    return {
        steps,
        finalText: "Task completed successfully",
    };
}

/**
 * Create a sample error details object for testing
 */
export function createSampleErrorDetails(
    options?: Partial<JobErrorDetails>
): JobErrorDetails {
    return {
        message: options?.message ?? "Test error occurred",
        code: options?.code ?? "TEST_ERROR",
        stack: options?.stack ?? "Error: Test error\n    at test.ts:1:1",
        context: options?.context ?? { attemptNumber: 1 },
        failedStep: options?.failedStep ?? 0,
    };
}

/**
 * Create a sample token usage object for testing
 */
export function createSampleTokenUsage(
    options?: Partial<JobTokenUsage>
): JobTokenUsage {
    return {
        inputTokens: options?.inputTokens ?? 1500,
        outputTokens: options?.outputTokens ?? 350,
        cachedInputTokens: options?.cachedInputTokens,
    };
}
