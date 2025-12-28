"use client";

/**
 * ModelSelectorTrigger - Button that opens the model selector modal
 *
 * A composer button that opens the full model selection modal.
 * Shows the current model icon or sparkles for Auto mode.
 *
 * The modal open state is managed by ConnectRuntimeProvider so that
 * other components (like feature tips) can also trigger the modal.
 */

import { Sparkles } from "lucide-react";

import { MODELS, type ModelConfig } from "@/lib/model-config";
import { ProviderIcon } from "@/components/icons/provider-icons";
import { cn } from "@/lib/utils";
import { useSettingsModal } from "@/components/connection/connect-runtime-provider";
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
    /** Show model shortName label (for mobile compact view) */
    showLabel?: boolean;
}

export function ModelSelectorTrigger({
    overrides,
    onChange,
    disabled,
    className,
    conciergeModel,
    showLabel = false,
}: ModelSelectorTriggerProps) {
    const { settingsOpen, setSettingsOpen } = useSettingsModal();

    // Determine which model to show
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

    // For showLabel mode: only show shortName when user has manually selected a model
    // (not when concierge selected it - that's still "Auto")
    const labelText = showLabel && manualModel ? manualModel.shortName : null;

    return (
        <div className={cn("relative", className)}>
            {/* Trigger Button */}
            <button
                onClick={() => setSettingsOpen(true)}
                disabled={disabled}
                className={cn(
                    // When showLabel with text: pill style. Otherwise: icon button style
                    showLabel && labelText
                        ? "group relative flex items-center gap-1.5 rounded-full px-3 py-2 transition-colors hover:bg-foreground/5"
                        : "btn-icon-glass group relative",
                    hasOverrides && !isAuto ? "ring-2 ring-primary/40" : "",
                    disabled && "btn-disabled"
                )}
                aria-label="Model settings"
                data-tooltip-id="tip"
                data-tooltip-content="Choose how we think"
            >
                {/* showLabel mode: sparkles (+ optional label), otherwise provider icon */}
                {showLabel ? (
                    <>
                        <Sparkles
                            className={cn(
                                "h-5 w-5 transition-colors",
                                labelText
                                    ? "text-primary"
                                    : "text-foreground/50 group-hover:text-foreground/80"
                            )}
                        />
                        {labelText && (
                            <span className="text-sm font-medium text-foreground/80">
                                {labelText}
                            </span>
                        )}
                    </>
                ) : displayModel ? (
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
                isOpen={settingsOpen}
                onClose={() => setSettingsOpen(false)}
                overrides={overrides}
                onChange={onChange}
                conciergeModel={conciergeModel}
            />
        </div>
    );
}
