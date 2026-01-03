/**
 * External Service Link Generators
 *
 * Build URLs to external observability tools for debugging job runs.
 * Links are only generated when the service is configured.
 */

/**
 * Generate Sentry trace URL from trace ID
 * Returns null if Sentry org/project not configured
 */
export function getSentryTraceUrl(traceId: string): string | null {
    const org = process.env.SENTRY_ORG;
    const project = process.env.SENTRY_PROJECT;

    if (!org || !project) return null;

    return `https://${encodeURIComponent(org)}.sentry.io/performance/trace/${encodeURIComponent(traceId)}/?project=${encodeURIComponent(project)}`;
}

/**
 * Generate Temporal UI workflow URL
 * Returns null if Temporal UI URL not configured
 */
export function getTemporalWorkflowUrl(workflowId: string): string | null {
    const baseUrl = process.env.TEMPORAL_UI_URL;

    if (!baseUrl) return null;

    const namespace = process.env.TEMPORAL_NAMESPACE || "default";
    return `${baseUrl}/namespaces/${encodeURIComponent(namespace)}/workflows/${encodeURIComponent(workflowId)}`;
}

/**
 * Build all available external links for a job run
 */
export function buildExternalLinks(options: {
    sentryTraceId?: string | null;
    temporalWorkflowId?: string | null;
}): {
    sentry?: string;
    temporal?: string;
} {
    const links: { sentry?: string; temporal?: string } = {};

    if (options.sentryTraceId) {
        const sentryUrl = getSentryTraceUrl(options.sentryTraceId);
        if (sentryUrl) {
            links.sentry = sentryUrl;
        }
    }

    if (options.temporalWorkflowId) {
        const temporalUrl = getTemporalWorkflowUrl(options.temporalWorkflowId);
        if (temporalUrl) {
            links.temporal = temporalUrl;
        }
    }

    return links;
}
