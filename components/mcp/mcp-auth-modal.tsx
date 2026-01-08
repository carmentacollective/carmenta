"use client";

/**
 * MCP Authentication Modal
 *
 * In-conversation modal that appears when a user tries to use a tool from an
 * MCP server that requires authentication. Designed to preserve conversation
 * flow while handling OAuth flows.
 *
 * Design: Based on LibreChat's MCPConfigDialog pattern but adapted to Carmenta's
 * aesthetic and inline modal approach.
 */

import { useState, useCallback } from "react";
import { KeyIcon, ArrowsClockwiseIcon, XIcon } from "@phosphor-icons/react";
import { motion, AnimatePresence } from "framer-motion";

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { logger } from "@/lib/client-logger";

interface McpAuthModalProps {
    /** Whether the modal is open */
    open: boolean;
    /** Callback when modal open state changes */
    onOpenChange: (open: boolean) => void;
    /** Server display name */
    serverName: string;
    /** Server identifier for API calls */
    serverId: number;
    /** Optional callback after successful authentication */
    onAuthSuccess?: () => void;
    /** Optional callback on cancel */
    onCancel?: () => void;
}

/**
 * Modal for handling MCP server authentication inline in conversation.
 *
 * Flow:
 * 1. User tries to use tool from unauthenticated server
 * 2. Modal appears with "Connect" button
 * 3. User clicks Connect → OAuth flow opens in popup
 * 4. On success → onAuthSuccess callback (retry tool call)
 * 5. On cancel → onCancel callback (show cancellation message)
 */
export function McpAuthModal({
    open,
    onOpenChange,
    serverName,
    serverId,
    onAuthSuccess,
    onCancel,
}: McpAuthModalProps) {
    const [isConnecting, setIsConnecting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleConnect = useCallback(async () => {
        setIsConnecting(true);
        setError(null);

        try {
            // TODO: Implement OAuth flow
            // 1. Call API to get OAuth URL for this server
            // 2. Open OAuth URL in popup
            // 3. Listen for success/failure message
            // 4. On success, call onAuthSuccess

            const response = await fetch(`/api/mcp/servers/${serverId}/auth`, {
                method: "POST",
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || "Failed to start authentication");
            }

            const { authUrl } = await response.json();

            // Open OAuth in popup
            const popup = window.open(
                authUrl,
                "mcp-oauth",
                "width=600,height=700,scrollbars=yes"
            );

            // Listen for OAuth completion
            const handleMessage = (event: MessageEvent) => {
                if (event.data?.type === "mcp-oauth-success") {
                    window.removeEventListener("message", handleMessage);
                    popup?.close();
                    setIsConnecting(false);
                    onOpenChange(false);
                    onAuthSuccess?.();
                } else if (event.data?.type === "mcp-oauth-error") {
                    window.removeEventListener("message", handleMessage);
                    popup?.close();
                    setIsConnecting(false);
                    setError(event.data.error || "Authentication failed");
                }
            };

            window.addEventListener("message", handleMessage);

            // Cleanup if popup is closed manually
            const pollTimer = setInterval(() => {
                if (popup?.closed) {
                    clearInterval(pollTimer);
                    window.removeEventListener("message", handleMessage);
                    setIsConnecting(false);
                }
            }, 500);
        } catch (err) {
            logger.error({ error: err, serverId }, "MCP auth flow failed");
            setError(err instanceof Error ? err.message : "Authentication failed");
            setIsConnecting(false);
        }
    }, [serverId, onAuthSuccess, onOpenChange]);

    const handleCancel = useCallback(() => {
        onOpenChange(false);
        onCancel?.();
    }, [onOpenChange, onCancel]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/15">
                        <KeyIcon
                            className="h-6 w-6 text-amber-600 dark:text-amber-400"
                            weight="fill"
                        />
                    </div>
                    <DialogTitle className="text-center">
                        {serverName} needs authentication
                    </DialogTitle>
                    <DialogDescription className="text-center">
                        Connect your account to use tools from this MCP server.
                    </DialogDescription>
                </DialogHeader>

                <AnimatePresence mode="wait">
                    {error && (
                        <motion.div
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            className="rounded-lg bg-red-500/10 p-3 text-center text-sm text-red-600 dark:text-red-400"
                        >
                            {error}
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:justify-center">
                    <button
                        onClick={handleConnect}
                        disabled={isConnecting}
                        className={cn(
                            "flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-medium transition-colors",
                            "bg-amber-500 text-white hover:bg-amber-600",
                            "focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:outline-none",
                            isConnecting && "cursor-not-allowed opacity-50"
                        )}
                    >
                        {isConnecting ? (
                            <>
                                <ArrowsClockwiseIcon className="h-4 w-4 animate-spin" />
                                Connecting...
                            </>
                        ) : (
                            <>
                                <KeyIcon className="h-4 w-4" weight="bold" />
                                Connect {serverName}
                            </>
                        )}
                    </button>

                    <button
                        onClick={handleCancel}
                        disabled={isConnecting}
                        className={cn(
                            "flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-medium transition-colors",
                            "bg-foreground/5 text-foreground/70 hover:bg-foreground/10",
                            "focus:ring-foreground/20 focus:ring-2 focus:ring-offset-2 focus:outline-none",
                            isConnecting && "cursor-not-allowed opacity-50"
                        )}
                    >
                        <XIcon className="h-4 w-4" />
                        Cancel
                    </button>
                </div>

                <p className="text-foreground/40 mt-4 text-center text-xs">
                    A popup will open to complete authentication. Make sure popups are
                    enabled.
                </p>
            </DialogContent>
        </Dialog>
    );
}

/**
 * Hook for managing MCP auth modal state
 *
 * Usage:
 * ```tsx
 * const { showAuthModal, authModalProps } = useMcpAuthModal();
 *
 * // When a tool call fails with 401
 * showAuthModal({
 *   serverName: "GitHub MCP",
 *   serverId: 123,
 *   onAuthSuccess: () => retryToolCall(),
 * });
 *
 * // In render
 * <McpAuthModal {...authModalProps} />
 * ```
 */
export function useMcpAuthModal() {
    const [modalState, setModalState] = useState<{
        open: boolean;
        serverName: string;
        serverId: number;
        onAuthSuccess?: () => void;
        onCancel?: () => void;
    }>({
        open: false,
        serverName: "",
        serverId: 0,
    });

    const showAuthModal = useCallback(
        (params: {
            serverName: string;
            serverId: number;
            onAuthSuccess?: () => void;
            onCancel?: () => void;
        }) => {
            setModalState({
                ...params,
                open: true,
            });
        },
        []
    );

    const hideAuthModal = useCallback(() => {
        setModalState((prev) => ({ ...prev, open: false }));
    }, []);

    return {
        showAuthModal,
        hideAuthModal,
        authModalProps: {
            ...modalState,
            onOpenChange: (open: boolean) => {
                if (!open) hideAuthModal();
            },
        },
    };
}
