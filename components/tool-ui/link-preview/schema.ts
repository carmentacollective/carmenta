import { z } from "zod";
import {
    ToolUIIdSchema,
    ToolUIReceiptSchema,
    ToolUIRoleSchema,
    parseWithSchema,
} from "../shared";
import { AspectRatioSchema, MediaFitSchema } from "../shared/media";

export const SerializableLinkPreviewSchema = z.object({
    id: ToolUIIdSchema,
    role: ToolUIRoleSchema.optional(),
    receipt: ToolUIReceiptSchema.optional(),
    href: z.string().url(),
    title: z.string().optional(),
    description: z.string().optional(),
    image: z.string().url().optional(),
    domain: z.string().optional(),
    favicon: z.string().url().optional(),
    ratio: AspectRatioSchema.optional(),
    fit: MediaFitSchema.optional(),
    createdAt: z.string().datetime().optional(),
    locale: z.string().optional(),
});

export type SerializableLinkPreview = z.infer<typeof SerializableLinkPreviewSchema>;

export function parseSerializableLinkPreview(input: unknown): SerializableLinkPreview {
    return parseWithSchema(SerializableLinkPreviewSchema, input, "LinkPreview");
}
