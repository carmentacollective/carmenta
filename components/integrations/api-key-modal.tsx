"use client";

import { useState, useActionState } from "react";
import Image from "next/image";
import {
    ArrowSquareOutIcon,
    CircleNotchIcon,
    EyeIcon,
    EyeSlashIcon,
    KeyIcon,
} from "@phosphor-icons/react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import type { ServiceDefinition } from "@/lib/integrations/services";

interface ApiKeyModalProps {
    service: ServiceDefinition | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (
        apiKey: string,
        label?: string
    ) => Promise<{ success: boolean; error?: string }>;
}

/**
 * Action state for API key form submission.
 * Uses React 19's useActionState for built-in loading/error handling.
 */
interface ActionState {
    error: string | null;
}

export function ApiKeyModal({
    service,
    open,
    onOpenChange,
    onSubmit,
}: ApiKeyModalProps) {
    const [apiKey, setApiKey] = useState("");
    const [showKey, setShowKey] = useState(false);
    // Reset key when modal closes to clear form state
    const [resetKey, setResetKey] = useState(0);

    // React 19: useActionState consolidates loading + error state
    const [state, formAction, isPending] = useActionState<ActionState, FormData>(
        async (_prevState, formData) => {
            const key = formData.get("apiKey") as string;

            if (!key?.trim()) {
                return { error: "API key is required" };
            }

            try {
                const result = await onSubmit(key.trim());
                if (result.success) {
                    // Reset form and close modal on success
                    setApiKey("");
                    setShowKey(false);
                    onOpenChange(false);
                    return { error: null };
                }
                return { error: result.error || "Failed to connect" };
            } catch (err) {
                return {
                    error: err instanceof Error ? err.message : "An error occurred",
                };
            }
        },
        { error: null }
    );

    const handleClose = () => {
        if (!isPending) {
            setApiKey("");
            setShowKey(false);
            // Increment reset key to remount form and clear error state
            setResetKey((k) => k + 1);
            onOpenChange(false);
        }
    };

    if (!service) return null;

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <div className="flex items-center gap-3">
                        <div className="bg-foreground/5 relative h-10 w-10 overflow-hidden rounded-xl p-2">
                            <Image
                                src={service.logo}
                                alt={service.name}
                                fill
                                className="object-contain"
                            />
                        </div>
                        <div>
                            <DialogTitle>Connect {service.name}</DialogTitle>
                            <DialogDescription>{service.description}</DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <form key={resetKey} action={formAction} className="space-y-4">
                    {/* Get API Key Link */}
                    {service.getApiKeyUrl && (
                        <div className="bg-foreground/5 rounded-lg p-3">
                            <p className="text-foreground/70 mb-2 text-sm">
                                We need an API key to connect to {service.name}.
                            </p>
                            <a
                                href={service.getApiKeyUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary decoration-primary/30 hover:decoration-primary inline-flex items-center gap-1.5 text-sm underline transition-colors"
                            >
                                <KeyIcon className="h-3.5 w-3.5" />
                                Get your API key
                                <ArrowSquareOutIcon className="h-3 w-3" />
                            </a>
                        </div>
                    )}

                    {/* API Key Input */}
                    <div className="space-y-2">
                        <label
                            htmlFor="api-key"
                            className="text-foreground/80 text-sm font-medium"
                        >
                            API Key
                        </label>
                        <div className="relative">
                            <input
                                id="api-key"
                                name="apiKey"
                                type={showKey ? "text" : "password"}
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                placeholder={
                                    service.apiKeyPlaceholder || "Enter your API key"
                                }
                                className="border-foreground/15 bg-background text-foreground placeholder:text-foreground/40 focus:border-primary focus:ring-primary/20 w-full rounded-lg border px-4 py-3 pr-12 text-sm focus:ring-2 focus:outline-none"
                                disabled={isPending}
                                autoComplete="off"
                                autoFocus
                            />
                            <button
                                type="button"
                                onClick={() => setShowKey(!showKey)}
                                className="text-foreground/50 hover:text-foreground/80 absolute top-1/2 right-3 -translate-y-1/2"
                                data-tooltip-id="tip"
                                data-tooltip-content={
                                    showKey ? "Hide key" : "Reveal key"
                                }
                            >
                                {showKey ? (
                                    <EyeSlashIcon className="h-4 w-4" />
                                ) : (
                                    <EyeIcon className="h-4 w-4" />
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Error Message */}
                    {state.error && (
                        <div className="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
                            {state.error}
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={handleClose}
                            disabled={isPending}
                            className="border-foreground/15 text-foreground/70 hover:bg-foreground/5 flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isPending || !apiKey.trim()}
                            className="bg-primary hover:bg-primary/90 flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-all disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {isPending ? (
                                <>
                                    <CircleNotchIcon className="h-4 w-4 animate-spin" />
                                    Connecting...
                                </>
                            ) : (
                                "Connect"
                            )}
                        </button>
                    </div>
                </form>

                {/* Security Note */}
                <p className="text-foreground/50 pt-2 text-center text-xs">
                    Your API key is encrypted and stored securely.
                </p>
            </DialogContent>
        </Dialog>
    );
}
