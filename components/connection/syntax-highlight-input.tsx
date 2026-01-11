"use client";

/**
 * Syntax-Highlighted Input Component
 *
 * Provides rich text input with:
 * - @mentions (integrations, AI team, tools) - purple
 * - #modifiers (concierge hints) - amber (rainbow for #ultrathink)
 * - /commands (actions) - cyan
 * - Easter egg highlights (love, magic, etc.)
 * - Autocomplete popover for each syntax type
 *
 * Uses rich-textarea (~3kB) for syntax highlighting overlay.
 */

import {
    useState,
    useCallback,
    useRef,
    useMemo,
    useEffect,
    forwardRef,
    useImperativeHandle,
} from "react";
import Image from "next/image";
import { RichTextarea, type RichTextareaProps } from "rich-textarea";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// Simple placeholder
const PLACEHOLDER = "Message Carmenta...";

// Mock data for autocomplete (will be replaced with real data from context)
const INTEGRATIONS = [
    { id: "notion", name: "Notion", icon: "📝" },
    { id: "slack", name: "Slack", icon: "💬" },
    { id: "gmail", name: "Gmail", icon: "📧" },
    { id: "github", name: "GitHub", icon: "🐙" },
    { id: "calendar", name: "Google Calendar", icon: "📅" },
    { id: "spotify", name: "Spotify", icon: "🎵" },
    { id: "limitless", name: "Limitless", icon: "🎧" },
    { id: "fireflies", name: "Fireflies", icon: "🔥" },
];

const AI_TEAM = [
    { id: "librarian", name: "Librarian", icon: "📚" },
    { id: "image-artist", name: "Image Artist", icon: "🎨" },
    { id: "researcher", name: "Researcher", icon: "🔬" },
    { id: "carmenta", name: "Carmenta", icon: "/logos/icon-transparent.png" },
];

const TOOLS = [
    { id: "web", name: "Web Search", icon: "🌐" },
    { id: "deep-research", name: "Deep Research", icon: "🔍" },
    { id: "code", name: "Code Execution", icon: "💻" },
    { id: "image", name: "Image Generation", icon: "🖼️" },
    { id: "compare", name: "Compare", icon: "⚖️" },
];

const MODIFIERS = [
    { id: "ultrathink", name: "Ultra Think", description: "Maximum reasoning depth" },
    { id: "quick", name: "Quick", description: "Fast response, less reasoning" },
    { id: "creative", name: "Creative", description: "High temperature, exploratory" },
    { id: "precise", name: "Precise", description: "Low temperature, exact" },
    { id: "opus", name: "Opus", description: "Force Claude Opus" },
    { id: "sonnet", name: "Sonnet", description: "Force Claude Sonnet" },
    { id: "haiku", name: "Haiku", description: "Force Claude Haiku" },
    { id: "grok", name: "Grok", description: "Force Grok" },
    { id: "gemini", name: "Gemini", description: "Force Gemini" },
];

const COMMANDS = [
    {
        id: "deep-research",
        name: "Deep Research",
        description: "Background research task",
    },
    { id: "compare", name: "Compare", description: "Generate comparison table" },
    { id: "summarize", name: "Summarize", description: "Condense content" },
    { id: "explain", name: "Explain", description: "Break down concept" },
];

// Easter eggs - ONLY rare/intentional phrases, not common words
// Avoid: we, us, our, together, create, build, ship, flow (too common, will annoy)
const EASTER_EGGS = {
    love: ["love you", "love carmenta"], // Intentional affection
    gratitude: ["thank you"], // Warmth when expressing thanks
    celebration: ["hell yeah", "nailed it"], // Rare enough to delight
} as const;

const ALL_EASTER_WORDS = Object.values(EASTER_EGGS).flat();
const EASTER_EGG_REGEX = new RegExp(`\\b(${ALL_EASTER_WORDS.join("|")})\\b`, "gi");

const getEasterCategory = (word: string): keyof typeof EASTER_EGGS | null => {
    const lower = word.toLowerCase();
    for (const [category, words] of Object.entries(EASTER_EGGS)) {
        if (words.some((w) => w === lower)) {
            return category as keyof typeof EASTER_EGGS;
        }
    }
    return null;
};

// Highlighting patterns
// - mention: Lookbehind ensures @ isn't part of email (e.g., test@notion.com)
// - command: [\w-]+ allows hyphenated commands like /deep-research
const PATTERNS = {
    mention: /(?<![^\s])@\w+/g,
    modifier: /#\w+/g,
    command: /\/[\w-]+/g,
    url: /https?:\/\/[^\s]+/g,
    easterEgg: EASTER_EGG_REGEX,
};

type AutocompleteType = "mention" | "modifier" | "command" | null;

