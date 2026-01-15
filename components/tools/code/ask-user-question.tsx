"use client";

/**
 * AskUserQuestion Widget for Code Mode
 *
 * Handles Claude Code's AskUserQuestion tool which allows the agent
 * to ask structured questions with multiple-choice options.
 *
 * Key differences from chat mode's askUserInput:
 * - Supports multiple questions in one call
 * - Each question has a header tag and multiSelect option
 * - Options have label + description (label is the value)
 */

import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { PaperPlaneTiltIcon, ChatCircleIcon, CheckIcon } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import { useIsMobile } from "@/lib/hooks/use-mobile";
import type { ToolStatus } from "@/lib/tools/tool-config";
import { useChatContext } from "@/components/connection/connect-runtime-provider";
import { Button } from "@/components/ui/button";
import { logger } from "@/lib/client-logger";

interface QuestionOption {
    label: string;
    description?: string;
}

interface QuestionItem {
    question: string;
    header: string;
    options: QuestionOption[];
    multiSelect?: boolean;
}

interface AskUserQuestionInput {
    questions?: QuestionItem[];
}

interface AskUserQuestionProps {
    toolCallId: string;
    status: ToolStatus;
    input?: AskUserQuestionInput;
    error?: string;
}

/**
 * Single question component with option buttons
 */
function QuestionBlock({
    question,
    questionIndex,
    selectedOptions,
    onToggleOption,
    onSubmit,
    isSubmitted,
}: {
    question: QuestionItem;
    questionIndex: number;
    selectedOptions: Set<string>;
    onToggleOption: (label: string) => void;
    onSubmit: () => void;
    isSubmitted: boolean;
}) {
    const hasSelection = selectedOptions.size > 0;

    return (
        <div className="space-y-3">
            {/* Header badge */}
            <div className="flex items-center gap-2">
                <span
                    className={cn(
                        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5",
                        "bg-purple-500/20 text-xs font-medium text-purple-300"
                    )}
                >
                    {question.header}
                </span>
            </div>

            {/* Question text */}
            <p className="text-foreground/90 text-sm font-medium">
                {question.question}
            </p>

            {/* Options */}
            <div className="flex flex-wrap gap-2">
                {question.options.map((option, idx) => {
                    const isSelected = selectedOptions.has(option.label);
                    return (
                        <motion.button
                            key={`${questionIndex}-${idx}`}
                            type="button"
                            onClick={() => onToggleOption(option.label)}
                            disabled={isSubmitted}
                            className={cn(
                                "relative rounded-lg px-4 py-2 text-left transition-all duration-200",
                                "border",
                                isSelected
                                    ? "border-purple-400/50 bg-purple-500/20"
                                    : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10",
                                isSubmitted && "cursor-not-allowed opacity-60"
                            )}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: idx * 0.03 }}
                            whileHover={!isSubmitted ? { scale: 1.01 } : undefined}
                            whileTap={!isSubmitted ? { scale: 0.99 } : undefined}
                        >
                            {/* Selection indicator for multiSelect */}
                            {question.multiSelect && (
                                <span
                                    className={cn(
                                        "absolute top-2 right-2 flex h-4 w-4 items-center justify-center rounded",
                                        "border transition-colors",
                                        isSelected
                                            ? "border-purple-400 bg-purple-500"
                                            : "border-white/20"
                                    )}
                                >
                                    {isSelected && (
                                        <CheckIcon className="h-3 w-3 text-white" />
                                    )}
                                </span>
                            )}

                            <div
                                className={cn(
                                    "text-sm font-medium",
                                    isSelected
                                        ? "text-purple-200"
                                        : "text-foreground/90"
                                )}
                            >
                                {option.label}
                            </div>
                            {option.description && (
                                <div className="text-muted-foreground mt-0.5 text-xs">
                                    {option.description}
                                </div>
                            )}
                        </motion.button>
                    );
                })}
            </div>

            {/* Submit for multiSelect or show Other input */}
            {question.multiSelect && hasSelection && !isSubmitted && (
                <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    <Button
                        onClick={onSubmit}
                        size="sm"
                        className="bg-purple-600 hover:bg-purple-500"
                    >
                        <PaperPlaneTiltIcon className="mr-1.5 h-3.5 w-3.5" />
                        Confirm selection
                    </Button>
                </motion.div>
            )}
        </div>
    );
}

/**
 * Free-form "Other" input for when predefined options don't fit
 */
