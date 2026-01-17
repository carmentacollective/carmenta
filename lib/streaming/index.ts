/**
 * Streaming Utilities
 *
 * Utilities for enhanced streaming with transient messages.
 * Server-side: writeTransient, writeStatus, etc.
 * Client-side: TransientProvider, useTransient, etc.
 */

// Types (shared between server and client)
export * from "./types";

// Server-side utilities
export * from "./transient-writer";

// Client-side context and hooks
export {
    TransientProvider,
    useTransient,
    useTransientChat,
    useTransientOracle,
    useTransientToast,
} from "./transient-context";
