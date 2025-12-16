/**
 * Next.js Instrumentation
 *
 * This file is loaded early in the Next.js lifecycle and is used to
 * initialize monitoring and tracing tools like Sentry.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
    if (process.env.NEXT_RUNTIME === "nodejs") {
        // Server-side Sentry initialization
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
    // Skip errors that occur after response is already sent
    if (error.message?.includes("Cannot append headers")) {
        return;
    }

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
