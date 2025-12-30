"use client";

import { Plan } from "@/components/tool-ui/plan";
import type { PlanTodo } from "@/components/tool-ui/plan/schema";
import type { ToolStatus } from "@/lib/tools/tool-config";
import { ToolRenderer } from "../shared";

interface PlanInput {
    title?: string;
    description?: string;
}

interface PlanOutput {
    title?: string;
    description?: string;
    todos?: Array<{
        id: string;
        label?: string;
        content?: string;
        status: "pending" | "in_progress" | "completed" | "cancelled";
        description?: string;
        activeForm?: string;
    }>;
}

interface PlanResultProps {
    toolCallId: string;
    status: ToolStatus;
    toolName: string;
    input?: PlanInput;
    output?: PlanOutput;
    error?: string;
}

/**
 * Plan result component for showing task progress and workflow steps.
 *
 * Maps TodoWrite-style data to a visual progress display with
 * support for both 'label' (Plan schema) and 'content' (TodoWrite schema).
 */
export function PlanResult({
    toolCallId,
    status,
    toolName,
    input,
    output,
    error,
}: PlanResultProps) {
    // Transform todos to match Plan component schema
    // Support both 'label' (Plan schema) and 'content' (TodoWrite schema)
    const todos: PlanTodo[] = (output?.todos ?? []).map((todo, idx) => ({
        id: todo.id || `todo-${idx}`,
        label: todo.label || todo.content || todo.activeForm || "Task",
        status: todo.status,
        description: todo.description,
    }));

    const hasPlan = status === "completed" && todos.length > 0;

    return (
        <ToolRenderer
            toolName={toolName}
            toolCallId={toolCallId}
            status={status}
            input={input as Record<string, unknown>}
            output={output as Record<string, unknown>}
            error={error}
        >
            {hasPlan && (
                <Plan
                    id={`plan-${toolCallId}`}
                    title={output?.title ?? "Task Plan"}
                    description={output?.description}
                    todos={todos}
                    showProgress={true}
                    maxVisibleTodos={6}
                />
            )}
        </ToolRenderer>
    );
}
