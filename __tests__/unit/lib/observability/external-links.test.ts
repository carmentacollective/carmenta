/**
 * External Links Unit Tests
 *
 * Tests URL generation for Sentry and Temporal external links.
 * These links provide observability into job run execution.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
    getSentryTraceUrl,
    getTemporalWorkflowUrl,
    buildExternalLinks,
} from "@/lib/observability/external-links";

describe("External Links", () => {
    const originalEnv = process.env;

    beforeEach(() => {
        // Clone environment for isolation
        process.env = { ...originalEnv };
    });

    afterEach(() => {
        // Restore original environment
        process.env = originalEnv;
    });

    describe("getSentryTraceUrl", () => {
        it("returns null when SENTRY_ORG is not configured", () => {
            delete process.env.SENTRY_ORG;
            process.env.SENTRY_PROJECT = "my-project";

            const url = getSentryTraceUrl("trace123");

            expect(url).toBeNull();
        });

        it("returns null when SENTRY_PROJECT is not configured", () => {
            process.env.SENTRY_ORG = "my-org";
            delete process.env.SENTRY_PROJECT;

            const url = getSentryTraceUrl("trace123");

            expect(url).toBeNull();
        });

        it("returns null when both env vars are missing", () => {
            delete process.env.SENTRY_ORG;
            delete process.env.SENTRY_PROJECT;

            const url = getSentryTraceUrl("trace123");

            expect(url).toBeNull();
        });

        it("generates correct Sentry URL when configured", () => {
            process.env.SENTRY_ORG = "carmenta";
            process.env.SENTRY_PROJECT = "carmenta-jobs";

            const url = getSentryTraceUrl("abc123def456");

            expect(url).toBe(
                "https://carmenta.sentry.io/performance/trace/abc123def456/?project=carmenta-jobs"
            );
        });

        it("URL-encodes org name with special characters", () => {
            process.env.SENTRY_ORG = "my org";
            process.env.SENTRY_PROJECT = "project";

            const url = getSentryTraceUrl("trace123");

            expect(url).toContain("my%20org.sentry.io");
        });

        it("URL-encodes project name with special characters", () => {
            process.env.SENTRY_ORG = "org";
            process.env.SENTRY_PROJECT = "my project";

            const url = getSentryTraceUrl("trace123");

            expect(url).toContain("project=my%20project");
        });

        it("URL-encodes trace ID with special characters", () => {
            process.env.SENTRY_ORG = "org";
            process.env.SENTRY_PROJECT = "project";

            const url = getSentryTraceUrl("trace/with/slashes");

            expect(url).toContain("trace%2Fwith%2Fslashes");
        });

        it("handles empty string org (returns null)", () => {
            process.env.SENTRY_ORG = "";
            process.env.SENTRY_PROJECT = "project";

            const url = getSentryTraceUrl("trace123");

            expect(url).toBeNull();
        });

        it("handles empty string project (returns null)", () => {
            process.env.SENTRY_ORG = "org";
            process.env.SENTRY_PROJECT = "";

            const url = getSentryTraceUrl("trace123");

            expect(url).toBeNull();
        });
    });

    describe("getTemporalWorkflowUrl", () => {
        it("returns null when TEMPORAL_UI_URL is not configured", () => {
            delete process.env.TEMPORAL_UI_URL;

            const url = getTemporalWorkflowUrl("workflow123");

            expect(url).toBeNull();
        });

        it("generates correct URL with default namespace", () => {
            process.env.TEMPORAL_UI_URL = "https://cloud.temporal.io";
            delete process.env.TEMPORAL_NAMESPACE;

            const url = getTemporalWorkflowUrl("workflow-abc-123");

            expect(url).toBe(
                "https://cloud.temporal.io/namespaces/default/workflows/workflow-abc-123"
            );
        });

        it("uses TEMPORAL_NAMESPACE when configured", () => {
            process.env.TEMPORAL_UI_URL = "https://cloud.temporal.io";
            process.env.TEMPORAL_NAMESPACE = "production";

            const url = getTemporalWorkflowUrl("workflow123");

            expect(url).toBe(
                "https://cloud.temporal.io/namespaces/production/workflows/workflow123"
            );
        });

        it("handles base URL with trailing slash", () => {
            process.env.TEMPORAL_UI_URL = "https://temporal.example.com/";
            process.env.TEMPORAL_NAMESPACE = "dev";

            const url = getTemporalWorkflowUrl("wf123");

            // Implementation strips trailing slashes to avoid double slashes
            expect(url).toBe(
                "https://temporal.example.com/namespaces/dev/workflows/wf123"
            );
        });

        it("handles base URL with multiple trailing slashes", () => {
            process.env.TEMPORAL_UI_URL = "https://temporal.example.com///";
            process.env.TEMPORAL_NAMESPACE = "dev";

            const url = getTemporalWorkflowUrl("wf123");

            // Implementation strips all trailing slashes
            expect(url).toBe(
                "https://temporal.example.com/namespaces/dev/workflows/wf123"
            );
        });

        it("URL-encodes namespace with special characters", () => {
            process.env.TEMPORAL_UI_URL = "https://temporal.io";
            process.env.TEMPORAL_NAMESPACE = "my namespace";

            const url = getTemporalWorkflowUrl("wf123");

            expect(url).toContain("namespaces/my%20namespace/");
        });

        it("URL-encodes workflow ID with special characters", () => {
            process.env.TEMPORAL_UI_URL = "https://temporal.io";
            process.env.TEMPORAL_NAMESPACE = "default";

            const url = getTemporalWorkflowUrl("job:morning-briefing:run:123");

            expect(url).toContain("workflows/job%3Amorning-briefing%3Arun%3A123");
        });

        it("handles empty string TEMPORAL_UI_URL (returns null)", () => {
            process.env.TEMPORAL_UI_URL = "";

            const url = getTemporalWorkflowUrl("workflow123");

            expect(url).toBeNull();
        });
    });

    describe("buildExternalLinks", () => {
        beforeEach(() => {
            // Default: both services configured
            process.env.SENTRY_ORG = "test-org";
            process.env.SENTRY_PROJECT = "test-project";
            process.env.TEMPORAL_UI_URL = "https://temporal.io";
            process.env.TEMPORAL_NAMESPACE = "default";
        });

        it("returns empty object when no IDs provided", () => {
            const links = buildExternalLinks({});

            expect(links).toEqual({});
        });

        it("returns empty object when IDs are null", () => {
            const links = buildExternalLinks({
                sentryTraceId: null,
                temporalWorkflowId: null,
            });

            expect(links).toEqual({});
        });

        it("returns empty object when IDs are undefined", () => {
            const links = buildExternalLinks({
                sentryTraceId: undefined,
                temporalWorkflowId: undefined,
            });

            expect(links).toEqual({});
        });

        it("includes only Sentry link when only trace ID provided", () => {
            const links = buildExternalLinks({
                sentryTraceId: "trace123",
            });

            expect(links.sentry).toBeDefined();
            expect(links.temporal).toBeUndefined();
        });

        it("includes only Temporal link when only workflow ID provided", () => {
            const links = buildExternalLinks({
                temporalWorkflowId: "workflow123",
            });

            expect(links.sentry).toBeUndefined();
            expect(links.temporal).toBeDefined();
        });

        it("includes both links when both IDs provided", () => {
            const links = buildExternalLinks({
                sentryTraceId: "trace123",
                temporalWorkflowId: "workflow123",
            });

            expect(links.sentry).toBeDefined();
            expect(links.temporal).toBeDefined();
            expect(links.sentry).toContain("trace123");
            expect(links.temporal).toContain("workflow123");
        });

        it("omits Sentry link when Sentry not configured", () => {
            delete process.env.SENTRY_ORG;

            const links = buildExternalLinks({
                sentryTraceId: "trace123",
                temporalWorkflowId: "workflow123",
            });

            expect(links.sentry).toBeUndefined();
            expect(links.temporal).toBeDefined();
        });

        it("omits Temporal link when Temporal not configured", () => {
            delete process.env.TEMPORAL_UI_URL;

            const links = buildExternalLinks({
                sentryTraceId: "trace123",
                temporalWorkflowId: "workflow123",
            });

            expect(links.sentry).toBeDefined();
            expect(links.temporal).toBeUndefined();
        });

        it("returns empty object when services configured but no IDs", () => {
            const links = buildExternalLinks({
                sentryTraceId: null,
                temporalWorkflowId: null,
            });

            expect(links).toEqual({});
        });
    });
});
