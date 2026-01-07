"use client";

/**
 * Carmenta Modal
 *
 * Universal interface to Carmenta through DCOS orchestration.
 * Opens with Cmd+K globally, provides quick access to all capabilities.
 * Uses the real Chat component from /connection for full feature parity.
 *
 * This is the "mobile" version of the assistant interface - a focused
 * overlay that provides the same capabilities as the main chat.
 */

import { SparkleIcon, Trash } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useCarmentaModal } from "@/hooks/use-carmenta-modal";
import {
    ConnectionProvider,
    ConnectRuntimeProvider,
    useChatContext,
} from "@/components/connection";
import { HoloThread } from "@/components/connection/holo-thread";

/**
 * Carmenta Modal Component
 *
 * Must be used within CarmentaModalProvider for keyboard shortcuts.
 */
export function CarmentaModal() {
    const { isOpen, close, pageContext } = useCarmentaModal();

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && close()}>
            <DialogContent
                className={cn(
                    "glass-card z-modal border-foreground/10",
                    "h-[80svh] w-full max-w-2xl",
                    "flex flex-col gap-0 overflow-hidden p-0"
                )}
            >
                <ConnectionProvider>
                    <ConnectRuntimeProvider
                        endpoint="/api/dcos"
                        pageContext={pageContext}
                    >
                        <CarmentaModalInner />
                    </ConnectRuntimeProvider>
                </ConnectionProvider>
            </DialogContent>
        </Dialog>
    );
}

/**
 * Inner component that has access to ChatContext
 */
function CarmentaModalInner() {
    const { messages, setMessages, stop } = useChatContext();

    const handleClear = () => {
        stop();
        setMessages([]);
    };

    return (
        <>
            {/* Header */}
            <div className="border-foreground/10 flex items-center justify-between border-b px-4 py-3">
                <div className="flex items-center gap-2">
                    <SparkleIcon
                        weight="duotone"
                        className="text-primary h-5 w-5 animate-pulse"
                    />
                    <DialogTitle className="text-sm font-medium">Carmenta</DialogTitle>
                </div>

                {messages.length > 0 && (
                    <button
                        onClick={handleClear}
                        className="text-foreground/40 hover:bg-foreground/5 hover:text-foreground/60 flex min-h-9 min-w-9 items-center justify-center rounded-lg transition-colors"
                        aria-label="Clear conversation"
                        title="Clear conversation"
                    >
                        <Trash className="h-4 w-4" />
                    </button>
                )}
            </div>

            {/* Chat interface - same as /connection */}
            <div className="min-h-0 flex-1 overflow-hidden">
                <HoloThread />
            </div>
        </>
    );
}

export { CarmentaModalProvider, useCarmentaModal } from "@/hooks/use-carmenta-modal";