function OtherInput({
    onSubmit,
    isSubmitted,
}: {
    onSubmit: (text: string) => void;
    isSubmitted: boolean;
}) {
    const [text, setText] = useState("");
    const isMobile = useIsMobile();

    const handleSubmit = () => {
        if (text.trim()) {
            onSubmit(text.trim());
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        // On mobile, Enter should insert newline (native behavior), not submit
        if (isMobile === true) return;

        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    if (isSubmitted) return null;

    return (
        <div className="mt-4 border-t border-white/10 pt-4">
            <p className="text-muted-foreground mb-2 text-xs">
                Or provide a different response:
            </p>
            <div className="flex gap-2">
                <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type your response..."
                    className={cn(
                        "min-h-[60px] flex-1 resize-none rounded-lg p-3",
                        "border border-white/10 bg-white/5",
                        "placeholder:text-muted-foreground text-sm",
                        "focus:border-purple-400/50 focus:ring-1 focus:ring-purple-400/30 focus:outline-none"
                    )}
                    rows={2}
                />
                <Button
                    onClick={handleSubmit}
                    disabled={!text.trim()}
                    size="icon"
                    className="h-[60px] w-[60px] bg-purple-600 hover:bg-purple-500"
                >
                    <PaperPlaneTiltIcon className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}

/**
 * Main AskUserQuestion widget
 */
export function AskUserQuestion({
    toolCallId,
    status,
    input,
    error,
}: AskUserQuestionProps) {
    const { append } = useChatContext();

    // Track selections per question (for multiSelect)
    // Track which questions have been answered (per-question, not global)
    const [selections, setSelections] = useState<Map<number, Set<string>>>(new Map());
    const [answeredQuestions, setAnsweredQuestions] = useState<Set<number>>(new Set());

    const handleToggleOption = useCallback(
        (questionIndex: number, label: string, multiSelect: boolean) => {
            if (answeredQuestions.has(questionIndex)) return;

            if (multiSelect) {
                // Toggle selection
                setSelections((prev) => {
                    const updated = new Map(prev);
                    const questionSelections = new Set(
                        updated.get(questionIndex) || []
                    );

                    if (questionSelections.has(label)) {
                        questionSelections.delete(label);
                    } else {
                        questionSelections.add(label);
                    }

                    updated.set(questionIndex, questionSelections);
                    return updated;
                });
            } else {
                // Single select - submit immediately
                logger.info(
                    { toolCallId, label, questionIndex },
                    "Single-select option clicked"
                );
                setAnsweredQuestions((prev) => new Set(prev).add(questionIndex));
                append({
                    role: "user",
                    content: label,
                });
            }
        },
        [answeredQuestions, append, toolCallId]
    );

    const handleMultiSelectSubmit = useCallback(
        (questionIndex: number) => {
            const questionSelections = selections.get(questionIndex);
            if (!questionSelections || questionSelections.size === 0) return;

            const selected = Array.from(questionSelections);
            logger.info(
                { toolCallId, selected, questionIndex },
                "Multi-select submitted"
            );
            setAnsweredQuestions((prev) => new Set(prev).add(questionIndex));
            append({
                role: "user",
                content: selected.join(", "),
            });
        },
        [selections, append, toolCallId]
    );

    const handleOtherSubmit = useCallback(
        (text: string) => {
            logger.info(
                { toolCallId, responseLength: text.length },
                "Other response submitted"
            );
            // "Other" answers all questions at once
            setAnsweredQuestions(new Set(input?.questions?.map((_, idx) => idx) || []));
            append({
                role: "user",
                content: text,
            });
        },
        [append, input?.questions, toolCallId]
    );

    // Show loading state while running
    if (status === "running") {
        return (
            <div className="my-2 flex items-center gap-2 rounded-lg border border-purple-500/20 bg-purple-500/5 px-3 py-2">
                <ChatCircleIcon className="h-4 w-4 animate-pulse text-purple-400" />
                <span className="text-muted-foreground text-sm">
                    Preparing question...
                </span>
            </div>
        );
    }

    // Error state - check before checking questions (error might occur without questions)
    if (error) {
        return (
            <div className="my-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2">
                <p className="text-sm text-red-400">{error}</p>
            </div>
        );
    }

    // If completed but no questions, nothing to render
    if (status !== "completed" || !input?.questions?.length) {
        return null;
    }

    return (
        <motion.div
            className={cn(
                "my-3 overflow-hidden rounded-lg",
                "border border-purple-500/20 bg-purple-500/5"
            )}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
        >
            {/* Header bar */}
            <div className="flex items-center gap-2 border-b border-purple-500/10 bg-purple-500/10 px-3 py-2">
                <ChatCircleIcon className="h-4 w-4 text-purple-400" />
                <span className="text-sm font-medium text-purple-200">Question</span>
                {answeredQuestions.size > 0 && (
                    <span className="ml-auto flex items-center gap-1 text-xs text-green-400">
                        <CheckIcon className="h-3 w-3" />
                        {answeredQuestions.size} of {input.questions.length} answered
                    </span>
                )}
            </div>

            {/* Questions */}
            <div className="space-y-4 p-4">
                {input.questions.map((question, idx) => (
                    <QuestionBlock
                        key={idx}
                        question={question}
                        questionIndex={idx}
                        selectedOptions={selections.get(idx) || new Set()}
                        onToggleOption={(label) =>
                            handleToggleOption(
                                idx,
                                label,
                                question.multiSelect ?? false
                            )
                        }
                        onSubmit={() => handleMultiSelectSubmit(idx)}
                        isSubmitted={answeredQuestions.has(idx)}
                    />
                ))}

                {/* Other option */}
                <OtherInput
                    onSubmit={handleOtherSubmit}
                    isSubmitted={answeredQuestions.size === input.questions.length}
                />
            </div>
        </motion.div>
    );
}
