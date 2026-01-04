"use client";

/**
 * Icon Design Lab
 *
 * A thoughtful exploration of Phosphor icon options for Carmenta's key UI elements.
 * Each category shows multiple options with different weights to find what best
 * expresses the action's intent and emotional tone.
 *
 * Philosophy: Icons should feel alive, support flow state, and add warmth.
 * The best icon is one that disappears into understanding.
 */

import { useState } from "react";
import {
    // New Connection options
    Plus,
    PlusCircle,
    ChatCircle,
    Sparkle,
    Lightning,
    MagicWand,
    Chats,

    // Save options
    FloppyDisk,
    CloudArrowUp,
    Check,
    CheckCircle,
    DownloadSimple,

    // User avatar options
    UserCircle,
    User,
    UserFocus,
    Person,
    Smiley,

    // Heart options
    Heart,
    HeartStraight,
    Heartbeat,

    // Home options
    House,
    HouseSimple,
    Buildings,
    Storefront,

    // Settings/Integrations options
    Gear,
    GearSix,
    Sliders,
    SlidersHorizontal,
    Plug,
    PlugsConnected,
    Wrench,

    // Send message options
    PaperPlaneTilt,
    PaperPlane,
    ArrowRight,
    ArrowCircleRight,
    NavigationArrow,

    // Microphone options
    Microphone,
    Waveform,
    SpeakerHigh,
    Record,

    // Copy options
    Copy,
    CopySimple,
    Clipboard,
    ClipboardText,

    // External link options
    ArrowSquareOut,
    ArrowUpRight,
    Link,
    LinkSimple,

    // Menu/Navigation options
    List,
    DotsThree,
    DotsThreeVertical,
    CaretDown,
    CaretRight,

    // File/Document options
    File,
    FileText,
    Files,
    FolderOpen,
    Folder,

    // Search options
    MagnifyingGlass,
    Binoculars,

    // Close/Dismiss options
    X,
    XCircle,

    // Warning/Error options
    Warning,
    WarningCircle,
    Info,

    // Refresh/Retry options
    ArrowsClockwise,
    ArrowClockwise,
    ArrowCounterClockwise,
    CircleNotch,

    // Star/Favorite options
    Star,
    Bookmark,
    BookmarkSimple,

    // Trash/Delete options
    Trash,
    TrashSimple,

    // Edit options
    PencilSimple,
    Pencil,
    NotePencil,

    // Calendar options
    Calendar,
    CalendarBlank,
    Clock,

    // Communication options
    ChatTeardrop,
    ChatText,
    Chat,
    Envelope,
    EnvelopeSimple,

    // Code options
    Code,
    Terminal,
    BracketsCurly,
    CodeBlock,

    // Brain/AI options
    Brain,
    Robot,
    Atom,
    Cpu,

    // Compass/Guide options
    Compass,
    Signpost,
    Path,
    MapTrifold,

    // Lock/Security options
    Lock,
    LockSimple,
    Shield,
    ShieldCheck,

    // Play/Media options
    Play,
    Pause,
    Stop,

    // Expand/Collapse options
    ArrowsOut,
    ArrowsIn,
    CaretDoubleDown,
    CaretDoubleUp,

    // GitHub option
    GithubLogo,
} from "@phosphor-icons/react";
import type { IconWeight } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";

const weights: IconWeight[] = ["thin", "light", "regular", "bold", "fill", "duotone"];

interface IconOption {
    name: string;
    icon: React.ComponentType<{ weight?: IconWeight; className?: string }>;
    note?: string;
}

interface IconCategory {
    title: string;
    description: string;
    semanticQuestion: string;
    options: IconOption[];
    recommendation?: string;
}

