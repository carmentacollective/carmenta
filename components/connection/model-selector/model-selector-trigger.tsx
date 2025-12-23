"use client";

/**
 * ModelSelectorTrigger - Button that opens the model selector modal
 *
 * A composer button that opens the full model selection modal.
 * Shows the current model icon or sparkles for Auto mode.
 */

import { useState } from "react";
import { Sparkles } from "lucide-react";

import { MODELS, type ModelConfig } from "@/lib/model-config";
import { ProviderIcon } from "@/components/icons/provider-icons";
import { cn } from "@/lib/utils";
import { ModelSelectorModal } from "./model-selector-modal";

import type { ModelOverrides } from "./types";

interface ModelSelectorTriggerProps {
    /** Current override values */
    overrides: ModelOverrides;
    /** Callback when overrides change */
    onChange: (overrides: ModelOverrides) => void;
    /** Whether the selector is disabled */
    disabled?: boolean;
    /** Additional CSS classes */
    className?: string;
    /** Current model selected by concierge (for icon display) */
    conciergeModel?: ModelConfig | null;
}

export function ModelSelectorTrigger({
    overrides,
    onChange,
    disabled,
    className,
    conciergeModel,
}: ModelSelectorTriggerProps) {
    const [isOpen, setIsOpen] = useState(false);

    // Determine which icon to show
    const manualModel = overrides.modelId
        ? MODELS.find((m) => m.id === overrides.modelId)
        : null;

    // Priority: manual override > concierge selection > auto sparkles
    const displayModel = manualModel ?? conciergeModel ?? null;
    const isAuto = overrides.modelId === null;

    const hasOverrides =
        overrides.modelId !== null ||
        overrides.temperature !== null ||
        overrides.reasoning !== null;

    return (
        <div className={cn("relative", className)}>
            {/* Trigger Button */}
            <button
                onClick={() => setIsOpen(true)}
                disabled={disabled}
                className={cn(
                    "btn-icon-glass tooltip group relative",
                    hasOverrides && !isAuto ? "ring-2 ring-primary/40" : "",
                    disabled && "btn-disabled"
                )}
                aria-label="Model settings"
                data-tooltip="Choose AI model and adjust how we respond"
            >
                {displayModel ? (
                    <ProviderIcon
                        provider={displayModel.provider}
                        className={cn(
                            "h-5 w-5 transition-all duration-300 sm:h-6 sm:w-6",
                            disabled
                                ? "text-foreground/30"
                                : isAuto
                                  ? "text-foreground/60 group-hover:text-foreground/90"
                                  : "text-foreground/90"
                        )}
                    />
                ) : (
                    <Sparkles className="h-5 w-5 text-primary/70 transition-colors group-hover:text-primary sm:h-6 sm:w-6" />
                )}
            </button>

            {/* Modal */}
            <ModelSelectorModal
                isOpen={isOpen}
                onClose={() => setIsOpen(false)}
                overrides={overrides}
                onChange={onChange}
                conciergeModel={conciergeModel}
            />
        </div>
    );
}
