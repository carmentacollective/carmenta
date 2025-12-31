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
                className="border-foreground/10 h-24 rounded-lg border"
                style={{ backgroundColor: hex }}
            />
            <div className="space-y-2">
                <h3 className="text-foreground/90 font-medium">{name}</h3>
                <div className="space-y-1 text-sm">
                    <button
                        onClick={() => handleCopy(hex)}
                        className="text-foreground/60 hover:text-primary block w-full text-left font-mono transition-colors"
                        data-tooltip-id="tip"
                        data-tooltip-content="Copy hex"
                    >
                        {hex}
                        {copied === hex && (
                            <span className="text-primary ml-2 text-xs">✓ Copied</span>
                        )}
                    </button>
                    <button
                        onClick={() => handleCopy(hsl)}
                        className="text-foreground/50 hover:text-primary block w-full text-left font-mono text-xs transition-colors"
                        data-tooltip-id="tip"
                        data-tooltip-content="Copy HSL"
                    >
                        {hsl}
                        {copied === hsl && (
                            <span className="text-primary ml-2 text-xs">✓ Copied</span>
                        )}
                    </button>
                </div>
                <p className="text-foreground/60 text-xs">{usage}</p>
            </div>
        </div>
    );
}
