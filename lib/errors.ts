/**
 * Application-specific error classes
 */

export class ApplicationError extends Error {
    constructor(
        message: string,
        public code: string,
        public statusCode: number = 500,
        public details?: unknown
    ) {
        super(message);
        this.name = "ApplicationError";
    }
}

export class AuthenticationError extends ApplicationError {
    constructor(message: string = "We need you to sign in", details?: unknown) {
        super(message, "AUTHENTICATION_ERROR", 401, details);
        this.name = "AuthenticationError";
    }
}

export class AuthorizationError extends ApplicationError {
    constructor(
        message: string = "We don't have permission for that",
        details?: unknown
    ) {
        super(message, "AUTHORIZATION_ERROR", 403, details);
        this.name = "AuthorizationError";
    }
}

export class NotFoundError extends ApplicationError {
    constructor(resource: string, details?: unknown) {
        super(`We couldn't find that ${resource}`, "NOT_FOUND", 404, details);
        this.name = "NotFoundError";
    }
}

export class ServiceConnectionError extends ApplicationError {
    constructor(service: string, details?: Record<string, unknown>) {
        super(`${service} isn't connected yet`, "SERVICE_NOT_CONNECTED", 400, {
            service,
            ...(details || {}),
        });
        this.name = "ServiceConnectionError";
    }
}

export class ValidationError extends ApplicationError {
    constructor(message: string, details?: unknown) {
        super(message, "VALIDATION_ERROR", 400, details);
        this.name = "ValidationError";
    }
}

/**
 * Serialize errors for structured logging
 * gRPC errors and other complex errors don't serialize well with JSON.stringify
 */
export function serializeError(err: unknown): Record<string, unknown> {
    if (err instanceof Error) {
        return {
            name: err.name,
            message: err.message,
            stack: err.stack,
            // Capture gRPC-specific properties if present
            ...(("code" in err && { code: err.code }) || {}),
            ...(("details" in err && { details: err.details }) || {}),
            // Only capture metadata keys, not values (may contain auth tokens)
            ...(("metadata" in err &&
                typeof err.metadata === "object" &&
                err.metadata !== null && { metadataKeys: Object.keys(err.metadata) }) ||
                {}),
        };
    }
    return { raw: String(err) };
}