const categories: IconCategory[] = [
    {
        title: "New Connection",
        description: "Starting a new conversation with Carmenta",
        semanticQuestion: "Is this about creation (+), conversation (chat), or magic?",
        options: [
            { name: "Plus", icon: Plus, note: "Universal 'new' action" },
            { name: "PlusCircle", icon: PlusCircle, note: "Softer, contained" },
            {
                name: "ChatCircle",
                icon: ChatCircle,
                note: "Emphasizes conversation",
            },
            {
                name: "Sparkle",
                icon: Sparkle,
                note: "Magic/AI feel, but might be overused",
            },
            {
                name: "Lightning",
                icon: Lightning,
                note: "Energy, speed",
            },
            {
                name: "MagicWand",
                icon: MagicWand,
                note: "Explicit magic metaphor",
            },
            { name: "Chats", icon: Chats, note: "Multiple conversations" },
        ],
        recommendation:
            "Plus is clear and universal. ChatCircle with duotone could add warmth while conveying 'conversation'.",
    },
    {
        title: "User Avatar / Profile",
        description: "Representing the user in the header",
        semanticQuestion: "Should it feel personal (face) or abstract (circle)?",
        options: [
            {
                name: "UserCircle",
                icon: UserCircle,
                note: "Classic, works with duotone",
            },
            { name: "User", icon: User, note: "Simpler, no container" },
            { name: "UserFocus", icon: UserFocus, note: "More dynamic" },
            { name: "Person", icon: Person, note: "Full body silhouette" },
            { name: "Smiley", icon: Smiley, note: "Friendly, playful" },
        ],
        recommendation:
            "UserCircle with duotone - the inner fill adds life without being cartoonish.",
    },
    {
        title: "Heart / Philosophy",
        description: "Heart-centered AI link",
        semanticQuestion: "Fill conveys love. Duotone adds dimension.",
        options: [
            { name: "Heart", icon: Heart, note: "Classic heart shape" },
            {
                name: "HeartStraight",
                icon: HeartStraight,
                note: "More geometric",
            },
            {
                name: "Heartbeat",
                icon: Heartbeat,
                note: "Living, dynamic",
            },
        ],
        recommendation:
            "Heart with fill weight - it should be unmistakably about love.",
    },
    {
        title: "Home",
        description: "Navigation to home/landing",
        semanticQuestion: "House is literal. Could be more abstract?",
        options: [
            { name: "House", icon: House, note: "Classic home" },
            { name: "HouseSimple", icon: HouseSimple, note: "Cleaner lines" },
            {
                name: "Buildings",
                icon: Buildings,
                note: "More urban/professional",
            },
            { name: "Storefront", icon: Storefront, note: "Inviting entry" },
        ],
        recommendation: "House with regular weight - familiar and clear.",
    },
    {
        title: "Send Message",
        description: "Submit button in composer",
        semanticQuestion: "Direction matters. Tilt adds dynamism.",
        options: [
            {
                name: "PaperPlaneTilt",
                icon: PaperPlaneTilt,
                note: "Dynamic, taking flight",
            },
            { name: "PaperPlane", icon: PaperPlane, note: "More static" },
            { name: "ArrowRight", icon: ArrowRight, note: "Pure direction" },
            {
                name: "ArrowCircleRight",
                icon: ArrowCircleRight,
                note: "Contained arrow",
            },
            {
                name: "NavigationArrow",
                icon: NavigationArrow,
                note: "GPS/direction feel",
            },
        ],
        recommendation:
            "PaperPlaneTilt - conveys the message taking flight, feels alive.",
    },
    {
        title: "Voice Input",
        description: "Microphone button for voice mode",
        semanticQuestion: "Recording vs. speaking vs. audio?",
        options: [
            { name: "Microphone", icon: Microphone, note: "Universal voice" },
            {
                name: "Waveform",
                icon: Waveform,
                note: "Audio/sound visualization",
            },
            { name: "Record", icon: Record, note: "Recording action" },
        ],
        recommendation:
            "Microphone - universally understood. Could animate to Waveform when active.",
    },
    {
        title: "Copy to Clipboard",
        description: "Copy button on code blocks, messages",
        semanticQuestion: "Clipboard metaphor vs. document duplication?",
        options: [
            { name: "Copy", icon: Copy, note: "Two overlapping documents" },
            { name: "CopySimple", icon: CopySimple, note: "Cleaner version" },
            { name: "Clipboard", icon: Clipboard, note: "Physical clipboard" },
            {
                name: "ClipboardText",
                icon: ClipboardText,
                note: "Clipboard with content",
            },
        ],
        recommendation:
            "Copy - universally understood for this action. Transform to Check on success.",
    },
    {
        title: "External Link",
        description: "Opens in new tab",
        semanticQuestion: "Arrow leaving vs. link symbol?",
        options: [
            {
                name: "ArrowSquareOut",
                icon: ArrowSquareOut,
                note: "Arrow leaving box",
            },
            { name: "ArrowUpRight", icon: ArrowUpRight, note: "Directional" },
            { name: "Link", icon: Link, note: "Chain link" },
            { name: "LinkSimple", icon: LinkSimple, note: "Simplified link" },
        ],
        recommendation: "ArrowSquareOut - clearly indicates 'leaving this context'.",
    },
    {
        title: "Settings / Integrations",
        description: "Configuration and service connections",
        semanticQuestion:
            "Mechanical (gear) vs. adjustment (sliders) vs. connection (plug)?",
        options: [
            { name: "Gear", icon: Gear, note: "Classic settings" },
            { name: "GearSix", icon: GearSix, note: "More detail" },
            { name: "Sliders", icon: Sliders, note: "Adjustment metaphor" },
            {
                name: "SlidersHorizontal",
                icon: SlidersHorizontal,
                note: "Horizontal variant",
            },
            { name: "Plug", icon: Plug, note: "Connection focus" },
            {
                name: "PlugsConnected",
                icon: PlugsConnected,
                note: "Active connection",
            },
        ],
        recommendation:
            "Plug for Integrations specifically (it's about connecting services). Gear for general settings.",
    },
    {
        title: "Guide / Compass",
        description: "Help and navigation assistance",
        semanticQuestion: "Direction-finding vs. path-showing?",
        options: [
            {
                name: "Compass",
                icon: Compass,
                note: "Finding direction",
            },
            {
                name: "Signpost",
                icon: Signpost,
                note: "Showing the way",
            },
            { name: "Path", icon: Path, note: "Journey metaphor" },
            {
                name: "MapTrifold",
                icon: MapTrifold,
                note: "Overview/planning",
            },
        ],
        recommendation: "Compass - conveys guidance without being prescriptive.",
    },
    {
        title: "Code / Development",
        description: "How We Build, code mode",
        semanticQuestion: "Brackets vs. terminal vs. abstract?",
        options: [
            { name: "Code", icon: Code, note: "Angle brackets < />" },
            { name: "Terminal", icon: Terminal, note: "Command line" },
            { name: "BracketsCurly", icon: BracketsCurly, note: "{ } focus" },
            { name: "CodeBlock", icon: CodeBlock, note: "Block of code" },
        ],
        recommendation: "Code - universally recognized for development.",
    },
    {
        title: "AI Team",
        description: "Autonomous agents working for you",
        semanticQuestion: "Team (people) vs. AI (robot/brain) vs. capability?",
        options: [
            { name: "Robot", icon: Robot, note: "AI/automation feel" },
            { name: "Brain", icon: Brain, note: "Intelligence" },
            { name: "Atom", icon: Atom, note: "Science/capability" },
            { name: "Cpu", icon: Cpu, note: "Processing/compute" },
        ],
        recommendation:
            "Tricky - Robot might feel cold. Brain is too biological. Consider keeping Users icon to emphasize 'team' over 'AI'.",
    },
    {
        title: "Communication",
        description: "Email, chat, messaging features",
        semanticQuestion: "Chat bubble style matters for tone.",
        options: [
            {
                name: "ChatTeardrop",
                icon: ChatTeardrop,
                note: "Softer, friendly",
            },
            { name: "ChatText", icon: ChatText, note: "With text lines" },
            { name: "Chat", icon: Chat, note: "Simple bubble" },
            { name: "Envelope", icon: Envelope, note: "Email specific" },
            {
                name: "EnvelopeSimple",
                icon: EnvelopeSimple,
                note: "Cleaner envelope",
            },
        ],
        recommendation:
            "ChatTeardrop - the teardrop shape feels warmer and more conversational.",
    },
    {
        title: "Save / Confirm",
        description: "Saving content or confirming action",
        semanticQuestion: "Disk (legacy) vs. cloud (modern) vs. check (done)?",
        options: [
            { name: "FloppyDisk", icon: FloppyDisk, note: "Classic save icon" },
            { name: "CloudArrowUp", icon: CloudArrowUp, note: "Cloud save" },
            { name: "Check", icon: Check, note: "Confirmation" },
            { name: "CheckCircle", icon: CheckCircle, note: "Complete/success" },
        ],
        recommendation:
            "Check for confirmation, FloppyDisk only if explicitly 'saving'. Consider auto-save to eliminate the icon entirely.",
    },
    {
        title: "Loading / Refresh",
        description: "Async operations, retry",
        semanticQuestion: "Circular motion conveys ongoing activity.",
        options: [
            {
                name: "CircleNotch",
                icon: CircleNotch,
                note: "Animatable spinner",
            },
            { name: "ArrowsClockwise", icon: ArrowsClockwise, note: "Refresh" },
            {
                name: "ArrowClockwise",
                icon: ArrowClockwise,
                note: "Single direction",
            },
            {
                name: "ArrowCounterClockwise",
                icon: ArrowCounterClockwise,
                note: "Undo",
            },
        ],
        recommendation:
            "CircleNotch for loading (can spin). ArrowsClockwise for manual refresh. ArrowCounterClockwise for undo.",
    },
    {
        title: "Delete / Trash",
        description: "Destructive actions",
        semanticQuestion: "Trash can is universal. Should look serious.",
        options: [
            { name: "Trash", icon: Trash, note: "Detailed trash can" },
            { name: "TrashSimple", icon: TrashSimple, note: "Simpler version" },
        ],
        recommendation: "Trash - the detail helps convey the seriousness.",
    },
    {
        title: "Close / Dismiss",
        description: "Closing modals, dismissing notifications",
        semanticQuestion: "X is universal. Circle variant is softer.",
        options: [
            { name: "X", icon: X, note: "Universal close" },
            { name: "XCircle", icon: XCircle, note: "Contained, softer" },
        ],
        recommendation: "X for inline close, XCircle for dismissing errors.",
    },
    {
        title: "Warning / Error",
        description: "Alerts and error states",
        semanticQuestion: "Triangle is serious. Circle is informational.",
        options: [
            { name: "Warning", icon: Warning, note: "Triangle alert" },
            { name: "WarningCircle", icon: WarningCircle, note: "Circle alert" },
            { name: "Info", icon: Info, note: "Informational" },
        ],
        recommendation:
            "Warning for errors/serious. Info for tips. WarningCircle for moderate alerts.",
    },
];

