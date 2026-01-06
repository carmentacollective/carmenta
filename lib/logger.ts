import pino from "pino";

const isProduction = process.env.NODE_ENV === "production";
const isTest = process.env.NODE_ENV === "test";

/**
 * Structured logger using Pino
 *
 * Usage:
 * ```ts
 * import { logger } from "@/lib/logger";
 *
 * logger.info({ userId, action }, "User performed action");
 * logger.error({ error, context }, "Operation failed");
 * ```
 *
 * First argument is always a context object, second is the message.
 *
 * IMPORTANT: We avoid using pino-pretty's transport API in dev mode because the
 * worker thread it spawns can cause 100% CPU infinite loops when exceptions occur
 * during logging (error handler tries to log → triggers another error → recursion).
 * See: https://github.com/vercel/next.js/issues/86099
 *
 * For pretty dev logs, pipe through pino-pretty CLI:
 *   pnpm dev 2>&1 | pnpm pino-pretty
 */
export const logger = pino({
    level: isTest ? "silent" : isProduction ? "info" : "debug",
});
