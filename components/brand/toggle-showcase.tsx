"use client";

import { useState } from "react";
import { LabelToggle } from "@/components/ui/label-toggle";

interface ToggleShowcaseProps {
    size: "sm" | "md";
}

export function ToggleShowcase({ size }: ToggleShowcaseProps) {
    const [checked, setChecked] = useState(false);

    return (
        <div className="bg-foreground/5 flex min-h-[80px] items-center justify-center rounded-lg p-4">
            <div className="flex flex-col items-center gap-3">
                <LabelToggle checked={checked} onChange={setChecked} size={size} />
                <span className="text-foreground/50 text-xs">
                    {checked ? "Active" : "Inactive"}
                </span>
            </div>
        </div>
    );
}
