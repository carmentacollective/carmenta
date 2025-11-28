"use client";

import { Check, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ApprovalCardProps {
    title: string;
    description: string;
    details?: Record<string, string>;
    onApprove: () => void;
    onReject: () => void;
    isProcessing?: boolean;
    className?: string;
}

export function ApprovalCard({
    title,
    description,
    details,
    onApprove,
    onReject,
    isProcessing = false,
    className,
}: ApprovalCardProps) {
    return (
        <div className={cn("blueprint-box p-4", className)}>
            <div className="mb-4">
                <h3 className="text-lg font-bold text-foreground">{title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            </div>

            {details && Object.keys(details).length > 0 && (
                <div className="mb-4 space-y-2 border-y border-border py-3">
                    {Object.entries(details).map(([key, value]) => (
                        <div key={key} className="flex justify-between text-sm">
                            <span className="text-muted-foreground">{key}</span>
                            <span className="font-medium text-foreground">{value}</span>
                        </div>
                    ))}
                </div>
            )}

            <div className="flex gap-3">
                <Button
                    onClick={onApprove}
                    disabled={isProcessing}
                    className="flex-1"
                    variant="default"
                >
                    <Check className="mr-2 h-4 w-4" />
                    Approve
                </Button>
                <Button
                    onClick={onReject}
                    disabled={isProcessing}
                    className="flex-1"
                    variant="outline"
                >
                    <X className="mr-2 h-4 w-4" />
                    Reject
                </Button>
            </div>
        </div>
    );
}
