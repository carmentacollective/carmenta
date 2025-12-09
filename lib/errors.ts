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
    constructor(message: string = "Authentication required", details?: unknown) {
        super(message, "AUTHENTICATION_ERROR", 401, details);
        this.name = "AuthenticationError";
    }
}

export class AuthorizationError extends ApplicationError {
    constructor(message: string = "Insufficient permissions", details?: unknown) {
        super(message, "AUTHORIZATION_ERROR", 403, details);
        this.name = "AuthorizationError";
    }
}

export class NotFoundError extends ApplicationError {
    constructor(resource: string, details?: unknown) {
        super(`${resource} not found`, "NOT_FOUND", 404, details);
        this.name = "NotFoundError";
    }
}

export class ServiceConnectionError extends ApplicationError {
    constructor(service: string, details?: Record<string, unknown>) {
        super(`${service} is not connected`, "SERVICE_NOT_CONNECTED", 400, {
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