function IconGrid({
    icons,
    selectedWeight,
}: {
    icons: IconOption[];
    selectedWeight: IconWeight;
}) {
    return (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {icons.map(({ name, icon: Icon, note }) => (
                <div
                    key={name}
                    className="bg-card hover:bg-card/80 flex flex-col items-center gap-2 rounded-xl border p-4 transition-colors"
                >
                    <Icon weight={selectedWeight} className="h-8 w-8" />
                    <span className="text-sm font-medium">{name}</span>
                    {note && (
                        <span className="text-muted-foreground text-center text-xs">
                            {note}
                        </span>
                    )}
                </div>
            ))}
        </div>
    );
}

export default function IconDesignLab() {
    const [selectedWeight, setSelectedWeight] = useState<IconWeight>("regular");

    return (
        <div className="container mx-auto max-w-6xl space-y-12 px-4 py-12">
            <header className="space-y-4">
                <h1 className="text-4xl font-bold">Icon Design Lab</h1>
                <p className="text-muted-foreground max-w-2xl text-lg">
                    Thoughtful exploration of Phosphor icons for Carmenta. Icons should
                    feel alive, support flow state, and add warmth without requiring
                    thought.
                </p>
            </header>

            {/* Weight selector */}
            <div className="bg-muted/50 sticky top-0 z-10 flex items-center gap-4 rounded-xl p-4 backdrop-blur">
                <span className="font-medium">Weight:</span>
                <div className="flex flex-wrap gap-2">
                    {weights.map((weight) => (
                        <button
                            key={weight}
                            onClick={() => setSelectedWeight(weight)}
                            className={cn(
                                "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                                selectedWeight === weight
                                    ? "bg-primary text-primary-foreground"
                                    : "hover:bg-muted"
                            )}
                        >
                            {weight}
                        </button>
                    ))}
                </div>
            </div>

            {/* Categories */}
            {categories.map((category) => (
                <section key={category.title} className="space-y-4">
                    <div className="space-y-2">
                        <h2 className="text-2xl font-semibold">{category.title}</h2>
                        <p className="text-muted-foreground">{category.description}</p>
                        <p className="text-primary text-sm font-medium">
                            {category.semanticQuestion}
                        </p>
                    </div>

                    <IconGrid
                        icons={category.options}
                        selectedWeight={selectedWeight}
                    />

                    {category.recommendation && (
                        <div className="bg-primary/5 border-primary/20 rounded-lg border p-4">
                            <span className="text-sm font-medium">
                                Initial recommendation:{" "}
                            </span>
                            <span className="text-muted-foreground text-sm">
                                {category.recommendation}
                            </span>
                        </div>
                    )}
                </section>
            ))}

            {/* Summary */}
            <section className="border-t pt-8">
                <h2 className="mb-4 text-2xl font-semibold">Weight Guidelines</h2>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <div className="rounded-xl border p-4">
                        <h3 className="font-medium">thin / light</h3>
                        <p className="text-muted-foreground text-sm">
                            Subtle, decorative, secondary actions. Whispers.
                        </p>
                    </div>
                    <div className="rounded-xl border p-4">
                        <h3 className="font-medium">regular</h3>
                        <p className="text-muted-foreground text-sm">
                            Default for most UI. Clear without demanding attention.
                        </p>
                    </div>
                    <div className="rounded-xl border p-4">
                        <h3 className="font-medium">bold</h3>
                        <p className="text-muted-foreground text-sm">
                            Emphasis, primary actions, calls to action.
                        </p>
                    </div>
                    <div className="rounded-xl border p-4">
                        <h3 className="font-medium">fill</h3>
                        <p className="text-muted-foreground text-sm">
                            Selected/active states. Heart should always be fill.
                        </p>
                    </div>
                    <div className="rounded-xl border p-4">
                        <h3 className="font-medium">duotone</h3>
                        <p className="text-muted-foreground text-sm">
                            Adds warmth and dimension. Great for user-facing elements
                            like avatars.
                        </p>
                    </div>
                </div>
            </section>
        </div>
    );
}