interface AutocompleteItem {
    id: string;
    name: string;
    icon?: string;
    description?: string;
    category?: string;
}

export interface SyntaxHighlightInputHandle {
    focus: (options?: FocusOptions) => void;
    blur: () => void;
    setSelectionRange: (start: number, end: number) => void;
    get selectionStart(): number;
    get selectionEnd(): number;
    get value(): string;
    /** For auto-resize: access underlying element's scrollHeight */
    get scrollHeight(): number;
    /** For auto-resize: access underlying element's style */
    get style(): CSSStyleDeclaration | undefined;
}

export interface SyntaxHighlightInputProps extends Omit<
    RichTextareaProps,
    "children" | "onChange" | "onKeyDown"
> {
    value: string;
    onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
    onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
    onFocus?: () => void;
    onBlur?: () => void;
    onCompositionStart?: () => void;
    onCompositionEnd?: () => void;
    onPaste?: (e: React.ClipboardEvent) => void;
    className?: string;
    rotatePlaceholders?: boolean;
}

export const SyntaxHighlightInput = forwardRef<
    SyntaxHighlightInputHandle,
    SyntaxHighlightInputProps
>(
    (
        {
            value,
            onChange,
            onKeyDown,
            onFocus,
            onBlur,
            onCompositionStart,
            onCompositionEnd,
            onPaste,
            className,
            rotatePlaceholders = true,
            placeholder: externalPlaceholder,
            ...props
        },
        ref
    ) => {
        const textareaRef = useRef<HTMLTextAreaElement>(null);
        const [autocompleteType, setAutocompleteType] =
            useState<AutocompleteType>(null);
        const [autocompleteQuery, setAutocompleteQuery] = useState("");
        const [selectedIndex, setSelectedIndex] = useState(0);

        // Expose methods via ref
        useImperativeHandle(ref, () => ({
            focus: (options?: FocusOptions) => textareaRef.current?.focus(options),
            blur: () => textareaRef.current?.blur(),
            setSelectionRange: (start: number, end: number) =>
                textareaRef.current?.setSelectionRange(start, end),
            get selectionStart() {
                return textareaRef.current?.selectionStart ?? 0;
            },
            get selectionEnd() {
                return textareaRef.current?.selectionEnd ?? 0;
            },
            get value() {
                return textareaRef.current?.value ?? "";
            },
            get scrollHeight() {
                return textareaRef.current?.scrollHeight ?? 0;
            },
            get style() {
                return textareaRef.current?.style;
            },
        }));

        // Detect trigger characters and manage autocomplete state
        const handleChange = useCallback(
            (e: React.ChangeEvent<HTMLTextAreaElement>) => {
                const newText = e.target.value;
                onChange(e);

                // Get cursor position
                const cursorPos = textareaRef.current?.selectionStart ?? newText.length;
                const textBeforeCursor = newText.slice(0, cursorPos);

                // Find the last trigger character
                const lastAt = textBeforeCursor.lastIndexOf("@");
                const lastHash = textBeforeCursor.lastIndexOf("#");
                const lastSlash = textBeforeCursor.lastIndexOf("/");

                // Determine which trigger is active
                const triggers = [
                    { type: "mention" as const, pos: lastAt },
                    { type: "modifier" as const, pos: lastHash },
                    { type: "command" as const, pos: lastSlash },
                ].filter((t) => t.pos !== -1);

                if (triggers.length === 0) {
                    setAutocompleteType(null);
                    return;
                }

                const activeTrigger = triggers.reduce((a, b) =>
                    a.pos > b.pos ? a : b
                );
                const textAfterTrigger = textBeforeCursor.slice(activeTrigger.pos + 1);

                // Only show autocomplete if no space after trigger
                if (textAfterTrigger.includes(" ")) {
                    setAutocompleteType(null);
                    return;
                }

                setAutocompleteType(activeTrigger.type);
                setAutocompleteQuery(textAfterTrigger.toLowerCase());
                setSelectedIndex(0);
            },
            [onChange]
        );

        // Get autocomplete items based on type
        const autocompleteItems = useMemo((): AutocompleteItem[] => {
            if (!autocompleteType) return [];

            let items: AutocompleteItem[] = [];

            if (autocompleteType === "mention") {
                items = [
                    ...INTEGRATIONS.map((i) => ({
                        ...i,
                        category: "Your integrations",
                    })),
                    ...AI_TEAM.map((i) => ({ ...i, category: "Your AI team" })),
                    ...TOOLS.map((i) => ({ ...i, category: "Your tools" })),
                ];
            } else if (autocompleteType === "modifier") {
                items = MODIFIERS.map((m) => ({ ...m, category: "Behavior" }));
            } else if (autocompleteType === "command") {
                items = COMMANDS.map((c) => ({ ...c, category: "Actions" }));
            }

            // Filter by query
            if (autocompleteQuery) {
                items = items.filter(
                    (item) =>
                        item.name.toLowerCase().includes(autocompleteQuery) ||
                        item.id.toLowerCase().includes(autocompleteQuery)
                );
            }

            return items.slice(0, 8);
        }, [autocompleteType, autocompleteQuery]);

        // Handle autocomplete selection
        const selectItem = useCallback(
            (item: AutocompleteItem) => {
                const cursorPos = textareaRef.current?.selectionStart ?? value.length;
                const textBeforeCursor = value.slice(0, cursorPos);

                // Find the trigger position
                let triggerPos = -1;
                if (autocompleteType === "mention")
                    triggerPos = textBeforeCursor.lastIndexOf("@");
                if (autocompleteType === "modifier")
                    triggerPos = textBeforeCursor.lastIndexOf("#");
                if (autocompleteType === "command")
                    triggerPos = textBeforeCursor.lastIndexOf("/");

                if (triggerPos === -1) return;

                const prefix =
                    autocompleteType === "mention"
                        ? "@"
                        : autocompleteType === "modifier"
                          ? "#"
                          : "/";
                const newText =
                    value.slice(0, triggerPos) +
                    prefix +
                    item.id +
                    " " +
                    value.slice(cursorPos);

                // Create synthetic event for onChange
                const syntheticEvent = {
                    target: { value: newText },
                } as React.ChangeEvent<HTMLTextAreaElement>;
                onChange(syntheticEvent);

                setAutocompleteType(null);

                // Focus and set cursor position
                setTimeout(() => {
                    textareaRef.current?.focus();
                    const newCursorPos =
                        triggerPos + prefix.length + item.id.length + 1;
                    textareaRef.current?.setSelectionRange(newCursorPos, newCursorPos);
                }, 0);
            },
            [value, autocompleteType, onChange]
        );

        // Keyboard navigation for autocomplete
        const handleKeyDown = useCallback(
            (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
                // Handle autocomplete navigation first
                if (autocompleteType && autocompleteItems.length > 0) {
                    if (e.key === "ArrowDown") {
                        e.preventDefault();
                        setSelectedIndex((i) => (i + 1) % autocompleteItems.length);
                        return;
                    } else if (e.key === "ArrowUp") {
                        e.preventDefault();
                        setSelectedIndex(
                            (i) =>
                                (i - 1 + autocompleteItems.length) %
                                autocompleteItems.length
                        );
                        return;
                    } else if (e.key === "Tab") {
                        e.preventDefault();
                        selectItem(autocompleteItems[selectedIndex]);
                        return;
                    } else if (e.key === "Enter" && !e.shiftKey) {
                        // Only intercept Enter if autocomplete is open and user is selecting
                        e.preventDefault();
                        selectItem(autocompleteItems[selectedIndex]);
                        return;
                    } else if (e.key === "Escape") {
                        e.preventDefault();
                        setAutocompleteType(null);
                        return;
                    }
                }

                // Pass through to parent handler
                onKeyDown?.(e);
            },
            [autocompleteType, autocompleteItems, selectedIndex, selectItem, onKeyDown]
        );

        // Syntax highlighting renderer
        const renderHighlightedText = useCallback((text: string) => {
            const tokens: { text: string; type: string; start: number; end: number }[] =
                [];

            // Check if a token is valid (recognized in our lists)
            const isValidToken = (tokenText: string, tokenType: string): boolean => {
                if (tokenType === "mention") {
                    const id = tokenText.slice(1).toLowerCase();
                    return (
                        INTEGRATIONS.some((i) => i.id === id) ||
                        AI_TEAM.some((i) => i.id === id) ||
                        TOOLS.some((i) => i.id === id)
                    );
                } else if (tokenType === "modifier") {
                    const id = tokenText.slice(1).toLowerCase();
                    return MODIFIERS.some((m) => m.id === id);
                } else if (tokenType === "command") {
                    const id = tokenText.slice(1).toLowerCase();
                    return COMMANDS.some((c) => c.id === id);
                }
                // URL and easter eggs don't need validation
                return true;
            };

            const addMatches = (regex: RegExp, type: string) => {
                let match;
                const re = new RegExp(
                    regex.source,
                    regex.flags.includes("g") ? regex.flags : regex.flags + "g"
                );
                while ((match = re.exec(text)) !== null) {
                    // Only add token if it's valid (or doesn't need validation)
                    if (isValidToken(match[0], type)) {
                        tokens.push({
                            text: match[0],
                            type,
                            start: match.index,
                            end: match.index + match[0].length,
                        });
                    }
                }
            };

            addMatches(PATTERNS.mention, "mention");
            addMatches(PATTERNS.modifier, "modifier");
            addMatches(PATTERNS.command, "command");
            addMatches(PATTERNS.url, "url");
            addMatches(PATTERNS.easterEgg, "easter");

            tokens.sort((a, b) => a.start - b.start);

            const result: React.ReactNode[] = [];
            let currentPos = 0;

            tokens.forEach((token, i) => {
                if (token.start < currentPos) return;

                if (token.start > currentPos) {
                    result.push(text.slice(currentPos, token.start));
                }

                let tokenClassName: string;

                if (token.type === "easter") {
                    const category = getEasterCategory(token.text);
                    tokenClassName =
                        {
                            love: "text-pink-500 font-semibold",
                            gratitude: "text-amber-500 font-semibold",
                            celebration: "text-emerald-500 font-semibold",
                        }[category ?? "love"] ?? "text-pink-500 font-semibold";
                } else if (token.text.toLowerCase() === "#ultrathink") {
                    // Rainbow treatment for #ultrathink
                    tokenClassName =
                        "font-medium bg-gradient-to-r from-violet-500 via-pink-500 to-amber-500 bg-clip-text text-transparent";
                } else {
                    tokenClassName =
                        {
                            mention:
                                "text-purple-500 font-medium bg-purple-500/10 rounded px-0.5",
                            modifier:
                                "text-amber-500 font-medium bg-amber-500/10 rounded px-0.5",
                            command:
                                "text-cyan-500 font-medium bg-cyan-500/10 rounded px-0.5",
                            url: "text-blue-500 underline",
                        }[token.type] ?? "";
                }

                result.push(
                    <span key={i} className={tokenClassName}>
                        {token.text}
                    </span>
                );

                currentPos = token.end;
            });

            if (currentPos < text.length) {
                result.push(text.slice(currentPos));
            }

            return result.length > 0 ? result : text;
        }, []);

        const isAutocompleteOpen = !!autocompleteType && autocompleteItems.length > 0;
        const placeholder = externalPlaceholder || PLACEHOLDER;

        return (
            <Popover
                open={isAutocompleteOpen}
                onOpenChange={() => setAutocompleteType(null)}
            >
                <PopoverTrigger asChild>
                    <div className="relative w-full">
                        <RichTextarea
                            ref={textareaRef}
                            value={value}
                            onChange={handleChange}
                            onKeyDown={handleKeyDown}
                            onFocus={onFocus}
                            onBlur={onBlur}
                            onCompositionStart={onCompositionStart}
                            onCompositionEnd={onCompositionEnd}
                            onPaste={onPaste}
                            placeholder={placeholder}
                            className={className}
                            // RichTextarea requires explicit width and line-height via style prop
                            // CSS classes alone don't apply to the inner textarea
                            style={{
                                width: "100%",
                                lineHeight: "1.25rem", // Match leading-5 from className
                                ...props.style,
                            }}
                            {...props}
                        >
                            {renderHighlightedText}
                        </RichTextarea>
                    </div>
                </PopoverTrigger>
                <PopoverContent
                    className="z-modal w-80 p-2"
                    side="top"
                    align="start"
                    sideOffset={8}
                    onOpenAutoFocus={(e) => e.preventDefault()}
                >
                    <div className="text-muted-foreground mb-2 px-2 text-xs font-medium uppercase">
                        {autocompleteType === "mention" && "Mentions"}
                        {autocompleteType === "modifier" && "Modifiers"}
                        {autocompleteType === "command" && "Commands"}
                    </div>
                    {autocompleteItems.map((item, i) => (
                        <button
                            key={item.id}
                            onClick={() => selectItem(item)}
                            type="button"
                            className={cn(
                                "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors",
                                i === selectedIndex
                                    ? "bg-accent text-accent-foreground"
                                    : "hover:bg-accent/50"
                            )}
                        >
                            {item.icon &&
                                (item.icon.startsWith("/") ? (
                                    <Image
                                        src={item.icon}
                                        alt={item.name}
                                        width={20}
                                        height={20}
                                        className="rounded-sm"
                                    />
                                ) : (
                                    <span className="text-lg">{item.icon}</span>
                                ))}
                            <div className="flex-1">
                                <div className="font-medium">{item.name}</div>
                                {item.description && (
                                    <div className="text-muted-foreground text-xs">
                                        {item.description}
                                    </div>
                                )}
                            </div>
                            <span className="text-muted-foreground text-xs">
                                {item.category}
                            </span>
                        </button>
                    ))}
                </PopoverContent>
            </Popover>
        );
    }
);

SyntaxHighlightInput.displayName = "SyntaxHighlightInput";
