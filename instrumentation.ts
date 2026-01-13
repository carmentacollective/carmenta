/**
 * Next.js Instrumentation
 *
 * This file is loaded early in the Next.js lifecycle and is used to
 * initialize monitoring and tracing tools like Sentry.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
import * as Sentry from "@sentry/nextjs";

export async function register() {
    if (process.env.NEXT_RUNTIME === "nodejs") {
        await import("./sentry.server.config");
    }
}

// Capture errors from Server Components, middleware, and proxies
export const onRequestError = Sentry.captureRequestError;
