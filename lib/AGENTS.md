# Library Code

Shared utilities, database layer, services, and core business logic.

Use Pino for structured logging (never raw `console.*`). Use typed errors from
`@/lib/errors`. Let errors bubble to boundaries—don't silently catch and log.

@.cursor/rules/frontend/typescript-coding-standards.mdc
