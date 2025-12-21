import { z } from "zod";
import type { ReactNode } from "react";
import type { ActionsProp } from "../shared";
import {
    ActionSchema,
    SerializableActionSchema,
    SerializableActionsConfigSchema,
    ToolUIIdSchema,
    ToolUIReceiptSchema,
    ToolUIRoleSchema,
    parseWithSchema,
} from "../shared";

export const OptionListOptionSchema = z.object({
    id: z.string().min(1),
    label: z.string().min(1),
    description: z.string().optional(),
    icon: z.custom<ReactNode>().optional(),
    disabled: z.boolean().optional(),
});

export const OptionListPropsSchema = z.object({
    id: ToolUIIdSchema,
    role: ToolUIRoleSchema.optional(),
    receipt: ToolUIReceiptSchema.optional(),
    options: z.array(OptionListOptionSchema).min(1),
    selectionMode: z.enum(["multi", "single"]).optional(),
    value: z.union([z.array(z.string()), z.string(), z.null()]).optional(),
    defaultValue: z.union([z.array(z.string()), z.string(), z.null()]).optional(),
    confirmed: z.union([z.array(z.string()), z.string(), z.null()]).optional(),
    responseActions: z
        .union([z.array(ActionSchema), SerializableActionsConfigSchema])
        .optional(),
    minSelections: z.number().min(0).optional(),
    maxSelections: z.number().min(1).optional(),
});

export type OptionListSelection = string[] | string | null;

export type OptionListOption = z.infer<typeof OptionListOptionSchema>;

export type OptionListProps = Omit<
    z.infer<typeof OptionListPropsSchema>,
    "value" | "defaultValue" | "confirmed"
> & {
    id: string;
    value?: OptionListSelection;
    defaultValue?: OptionListSelection;
    confirmed?: OptionListSelection;
    onChange?: (value: OptionListSelection) => void;
    onConfirm?: (value: OptionListSelection) => void | Promise<void>;
    onCancel?: () => void;
    responseActions?: ActionsProp;
    onResponseAction?: (actionId: string) => void | Promise<void>;
    onBeforeResponseAction?: (actionId: string) => boolean | Promise<boolean>;
    className?: string;
};

export const SerializableOptionListSchema = OptionListPropsSchema.omit({
    value: true,
}).extend({
    options: z.array(OptionListOptionSchema.omit({ icon: true })).min(1),
    responseActions: z
        .union([z.array(SerializableActionSchema), SerializableActionsConfigSchema])
        .optional(),
});

export type SerializableOptionList = z.infer<typeof SerializableOptionListSchema>;

export function parseSerializableOptionList(input: unknown): SerializableOptionList {
    return parseWithSchema(SerializableOptionListSchema, input, "OptionList");
}
