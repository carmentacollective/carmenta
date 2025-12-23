"use client";

import { useState } from "react";
import Image from "next/image";
import { ExternalLink, Loader2, Eye, EyeOff, Key } from "lucide-react";
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

export function ApiKeyModal({
    service,
    open,
    onOpenChange,
    onSubmit,
}: ApiKeyModalProps) {
    const [apiKey, setApiKey] = useState("");
    const [showKey, setShowKey] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!apiKey.trim()) {
            setError("API key is required");
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const result = await onSubmit(apiKey.trim());
            if (result.success) {
                setApiKey("");
                setShowKey(false);
                onOpenChange(false);
            } else {
                setError(result.error || "Failed to connect");
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "An error occurred");
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        if (!loading) {
            setApiKey("");
            setError(null);
            setShowKey(false);
            onOpenChange(false);
        }
    };

    if (!service) return null;

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <div className="flex items-center gap-3">
                        <div className="relative h-10 w-10 overflow-hidden rounded-xl bg-foreground/5 p-2">
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

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Get API Key Link */}
                    {service.getApiKeyUrl && (
                        <div className="rounded-lg bg-foreground/5 p-3">
                            <p className="mb-2 text-sm text-foreground/70">
                                We need an API key to connect to {service.name}.
                            </p>
                            <a
                                href={service.getApiKeyUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-sm text-primary underline decoration-primary/30 transition-colors hover:decoration-primary"
                            >
                                <Key className="h-3.5 w-3.5" />
                                Get your API key
                                <ExternalLink className="h-3 w-3" />
                            </a>
                        </div>
                    )}

                    {/* API Key Input */}
                    <div className="space-y-2">
                        <label
                            htmlFor="api-key"
                            className="text-sm font-medium text-foreground/80"
                        >
                            API Key
                        </label>
                        <div className="relative">
                            <input
                                id="api-key"
                                type={showKey ? "text" : "password"}
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                placeholder={
                                    service.apiKeyPlaceholder || "Enter your API key"
                                }
                                className="w-full rounded-lg border border-foreground/15 bg-background px-4 py-3 pr-12 text-sm text-foreground placeholder:text-foreground/40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                                disabled={loading}
                                autoComplete="off"
                                autoFocus
                            />
                            <button
                                type="button"
                                onClick={() => setShowKey(!showKey)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground/50 hover:text-foreground/80"
                                data-tooltip-id="tip"
                                data-tooltip-content={
                                    showKey ? "Hide key" : "Reveal key"
                                }
                            >
                                {showKey ? (
                                    <EyeOff className="h-4 w-4" />
                                ) : (
                                    <Eye className="h-4 w-4" />
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
                            {error}
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={handleClose}
                            disabled={loading}
                            className="flex-1 rounded-lg border border-foreground/15 px-4 py-2.5 text-sm font-medium text-foreground/70 transition-colors hover:bg-foreground/5 disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading || !apiKey.trim()}
                            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Connecting...
                                </>
                            ) : (
                                "Connect"
                            )}
                        </button>
                    </div>
                </form>

                {/* Security Note */}
                <p className="pt-2 text-center text-xs text-foreground/50">
                    Your API key is encrypted and stored securely.
                </p>
            </DialogContent>
        </Dialog>
    );
}
