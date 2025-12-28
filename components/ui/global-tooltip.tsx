"use client";

import { Tooltip } from "react-tooltip";

/**
 * Global tooltip provider using react-tooltip.
 *
 * Usage anywhere in the app:
 *   <button data-tooltip-id="tip" data-tooltip-content="Your message">
 *
 * For richer content, use data-tooltip-html for HTML strings.
 * Positioning handles viewport edges automatically via flip/shift.
 */
export function GlobalTooltip() {
    return (
        <Tooltip
            id="tip"
            place="top"
            delayShow={400}
            delayHide={100}
            className="!z-tooltip !max-w-xs !rounded-lg !border !border-border/50 !bg-popover !px-3 !py-2 !text-sm !text-popover-foreground !shadow-lg !backdrop-blur-md"
            classNameArrow="!border-border/50"
            opacity={1}
        />
    );
}
