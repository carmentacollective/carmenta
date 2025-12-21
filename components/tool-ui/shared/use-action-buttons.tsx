"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { logger } from "@/lib/client-logger";
import type { Action } from "./schema";

export type UseActionButtonsOptions = {
    actions: Action[];
    onAction: (actionId: string) => void | Promise<void>;
    onBeforeAction?: (actionId: string) => boolean | Promise<boolean>;
    confirmTimeout?: number;
};

export type UseActionButtonsResult = {
    actions: Array<
        Action & {
            currentLabel: string;
            isConfirming: boolean;
            isExecuting: boolean;
            isDisabled: boolean;
            isLoading: boolean;
        }
    >;
    runAction: (actionId: string) => Promise<void>;
    confirmingActionId: string | null;
    executingActionId: string | null;
};

export function useActionButtons(
    options: UseActionButtonsOptions
): UseActionButtonsResult {
    const { actions, onAction, onBeforeAction, confirmTimeout = 3000 } = options;

    const [confirmingActionId, setConfirmingActionId] = useState<string | null>(null);
    const [executingActionId, setExecutingActionId] = useState<string | null>(null);
    const executingRef = useRef<string | null>(null);

    useEffect(() => {
        if (!confirmingActionId) return;
        const id = setTimeout(() => setConfirmingActionId(null), confirmTimeout);
        return () => clearTimeout(id);
    }, [confirmingActionId, confirmTimeout]);

    useEffect(() => {
        if (!confirmingActionId) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                setConfirmingActionId(null);
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [confirmingActionId]);

    const runAction = useCallback(
        async (actionId: string) => {
            const action = actions.find((a) => a.id === actionId);
            if (!action) return;

            // Use ref for synchronous check to prevent race conditions on rapid clicks
            if (action.disabled || action.loading || executingRef.current !== null) {
                return;
            }

            if (action.confirmLabel && confirmingActionId !== action.id) {
                setConfirmingActionId(action.id);
                return;
            }

            if (onBeforeAction) {
                const shouldProceed = await onBeforeAction(action.id);
                if (!shouldProceed) {
                    setConfirmingActionId(null);
                    return;
                }
            }

            try {
                executingRef.current = action.id;
                setExecutingActionId(action.id);
                await onAction(action.id);
            } catch (error) {
                logger.error(
                    { error, actionId: action.id, actionLabel: action.label },
                    "Tool UI action failed"
                );
                throw error;
            } finally {
                executingRef.current = null;
                setExecutingActionId(null);
                setConfirmingActionId(null);
            }
        },
        [actions, confirmingActionId, executingActionId, onAction, onBeforeAction]
    );

    const resolvedActions = useMemo(
        () =>
            actions.map((action) => {
                const isConfirming = confirmingActionId === action.id;
                const isThisActionExecuting = executingActionId === action.id;
                const isLoading = action.loading || isThisActionExecuting;
                const isDisabled =
                    action.disabled ||
                    (executingActionId !== null && !isThisActionExecuting);
                const currentLabel =
                    isConfirming && action.confirmLabel
                        ? action.confirmLabel
                        : action.label;

                return {
                    ...action,
                    currentLabel,
                    isConfirming,
                    isExecuting: isThisActionExecuting,
                    isDisabled,
                    isLoading,
                };
            }),
        [actions, confirmingActionId, executingActionId]
    );

    return {
        actions: resolvedActions,
        runAction,
        confirmingActionId,
        executingActionId,
    };
}
