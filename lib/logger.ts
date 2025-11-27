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
 */
export const logger = pino({
    level: isTest ? "silent" : isProduction ? "info" : "debug",
    transport: isProduction
        ? undefined
        : {
              target: "pino-pretty",
              options: {
                  colorize: true,
                  translateTime: "SYS:standard",
                  ignore: "pid,hostname",
              },
          },
});
