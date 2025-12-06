"use client";

import { useState } from "react";
import { copyToClipboard } from "@/lib/copy-utils";

export function ColorSwatch({
    name,
    hex,
    hsl,
    usage,
}: {
    name: string;
    hex: string;
    hsl: string;
    usage: string;
}) {
    const [copied, setCopied] = useState<string | null>(null);

    const handleCopy = async (text: string) => {
        const success = await copyToClipboard(text);
        if (success) {
            setCopied(text);
            setTimeout(() => setCopied(null), 1500);
        }
    };

    return (
        <div className="glass-card space-y-3">
            <div
                className="h-24 rounded-lg border border-foreground/10"
                style={{ backgroundColor: hex }}
            />
            <div className="space-y-2">
                <h3 className="font-medium text-foreground/90">{name}</h3>
                <div className="space-y-1 text-sm">
                    <button
                        onClick={() => handleCopy(hex)}
                        className="block w-full text-left font-mono text-foreground/60 transition-colors hover:text-primary"
                        title="Click to copy"
                    >
                        {hex}
                        {copied === hex && (
                            <span className="ml-2 text-xs text-primary">✓ Copied</span>
                        )}
                    </button>
                    <button
                        onClick={() => handleCopy(hsl)}
                        className="block w-full text-left font-mono text-xs text-foreground/50 transition-colors hover:text-primary"
                        title="Click to copy"
                    >
                        {hsl}
                        {copied === hsl && (
                            <span className="ml-2 text-xs text-primary">✓ Copied</span>
                        )}
                    </button>
                </div>
                <p className="text-xs text-foreground/60">{usage}</p>
            </div>
        </div>
    );
}
