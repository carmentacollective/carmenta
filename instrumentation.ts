/**
 * Next.js Instrumentation
 *
 * This file is loaded early in the Next.js lifecycle and is used to
 * initialize monitoring and tracing tools:
 * - Phoenix (Arize): LLM tracing and observability
 * - Sentry: Error tracking and general APM
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
    if (process.env.NEXT_RUNTIME === "nodejs") {
        // Initialize Phoenix OTEL for LLM tracing (must be before Sentry)
        // This sends all LLM traces to Phoenix for evals and observability
        if (process.env.ARIZE_API_KEY) {
            const { register: registerPhoenix } = await import("@arizeai/phoenix-otel");
            registerPhoenix({
                projectName: "carmenta",
                batch: true, // Batch spans for efficiency
            });
        }

        // Server-side Sentry initialization (error tracking only, not LLM traces)
        await import("./sentry.server.config");
    }
}

export async function onRequestError(
    error: Error & { digest?: string },
    request: {
        path: string;
        method: string;
        headers: Record<string, string>;
    },
    context: {
        routerKind: "Pages Router" | "App Router";
        routePath: string;
        routeType: "render" | "route" | "action" | "middleware";
        revalidateReason?: "on-demand" | "stale" | undefined;
    }
) {
    // Import Sentry dynamically to avoid issues during build
    const Sentry = await import("@sentry/nextjs");

    Sentry.captureException(error, {
        tags: {
            routerKind: context.routerKind,
            routeType: context.routeType,
            routePath: context.routePath,
        },
        extra: {
            path: request.path,
            method: request.method,
            digest: error.digest,
            revalidateReason: context.revalidateReason,
        },
    });
}
