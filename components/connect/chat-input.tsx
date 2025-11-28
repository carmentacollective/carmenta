"use client";

import { SendHorizontal } from "lucide-react";
import type { FormEvent, KeyboardEvent } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ChatInputProps {
    input: string;
    isLoading: boolean;
    onInputChange: (value: string) => void;
    onSubmit: (e: FormEvent<HTMLFormElement>) => void;
}

export function ChatInput({
    input,
    isLoading,
    onInputChange,
    onSubmit,
}: ChatInputProps) {
    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (input.trim() && !isLoading) {
                const form = e.currentTarget.form;
                if (form) {
                    form.requestSubmit();
                }
            }
        }
    };

    return (
        <form onSubmit={onSubmit} className="flex gap-3">
            <div className="relative flex-1">
                <textarea
                    value={input}
                    onChange={(e) => onInputChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="What's on your mind?"
                    disabled={isLoading}
                    rows={1}
                    className={cn(
                        "w-full resize-none bg-muted/30 px-4 py-3",
                        "border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary",
                        "placeholder:text-muted-foreground",
                        "disabled:cursor-not-allowed disabled:opacity-50",
                        "max-h-[200px] min-h-[48px]"
                    )}
                    style={{
                        height: "auto",
                        minHeight: "48px",
                    }}
                    onInput={(e) => {
                        const target = e.target as HTMLTextAreaElement;
                        target.style.height = "auto";
                        target.style.height = `${Math.min(target.scrollHeight, 200)}px`;
                    }}
                />
            </div>
            <Button
                type="submit"
                disabled={!input.trim() || isLoading}
                size="icon"
                className="h-12 w-12 shrink-0"
            >
                <SendHorizontal className="h-5 w-5" />
                <span className="sr-only">Send message</span>
            </Button>
        </form>
    );
}
