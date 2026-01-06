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
    PlusIcon,
    PlusCircleIcon,
    ChatCircleIcon,
    SparkleIcon,
    LightningIcon,
    MagicWandIcon,
    ChatsIcon,

    // Save options
    FloppyDiskIcon,
    CloudArrowUpIcon,
    CheckIcon,
    CheckCircleIcon,
    DownloadSimpleIcon,

    // User avatar options
    UserCircleIcon,
    UserIcon,
    UserFocusIcon,
    PersonIcon,
    SmileyIcon,

    // Heart options
    HeartIcon,
    HeartStraightIcon,
    HeartbeatIcon,

    // Home options
    HouseIcon,
    HouseSimpleIcon,
    BuildingsIcon,
    StorefrontIcon,

    // Settings/Integrations options
    GearIcon,
    GearSixIcon,
    SlidersIcon,
    SlidersHorizontalIcon,
    PlugIcon,
    PlugsConnectedIcon,
    WrenchIcon,

    // Send message options
    PaperPlaneTiltIcon,
    PaperPlaneIcon,
    ArrowRightIcon,
    ArrowCircleRightIcon,
    NavigationArrowIcon,

    // Microphone options
    MicrophoneIcon,
    WaveformIcon,
    SpeakerHighIcon,
    RecordIcon,

    // Copy options
    CopyIcon,
    CopySimpleIcon,
    ClipboardIcon,
    ClipboardTextIcon,

    // External link options
    ArrowSquareOutIcon,
    ArrowUpRightIcon,
    LinkIcon,
    LinkSimpleIcon,

    // Menu/Navigation options
    ListIcon,
    DotsThreeIcon,
    DotsThreeVerticalIcon,
    CaretDownIcon,
    CaretRightIcon,

    // File/Document options
    FileIcon,
    FileTextIcon,
    FilesIcon,
    FolderOpenIcon,
    FolderIcon,

    // Search options
    MagnifyingGlassIcon,
    BinocularsIcon,

    // Close/Dismiss options
    XIcon,
    XCircleIcon,

    // Warning/Error options
    WarningIcon,
    WarningCircleIcon,
    InfoIcon,

    // Refresh/Retry options
    ArrowsClockwiseIcon,
    ArrowClockwiseIcon,
    ArrowCounterClockwiseIcon,
    CircleNotchIcon,

    // Star/Favorite options
    StarIcon,
    BookmarkIcon,
    BookmarkSimpleIcon,

    // Trash/Delete options
    TrashIcon,
    TrashSimpleIcon,

    // Edit options
    PencilSimpleIcon,
    PencilIcon,
    NotePencilIcon,

    // Calendar options
    CalendarIcon,
    CalendarBlankIcon,
    ClockIcon,

    // Communication options
    ChatTeardropIcon,
    ChatTextIcon,
    ChatIcon,
    EnvelopeIcon,
    EnvelopeSimpleIcon,

    // Code options
    CodeIcon,
    TerminalIcon,
    BracketsCurlyIcon,
    CodeBlockIcon,

    // Brain/AI options
    BrainIcon,
    RobotIcon,
    AtomIcon,
    CpuIcon,

    // Compass/Guide options
    CompassIcon,
    SignpostIcon,
    PathIcon,
    MapTrifoldIcon,

    // Lock/Security options
    LockIcon,
    LockSimpleIcon,
    ShieldIcon,
    ShieldCheckIcon,

    // Play/Media options
    PlayIcon,
    PauseIcon,
    StopIcon,

    // Expand/Collapse options
    ArrowsOutIcon,
    ArrowsInIcon,
    CaretDoubleDownIcon,
    CaretDoubleUpIcon,

    // GitHub option
    GithubLogoIcon,
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
            { name: "Plus", icon: PlusIcon, note: "Universal 'new' action" },
            { name: "PlusCircle", icon: PlusCircleIcon, note: "Softer, contained" },
            {
                name: "ChatCircle",
                icon: ChatCircleIcon,
                note: "Emphasizes conversation",
            },
            {
                name: "Sparkle",
                icon: SparkleIcon,
                note: "Magic/AI feel, but might be overused",
            },
            {
                name: "Lightning",
                icon: LightningIcon,
                note: "Energy, speed",
            },
            {
                name: "MagicWand",
                icon: MagicWandIcon,
                note: "Explicit magic metaphor",
            },
            { name: "Chats", icon: ChatsIcon, note: "Multiple conversations" },
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
                icon: UserCircleIcon,
                note: "Classic, works with duotone",
            },
            { name: "User", icon: UserIcon, note: "Simpler, no container" },
            { name: "UserFocus", icon: UserFocusIcon, note: "More dynamic" },
            { name: "Person", icon: PersonIcon, note: "Full body silhouette" },
            { name: "Smiley", icon: SmileyIcon, note: "Friendly, playful" },
        ],
        recommendation:
            "UserCircle with duotone - the inner fill adds life without being cartoonish.",
    },
    {
        title: "Heart / Philosophy",
        description: "Heart-centered AI link",
        semanticQuestion: "Fill conveys love. Duotone adds dimension.",
        options: [
            { name: "Heart", icon: HeartIcon, note: "Classic heart shape" },
            {
                name: "HeartStraight",
                icon: HeartStraightIcon,
                note: "More geometric",
            },
            {
                name: "Heartbeat",
                icon: HeartbeatIcon,
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
            { name: "House", icon: HouseIcon, note: "Classic home" },
            { name: "HouseSimple", icon: HouseSimpleIcon, note: "Cleaner lines" },
            {
                name: "Buildings",
                icon: BuildingsIcon,
                note: "More urban/professional",
            },
            { name: "Storefront", icon: StorefrontIcon, note: "Inviting entry" },
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
                icon: PaperPlaneTiltIcon,
                note: "Dynamic, taking flight",
            },
            { name: "PaperPlane", icon: PaperPlaneIcon, note: "More static" },
            { name: "ArrowRight", icon: ArrowRightIcon, note: "Pure direction" },
            {
                name: "ArrowCircleRight",
                icon: ArrowCircleRightIcon,
                note: "Contained arrow",
            },
            {
                name: "NavigationArrow",
                icon: NavigationArrowIcon,
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
            { name: "Microphone", icon: MicrophoneIcon, note: "Universal voice" },
            {
                name: "Waveform",
                icon: WaveformIcon,
                note: "Audio/sound visualization",
            },
            { name: "Record", icon: RecordIcon, note: "Recording action" },
        ],
        recommendation:
            "Microphone - universally understood. Could animate to Waveform when active.",
    },
    {
        title: "Copy to Clipboard",
        description: "Copy button on code blocks, messages",
        semanticQuestion: "Clipboard metaphor vs. document duplication?",
        options: [
            { name: "Copy", icon: CopyIcon, note: "Two overlapping documents" },
            { name: "CopySimple", icon: CopySimpleIcon, note: "Cleaner version" },
            { name: "Clipboard", icon: ClipboardIcon, note: "Physical clipboard" },
            {
                name: "ClipboardText",
                icon: ClipboardTextIcon,
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
                icon: ArrowSquareOutIcon,
                note: "Arrow leaving box",
            },
            { name: "ArrowUpRight", icon: ArrowUpRightIcon, note: "Directional" },
            { name: "Link", icon: LinkIcon, note: "Chain link" },
            { name: "LinkSimple", icon: LinkSimpleIcon, note: "Simplified link" },
        ],
        recommendation: "ArrowSquareOut - clearly indicates 'leaving this context'.",
    },
    {
        title: "Settings / Integrations",
        description: "Configuration and service connections",
        semanticQuestion:
            "Mechanical (gear) vs. adjustment (sliders) vs. connection (plug)?",
        options: [
            { name: "Gear", icon: GearIcon, note: "Classic settings" },
            { name: "GearSix", icon: GearSixIcon, note: "More detail" },
            { name: "Sliders", icon: SlidersIcon, note: "Adjustment metaphor" },
            {
                name: "SlidersHorizontal",
                icon: SlidersHorizontalIcon,
                note: "Horizontal variant",
            },
            { name: "Plug", icon: PlugIcon, note: "Connection focus" },
            {
                name: "PlugsConnected",
                icon: PlugsConnectedIcon,
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
                icon: CompassIcon,
                note: "Finding direction",
            },
            {
                name: "Signpost",
                icon: SignpostIcon,
                note: "Showing the way",
            },
            { name: "Path", icon: PathIcon, note: "Journey metaphor" },
            {
                name: "MapTrifold",
                icon: MapTrifoldIcon,
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
            { name: "Code", icon: CodeIcon, note: "Angle brackets < />" },
            { name: "Terminal", icon: TerminalIcon, note: "Command line" },
            { name: "BracketsCurly", icon: BracketsCurlyIcon, note: "{ } focus" },
            { name: "CodeBlock", icon: CodeBlockIcon, note: "Block of code" },
        ],
        recommendation: "Code - universally recognized for development.",
    },
    {
        title: "AI Team",
        description: "Autonomous agents working for you",
        semanticQuestion: "Team (people) vs. AI (robot/brain) vs. capability?",
        options: [
            { name: "Robot", icon: RobotIcon, note: "AI/automation feel" },
            { name: "Brain", icon: BrainIcon, note: "Intelligence" },
            { name: "Atom", icon: AtomIcon, note: "Science/capability" },
            { name: "Cpu", icon: CpuIcon, note: "Processing/compute" },
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
                icon: ChatTeardropIcon,
                note: "Softer, friendly",
            },
            { name: "ChatText", icon: ChatTextIcon, note: "With text lines" },
            { name: "Chat", icon: ChatIcon, note: "Simple bubble" },
            { name: "Envelope", icon: EnvelopeIcon, note: "Email specific" },
            {
                name: "EnvelopeSimple",
                icon: EnvelopeSimpleIcon,
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
            { name: "FloppyDisk", icon: FloppyDiskIcon, note: "Classic save icon" },
            { name: "CloudArrowUp", icon: CloudArrowUpIcon, note: "Cloud save" },
            { name: "Check", icon: CheckIcon, note: "Confirmation" },
            { name: "CheckCircle", icon: CheckCircleIcon, note: "Complete/success" },
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
                icon: CircleNotchIcon,
                note: "Animatable spinner",
            },
            { name: "ArrowsClockwise", icon: ArrowsClockwiseIcon, note: "Refresh" },
            {
                name: "ArrowClockwise",
                icon: ArrowClockwiseIcon,
                note: "Single direction",
            },
            {
                name: "ArrowCounterClockwise",
                icon: ArrowCounterClockwiseIcon,
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
            { name: "Trash", icon: TrashIcon, note: "Detailed trash can" },
            { name: "TrashSimple", icon: TrashSimpleIcon, note: "Simpler version" },
        ],
        recommendation: "Trash - the detail helps convey the seriousness.",
    },
    {
        title: "Close / Dismiss",
        description: "Closing modals, dismissing notifications",
        semanticQuestion: "X is universal. Circle variant is softer.",
        options: [
            { name: "X", icon: XIcon, note: "Universal close" },
            { name: "XCircle", icon: XCircleIcon, note: "Contained, softer" },
        ],
        recommendation: "X for inline close, XCircle for dismissing errors.",
    },
    {
        title: "Warning / Error",
        description: "Alerts and error states",
        semanticQuestion: "Triangle is serious. Circle is informational.",
        options: [
            { name: "Warning", icon: WarningIcon, note: "Triangle alert" },
            { name: "WarningCircle", icon: WarningCircleIcon, note: "Circle alert" },
            { name: "Info", icon: InfoIcon, note: "Informational" },
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
            {icons.map(({ name, icon: IconIcon, note }) => (
                <div
                    key={name}
                    className="bg-card hover:bg-card/80 flex flex-col items-center gap-2 rounded-xl border p-4 transition-colors"
                >
                    <IconIcon weight={selectedWeight} className="h-8 w-8" />
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
