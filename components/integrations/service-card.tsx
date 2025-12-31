"use client";

import Image from "next/image";
import { Check, AlertCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ServiceDefinition, RolloutStatus } from "@/lib/integrations/services";
import type { IntegrationStatus } from "@/lib/integrations/types";

interface ServiceCardProps {
    service: ServiceDefinition;
    status?: IntegrationStatus;
    accountDisplayName?: string | null;
    onClick?: () => void;
    onDisconnect?: () => void;
    disabled?: boolean;
}

function StatusBadge({ status }: { status: RolloutStatus | IntegrationStatus }) {
    if (status === "connected") {
        return (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/15 px-3 py-1 text-xs font-medium text-green-700 dark:text-green-400">
                <Check className="h-3 w-3" />
                Connected
            </span>
        );
    }

    if (status === "error") {
        return (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/15 px-3 py-1 text-xs font-medium text-red-700 dark:text-red-400">
                <AlertCircle className="h-3 w-3" />
                Error
            </span>
        );
    }

    if (status === "expired") {
        return (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-3 py-1 text-xs font-medium text-amber-700 dark:text-amber-400">
                <Clock className="h-3 w-3" />
                Expired
            </span>
        );
    }

    if (status === "disconnected") {
        return (
            <span className="bg-foreground/10 text-foreground/60 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium">
                Disconnected
            </span>
        );
    }

    if (status === "beta") {
        return (
            <span className="bg-primary/15 text-primary inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium">
                Beta
            </span>
        );
    }

    if (status === "internal") {
        return (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-3 py-1 text-xs font-medium text-amber-700 dark:text-amber-400">
                Internal
            </span>
        );
    }

    return null;
}

export function ServiceCard({
    service,
    status,
    accountDisplayName,
    onClick,
    onDisconnect,
    disabled = false,
}: ServiceCardProps) {
    const isConnected = status === "connected";
    // Allow clicks if onClick exists, not disabled, and either not coming_soon OR explicitly allowed (disabled=false for coming_soon = admin override)
    const isClickable = !disabled && !!onClick;

    return (
        <div
            className={cn(
                "glass-card group relative flex flex-col gap-4 transition-all duration-300",
                isClickable && "cursor-pointer hover:scale-[1.02] hover:shadow-xl",
                isConnected && "ring-2 ring-green-500/30",
                disabled && "cursor-not-allowed opacity-50"
            )}
            onClick={isClickable ? onClick : undefined}
            role={isClickable ? "button" : undefined}
            tabIndex={isClickable ? 0 : undefined}
            onKeyDown={
                isClickable
                    ? (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              onClick?.();
                          }
                      }
                    : undefined
            }
        >
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                    {/* Logo */}
                    <div className="bg-foreground/5 relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-xl p-2">
                        <Image
                            src={service.logo}
                            alt={service.name}
                            fill
                            className="object-contain"
                        />
                    </div>

                    {/* Name & Status */}
                    <div>
                        <h3 className="text-foreground/90 font-medium">
                            {service.name}
                        </h3>
                        {accountDisplayName && status && (
                            <p className="text-foreground/60 text-sm">
                                {accountDisplayName}
                            </p>
                        )}
                    </div>
                </div>

                {/* Status Badge */}
                <StatusBadge status={status || service.status} />
            </div>

            {/* Description */}
            <p className="text-foreground/70 text-sm leading-relaxed">
                {service.description}
            </p>

            {/* Account actions overlay */}
            {status && onDisconnect && (
                <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/50 opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onDisconnect();
                        }}
                        className="rounded-lg bg-red-500/90 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-600"
                    >
                        {status === "disconnected" ? "Remove" : "Disconnect"}
                    </button>
                </div>
            )}
        </div>
    );
}
