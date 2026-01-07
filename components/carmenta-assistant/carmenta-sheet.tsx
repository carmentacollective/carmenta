"use client";

/**
 * CarmentaSheet
 *
 * A proper side-panel Carmenta interface using shadcn Sheet.
 * Uses the real Chat component from /connection for full feature parity.
 *
 * This is essentially the mobile/narrow version of the main chat interface,
 * with the same tool rendering, message actions, and composer features.
 *
 * Usage:
 * ```tsx
 * const [open, setOpen] = useState(false);
 * <CarmentaSheet
 *   open={open}
 *   onOpenChange={setOpen}
 *   pageContext="knowledge-base"
 *   placeholder="What should we organize?"
 * />
 * ```
 */

import { Sparkle, Trash } from "@phosphor-icons/react";

import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from "@/components/ui/sheet";
import { PortalErrorBoundary } from "@/components/ui/portal-error-boundary";
import { ConnectRuntimeProvider, useChatContext } from "@/components/connection";
import { HoloThread } from "@/components/connection/holo-thread";
import { cn } from "@/lib/utils";

interface CarmentaSheetProps {
    /** Whether the sheet is open */
    open: boolean;
    /** Callback when open state changes */
    onOpenChange: (open: boolean) => void;
    /** Page context for DCOS - what page/feature the user is on */
    pageContext: string;
    /** Callback when Carmenta makes changes (tool calls complete) */
    onChangesComplete?: () => void;
    /** Title shown in the sheet header */
    title?: string;
    /** Description shown below the title */
    description?: string;
}

export function CarmentaSheet({
    open,
    onOpenChange,
    pageContext,
    onChangesComplete,
    title = "Carmenta",
    description = "Working together",
}: CarmentaSheetProps) {
    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                side="left"
                className={cn(
                    "flex flex-col p-0",
                    // Wider on tablets, narrower on phones
                    "w-full sm:w-[400px] sm:max-w-[400px]"
                )}
                hideClose
            >
                {/* Error boundary inside portal ensures Sentry captures errors */}
                <PortalErrorBoundary
                    portalName="CarmentaSheet"
                    onDismiss={() => onOpenChange(false)}
                >
                    <ConnectRuntimeProvider
                        endpoint="/api/dcos"
                        pageContext={pageContext}
                        onChangesComplete={onChangesComplete}
                    >
                        <CarmentaSheetInner title={title} description={description} />
                    </ConnectRuntimeProvider>
                </PortalErrorBoundary>
            </SheetContent>
        </Sheet>
    );
}

/**
 * Inner component that has access to ChatContext
 */
function CarmentaSheetInner({
    title,
    description,
}: {
    title: string;
    description: string;
}) {
    const { messages, setMessages, stop } = useChatContext();

    const handleClear = () => {
        stop();
        setMessages([]);
    };

    return (
        <>
            {/* Header */}
            <SheetHeader className="border-foreground/[0.08] flex-row items-center justify-between space-y-0 border-b px-4 py-3">
                <div className="flex items-center gap-2.5">
                    <div className="bg-primary/20 flex h-8 w-8 items-center justify-center rounded-full">
                        <Sparkle className="text-primary h-4 w-4" weight="duotone" />
                    </div>
                    <div>
                        <SheetTitle className="text-sm font-medium">{title}</SheetTitle>
                        <SheetDescription className="text-[10px]">
                            {description}
                        </SheetDescription>
                    </div>
                </div>

                <div className="flex items-center gap-1">
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
            </SheetHeader>

            {/* Chat interface - same as /connection but narrower */}
            {/* @container enables container queries so Composer adapts to sheet width */}
            <div className="@container min-h-0 flex-1 overflow-hidden">
                <HoloThread />
            </div>
        </>
    );
}
