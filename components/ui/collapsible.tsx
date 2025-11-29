"use client";

import * as CollapsiblePrimitive from "@radix-ui/react-collapsible";

/**
 * Radix Collapsible primitives re-exported for consistent usage.
 * Used by ReasoningDisplay and ToolWrapper for expandable sections.
 */
const Collapsible = CollapsiblePrimitive.Root;
const CollapsibleTrigger = CollapsiblePrimitive.Trigger;
const CollapsibleContent = CollapsiblePrimitive.Content;

export { Collapsible, CollapsibleTrigger, CollapsibleContent };
