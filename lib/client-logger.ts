/**
 * Client-side logger for browser environments
 *
 * Mirrors the server logger API but works in browsers.
 * Structured JSON logging with Sentry integration for production monitoring.
 *
 * Usage:
 * ```ts
 * import { logger } from "@/lib/client-logger";
 *
 * logger.info({ component: "Chat" }, "Message sent");
 * logger.error({ error, context }, "Request failed"); // Auto-reports to Sentry
 * ```
 */

import * as Sentry from "@sentry/nextjs";

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
    [key: string]: unknown;
}

const isProduction = process.env.NODE_ENV === "production";
const isTest = process.env.NODE_ENV === "test";

function shouldLog(level: LogLevel): boolean {
    if (isTest) return false;

    const levels: LogLevel[] = ["debug", "info", "warn", "error"];
    const minLevel = isProduction ? "info" : "debug";
    return levels.indexOf(level) >= levels.indexOf(minLevel);
}

function formatLog(level: LogLevel, context: LogContext, message: string) {
    const timestamp = new Date().toISOString();
    return {
        timestamp,
        level,
        msg: message,
        ...context,
    };
}

function log(level: LogLevel, context: LogContext, message: string) {
    if (!shouldLog(level)) return;

    const formatted = formatLog(level, context, message);

    // Report errors and warnings to Sentry for production monitoring
    if (level === "error" || level === "warn") {
        const { error, ...extra } = context;

        if (error instanceof Error) {
            // Report actual Error objects to Sentry
            Sentry.captureException(error, {
                level: level === "error" ? "error" : "warning",
                extra: { message, ...extra },
            });
        } else {
            // Report error/warning messages without Error objects
            Sentry.captureMessage(message, {
                level: level === "error" ? "error" : "warning",
                extra: context,
            });
        }
    }

    // Also log to console
    const consoleFn =
        level === "error"
            ? console.error
            : level === "warn"
              ? console.warn
              : console.log;

    if (isProduction) {
        // Structured JSON for production log aggregation
        consoleFn(JSON.stringify(formatted));
    } else {
        // Pretty format for development
        consoleFn(`[${level.toUpperCase()}] ${message}`, context);
    }
}

export const logger = {
    debug: (context: LogContext, message: string) => log("debug", context, message),
    info: (context: LogContext, message: string) => log("info", context, message),
    warn: (context: LogContext, message: string) => log("warn", context, message),
    error: (context: LogContext, message: string) => log("error", context, message),
};
