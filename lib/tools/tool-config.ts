import {
    TableIcon,
    MagnifyingGlassIcon,
    GlobeIcon,
    BrainIcon,
    CloudSunIcon,
    BookOpenIcon,
    SparkleIcon,
    CalculatorIcon,
    FileTextIcon,
    PencilSimpleIcon,
    PencilIcon,
    TerminalIcon,
    FolderOpenIcon,
    FileMagnifyingGlassIcon,
    RobotIcon,
    ListChecksIcon,
    CodeIcon,
    NotebookIcon,
    ChatCircleDotsIcon,
    LinkIcon,
    QuestionIcon,
    HeartIcon,
    UsersIcon,
    PlugIcon,
    ArchiveIcon,
    ImageSquareIcon,
    type Icon,
} from "@phosphor-icons/react";
import { logger } from "@/lib/client-logger";

// ============================================================================
// Description extraction helpers
// ============================================================================

/** Truncate string to max length with ellipsis */
function truncate(str: string, maxLength: number): string {
    if (str.length <= maxLength) return str;
    return str.slice(0, maxLength - 1) + "…";
}

/**
 * Tool status states matching Vercel AI SDK's tool part states
 */
export type ToolStatus = "pending" | "running" | "completed" | "error";

/**
 * Configuration for a single tool's display and messaging
 */
export interface ToolConfig {
    displayName: string;
    /** Either a Phosphor icon component or a path to a logo (e.g., "/logos/notion.svg") */
    icon: Icon | string;
    /** Extract a brief description from tool args for the collapsed view */
    getDescription?: (args: Record<string, unknown>) => string | undefined;
    messages: {
        pending: string;
        running: string;
        completed: string;
        error: string;
    };
    /** Delight variant messages (selected by hash probability) */
    delightMessages?: {
        completed?: string[];
        fast?: string[]; // For completions under 500ms
    };
    /** Auto-expand when tool errors (default: true) */
    autoExpandOnError?: boolean;
}

/**
 * Tool configurations with display names, icons, and status messages.
 * Each tool can have delight variants for occasional warmth.
 */
export const TOOL_CONFIG: Record<string, ToolConfig> = {
    compareOptions: {
        displayName: "Comparison",
        icon: TableIcon,
        getDescription: (args) => {
            const title = args.title as string | undefined;
            return title ? truncate(title, 40) : undefined;
        },
        messages: {
            pending: "Getting ready...",
            running: "Putting this together...",
            completed: "Comparison ready",
            error: "We couldn't build that comparison",
        },
        delightMessages: {
            completed: ["All lined up", "Side by side", "Here's the breakdown"],
            fast: ["Quick compare!", "That was fast"],
        },
    },
    webSearch: {
        displayName: "Web Search",
        icon: MagnifyingGlassIcon,
        getDescription: (args) => {
            const query = args.query as string | undefined;
            return query ? truncate(query, 50) : undefined;
        },
        messages: {
            pending: "Getting ready...",
            running: "Exploring the web together...",
            completed: "Found what we were looking for",
            error: "We couldn't search the web right now. The robots caught it. 🤖",
        },
        delightMessages: {
            completed: ["Discovery made", "Here's what's out there", "Found it"],
            fast: ["Quick discovery!", "Found that fast"],
        },
    },
    fetchPage: {
        displayName: "Fetch Page",
        icon: GlobeIcon,
        getDescription: (args) => {
            const url = args.url as string | undefined;
            if (!url) return undefined;
            try {
                return new URL(url).hostname;
            } catch {
                return truncate(url, 40);
            }
        },
        messages: {
            pending: "Getting ready...",
            running: "Retrieving that page together...",
            completed: "Page content ready",
            error: "We couldn't reach that page. It may be unavailable or blocked.",
        },
        delightMessages: {
            completed: ["Content captured", "Page ready", "Got the details"],
            fast: ["Quick retrieval!", "Got it instantly"],
        },
    },
    deepResearch: {
        displayName: "Deep Research",
        icon: BrainIcon,
        getDescription: (args) => {
            const topic = args.topic as string | undefined;
            return topic ? truncate(topic, 50) : undefined;
        },
        messages: {
            pending: "Getting ready...",
            running: "Diving into this...",
            completed: "Research complete",
            error: "We couldn't complete that research. The bots have been alerted. 🤖",
        },
        delightMessages: {
            completed: ["Found insights", "Discoveries made", "Research done"],
            fast: ["Quick research!", "Fast findings"],
        },
    },
    getWeather: {
        displayName: "Weather",
        icon: CloudSunIcon,
        getDescription: (args) => {
            const location = args.location as string | undefined;
            return location ? truncate(location, 30) : undefined;
        },
        messages: {
            pending: "Getting ready...",
            running: "Checking the weather...",
            completed: "Weather retrieved",
            error: "Weather service isn't responding. The bots are on it. 🤖",
        },
        delightMessages: {
            completed: ["Forecast ready", "Weather check done", "Climate confirmed"],
            fast: ["Quick forecast!", "Instant weather"],
        },
    },
    searchKnowledge: {
        displayName: "Knowledge Base",
        icon: BookOpenIcon,
        getDescription: (args) => {
            const query = args.query as string | undefined;
            return query ? truncate(query, 50) : undefined;
        },
        messages: {
            pending: "Getting ready...",
            running: "Searching what we know...",
            completed: "Found what we needed",
            error: "Couldn't search our knowledge. The robots have been notified. 🤖",
        },
        delightMessages: {
            completed: ["Memory retrieved", "Found it", "Here's what we have"],
            fast: ["Quick recall!", "Found that fast"],
        },
    },

    // =========================================================================
    // AI Team tools - DCOS orchestration and subagents
    // =========================================================================

    dcos: {
        displayName: "AI Team",
        icon: UsersIcon,
        getDescription: (args) => {
            const action = args.action as string | undefined;
            const name = args.name as string | undefined;
            if (action === "list") return "listing automations";
            if (action === "get" && name) return truncate(name, 30);
            if (action === "update") return "updating automation";
            if (action === "runs") return "checking run history";
            if (action === "run") return "viewing run details";
            return action;
        },
        messages: {
            pending: "Getting ready...",
            running: "Checking on our team...",
            completed: "Team update ready",
            error: "Couldn't reach the team. Our monitoring caught it. 🤖",
        },
        delightMessages: {
            completed: ["Team checked", "All systems go", "Here's the update"],
            fast: ["Quick check!", "Got it"],
        },
    },
    librarian: {
        displayName: "Knowledge Librarian",
        icon: ArchiveIcon,
        getDescription: (args) => {
            const action = args.action as string | undefined;
            const query = args.query as string | undefined;
            const path = args.path as string | undefined;
            if (action === "search" && query) return truncate(query, 40);
            if (action === "extract") return "analyzing conversation";
            if (action === "retrieve" && path) return truncate(path, 30);
            if (action === "create") return "creating document";
            if (action === "update") return "updating document";
            if (action === "move") return "moving document";
            if (action === "delete") return "removing document";
            if (action === "list") return "listing documents";
            return action;
        },
        messages: {
            pending: "Getting ready...",
            running: "Working with our knowledge...",
            completed: "Knowledge updated",
            error: "Had trouble with our knowledge base. The robots have been notified. 🤖",
        },
        delightMessages: {
            completed: ["Memory organized", "Knowledge saved", "All recorded"],
            fast: ["Quick update!", "Done"],
        },
    },
    mcpConfig: {
        displayName: "Integrations",
        icon: PlugIcon,
        getDescription: (args) => {
            const action = args.action as string | undefined;
            const serviceId = args.serviceId as string | undefined;
            if (action === "list") return "checking connections";
            if (action === "test" && serviceId) return `testing ${serviceId}`;
            if (action === "guide" && serviceId) return `${serviceId} setup`;
            return action;
        },
        messages: {
            pending: "Getting ready...",
            running: "Checking our connections...",
            completed: "Integrations checked",
            error: "Couldn't check integrations. The bots are on it. 🤖",
        },
        delightMessages: {
            completed: ["All connected", "Services ready", "Connections verified"],
            fast: ["Quick check!", "All good"],
        },
    },

    // Discovery tools - progressive context building
    updateDiscovery: {
        displayName: "Learning",
        icon: SparkleIcon,
        getDescription: (args) => {
            const key = args.key as string | undefined;
            return key ? truncate(key, 30) : undefined;
        },
        messages: {
            pending: "Getting ready...",
            running: "Learning something new...",
            completed: "Got it",
            error: "Couldn't save that. The robots are on it. 🤖",
        },
        delightMessages: {
            completed: ["Noted", "Captured", "Remembered"],
            fast: ["Quick!"],
        },
    },
    completeDiscovery: {
        displayName: "Learning",
        icon: SparkleIcon,
        messages: {
            pending: "Getting ready...",
            running: "Finishing up...",
            completed: "All learned",
            error: "Couldn't complete. The bots are checking. 🤖",
        },
        delightMessages: {
            completed: ["Done", "Wrapped up", "Complete"],
        },
    },
    skipDiscovery: {
        displayName: "Learning",
        icon: SparkleIcon,
        messages: {
            pending: "Getting ready...",
            running: "Moving on...",
            completed: "Skipped",
            error: "Something went sideways. The robots are on it. 🤖",
        },
    },
    limitless: {
        displayName: "Limitless",
        icon: "/logos/limitless.svg",
        getDescription: (args) => {
            const query = args.query as string | undefined;
            return query ? truncate(query, 50) : undefined;
        },
        messages: {
            pending: "Getting ready...",
            running: "Searching your conversations...",
            completed: "Conversations found",
            error: "We couldn't search conversations. Our monitoring caught it. 🤖",
        },
        delightMessages: {
            completed: ["Memory retrieved", "Found it", "Here's what we captured"],
            fast: ["Quick recall!", "Found that fast"],
        },
    },
    // Service integrations (alphabetical order)
    calculate: {
        displayName: "Calculator",
        icon: CalculatorIcon,
        getDescription: (args) => {
            const expression = args.expression as string | undefined;
            return expression ? truncate(expression, 30) : undefined;
        },
        messages: {
            pending: "Getting ready...",
            running: "Crunching the numbers...",
            completed: "Here's the answer",
            error: "That expression didn't compute. Check the syntax?",
        },
        delightMessages: {
            completed: ["Got it", "Math done", "Solved"],
            fast: ["Quick math!", "Done!"],
        },
    },
    clickup: {
        displayName: "ClickUp",
        icon: "/logos/clickup.svg",
        messages: {
            pending: "Getting ready...",
            running: "Working with our tasks...",
            completed: "ClickUp ready",
            error: "Hit a snag with ClickUp",
        },
        delightMessages: {
            completed: [
                "Tasks organized",
                "All lined up",
                "Work tracked",
                "We're on it",
            ],
            fast: ["Quick check!", "Instant sync!", "Got it"],
        },
    },
    coinmarketcap: {
        displayName: "CoinMarketCap",
        icon: "/logos/coinmarketcap.svg",
        getDescription: (args) => {
            const action = args.action as string | undefined;
            const symbol = (args.params as { symbol?: string })?.symbol;
            if (symbol) return symbol.toUpperCase();
            return action;
        },
        messages: {
            pending: "Getting ready...",
            running: "Checking the markets...",
            completed: "Market data ready",
            error: "Couldn't reach CoinMarketCap. The bots are checking. 🤖",
        },
        delightMessages: {
            completed: ["Prices retrieved", "Market snapshot", "Data fresh"],
            fast: ["Quick quote!", "Instant prices"],
        },
    },
    dropbox: {
        displayName: "Dropbox",
        icon: "/logos/dropbox.svg",
        getDescription: (args) => {
            const action = args.action as string | undefined;
            const path = (args.params as { path?: string })?.path;
            if (path) {
                const parts = path.split("/");
                return truncate(parts[parts.length - 1] || path, 30);
            }
            return action;
        },
        messages: {
            pending: "Getting ready...",
            running: "Working with our files...",
            completed: "Files ready",
            error: "Had trouble with Dropbox. Our monitoring caught it. 🤖",
        },
        delightMessages: {
            completed: ["Got it", "Synced", "Files updated"],
            fast: ["Quick access!", "Done"],
        },
    },
    fireflies: {
        displayName: "Fireflies",
        icon: "/logos/fireflies.svg",
        getDescription: (args) => {
            const action = args.action as string | undefined;
            const query = (args.params as { query?: string })?.query;
            if (query) return truncate(query, 30);
            return action;
        },
        messages: {
            pending: "Getting ready...",
            running: "Searching our meeting notes...",
            completed: "Found the transcripts",
            error: "Couldn't reach Fireflies. The robots are on it. 🤖",
        },
        delightMessages: {
            completed: ["Meetings found", "Notes retrieved", "Transcript ready"],
            fast: ["Quick find!", "Got it"],
        },
    },
    giphy: {
        displayName: "GIF",
        icon: "/logos/giphy.svg",
        getDescription: (args) => {
            const query = args.query as string | undefined;
            const action = args.action as string | undefined;
            if (query) return truncate(query, 25);
            if (action === "get_trending") return "trending";
            if (action === "get_random") return "random";
            return action;
        },
        messages: {
            pending: "Getting ready...",
            running: "Finding the perfect one...",
            completed: "This one",
            error: "Couldn't find the right GIF. The bots are on it. 🤖",
        },
        delightMessages: {
            completed: ["Perfect", "Yes", "Found it"],
            fast: ["Gotcha", "Quick!"],
        },
    },
    imgflip: {
        displayName: "Meme",
        icon: "/logos/imgflip.svg",
        getDescription: (args) => {
            const action = args.action as string | undefined;
            const templateId = args.templateId as string | undefined;
            return action === "list_templates"
                ? "browsing templates"
                : templateId
                  ? "creating meme"
                  : undefined;
        },
        messages: {
            pending: "Getting ready...",
            running: "This'll be good...",
            completed: "Perfect",
            error: "Meme generation failed. The robots are sad. 🤖",
        },
        delightMessages: {
            completed: ["Nailed it", "Chef's kiss", "This is the one"],
            fast: ["Quick meme!", "Done"],
        },
    },
    createImage: {
        displayName: "Image Generation",
        icon: ImageSquareIcon,
        getDescription: (args) => {
            const prompt = args.prompt as string | undefined;
            return prompt ? truncate(prompt, 40) : undefined;
        },
        messages: {
            pending: "Getting ready...",
            running: "Creating something beautiful...",
            completed: "Image ready",
            error: "We couldn't create that image",
        },
        delightMessages: {
            completed: [
                "Look at this",
                "Here's what we made",
                "Vision realized",
                "Created",
            ],
        },
    },
    gmail: {
        displayName: "Gmail",
        icon: "/logos/gmail.svg",
        getDescription: (args) => {
            const action = args.action as string | undefined;
            if (action === "send_email") return "sending email";
            if (action === "search_emails") return "searching inbox";
            if (action === "read_email") return "reading email";
            if (action === "list_labels") return "checking labels";
            return action;
        },
        messages: {
            pending: "Getting ready...",
            running: "Working with our email...",
            completed: "Email ready",
            error: "Had trouble with Gmail. Our monitoring caught it. 🤖",
        },
        delightMessages: {
            completed: ["Done", "Inbox checked", "All set"],
            fast: ["Quick!", "Sent!"],
        },
    },
    "google-calendar-contacts": {
        displayName: "Calendar & Contacts",
        icon: "/logos/google-calendar-contacts.svg",
        getDescription: (args) => {
            const action = args.action as string | undefined;
            if (action === "list_events") return "checking calendar";
            if (action === "create_event") return "creating event";
            if (action === "search_contacts") return "finding contacts";
            if (action === "get_contact") return "looking up contact";
            return action;
        },
        messages: {
            pending: "Getting ready...",
            running: "Checking our calendar...",
            completed: "Calendar ready",
            error: "Had trouble with Google. The bots are on it. 🤖",
        },
        delightMessages: {
            completed: ["All set", "Event ready", "Contact found"],
            fast: ["Quick check!", "Done!"],
        },
    },
    notion: {
        displayName: "Notion",
        icon: "/logos/notion.svg",
        messages: {
            pending: "Getting ready...",
            running: "Exploring Notion together...",
            completed: "Found what we needed",
            error: "We couldn't reach that Notion page",
        },
        delightMessages: {
            completed: ["Page ready", "Discovered it", "Here's what we found"],
            fast: ["Quick find!", "Got it"],
        },
    },
    quo: {
        displayName: "Quo",
        icon: "/logos/quo.svg",
        getDescription: (args) => {
            const action = args.action as string | undefined;
            if (action === "send_message") return "sending message";
            if (action === "list_messages") return "checking messages";
            if (action === "list_calls") return "checking calls";
            return action;
        },
        messages: {
            pending: "Getting ready...",
            running: "Working with Quo...",
            completed: "All set",
            error: "Had trouble with Quo. Our monitoring caught it. 🤖",
        },
        delightMessages: {
            completed: ["Message sent", "Done", "Ready"],
            fast: ["Quick!", "Sent"],
        },
    },
    smsUser: {
        displayName: "SMS",
        icon: ChatCircleDotsIcon,
        getDescription: (args) => {
            const action = args.action as string | undefined;
            if (action === "send") return "texting you";
            return action;
        },
        messages: {
            pending: "Getting ready...",
            running: "Texting you...",
            completed: "Sent",
            error: "That didn't go through. Make sure you have a verified phone in settings.",
        },
        delightMessages: {
            completed: ["On its way", "Headed your way", "Check your phone"],
            fast: ["Quick!", "Already there"],
        },
    },
    slack: {
        displayName: "Slack",
        icon: "/logos/slack.svg",
        getDescription: (args) => {
            const action = args.action as string | undefined;
            const channel = (args.params as { channel?: string })?.channel;
            if (action === "send_message" && channel) return `#${channel}`;
            if (action === "list_channels") return "checking channels";
            if (action === "search_messages") return "searching messages";
            return action;
        },
        messages: {
            pending: "Getting ready...",
            running: "Working with our Slack...",
            completed: "Slack ready",
            error: "Had trouble with Slack. The bots are on it. 🤖",
        },
        delightMessages: {
            completed: ["Message sent", "Done", "Channel updated"],
            fast: ["Quick!", "Sent!"],
        },
    },
    spotify: {
        displayName: "Spotify",
        icon: "/logos/spotify.svg",
        getDescription: (args) => {
            const action = args.action as string | undefined;
            if (action === "search") {
                const query = args.params as { query?: string } | undefined;
                return query?.query ? truncate(query.query, 30) : "searching";
            }
            if (action === "get_currently_playing") return "now playing";
            if (action === "play") return "playing";
            if (action === "pause") return "pausing";
            if (action === "next" || action === "previous") return "skipping";
            return action;
        },
        messages: {
            pending: "Getting ready...",
            running: "Connecting to Spotify...",
            completed: "Spotify ready",
            error: "Couldn't complete Spotify operation",
        },
        delightMessages: {
            completed: ["Music flowing", "Tuned in", "Sound check done", "Vibes ready"],
            fast: ["Quick beats!", "Instant tune"],
        },
    },
    twitter: {
        displayName: "X",
        icon: "/logos/twitter.svg",
        getDescription: (args) => {
            const action = args.action as string | undefined;
            if (action === "post_tweet") return "posting";
            if (action === "search_tweets") return "searching";
            if (action === "get_timeline") return "checking timeline";
            return action;
        },
        messages: {
            pending: "Getting ready...",
            running: "Working with X...",
            completed: "Done",
            error: "Had trouble with X. Our monitoring caught it. 🤖",
        },
        delightMessages: {
            completed: ["Posted", "Timeline checked", "Ready"],
            fast: ["Quick!", "Done"],
        },
    },

    // =========================================================================
    // Claude Code tools - code mode file and shell operations
    // =========================================================================

    Read: {
        displayName: "Reading",
        icon: FileTextIcon,
        getDescription: (args) => {
            const filePath = args.file_path as string | undefined;
            if (!filePath) return undefined;
            const parts = filePath.split("/");
            return truncate(parts[parts.length - 1] || filePath, 40);
        },
        messages: {
            pending: "Getting ready...",
            running: "Reading...",
            completed: "Got it",
            error: "File not accessible",
        },
        delightMessages: {
            completed: ["Loaded", "Ready", "Here it is"],
            fast: ["Quick!"],
        },
    },

    Write: {
        displayName: "Writing",
        icon: PencilSimpleIcon,
        getDescription: (args) => {
            const filePath = args.file_path as string | undefined;
            if (!filePath) return undefined;
            const parts = filePath.split("/");
            return truncate(parts[parts.length - 1] || filePath, 40);
        },
        messages: {
            pending: "Getting ready...",
            running: "Writing...",
            completed: "Saved",
            error: "Couldn't write that file. Check permissions?",
        },
        delightMessages: {
            completed: ["Done", "Written", "Created"],
            fast: ["Quick!"],
        },
    },

    Edit: {
        displayName: "Editing",
        icon: PencilIcon,
        getDescription: (args) => {
            const filePath = args.file_path as string | undefined;
            if (!filePath) return undefined;
            const parts = filePath.split("/");
            return truncate(parts[parts.length - 1] || filePath, 40);
        },
        messages: {
            pending: "Getting ready...",
            running: "Editing...",
            completed: "Updated",
            error: "Edit didn't apply. The old content might have changed.",
        },
        delightMessages: {
            completed: ["Changed", "Modified", "Done"],
            fast: ["Quick!"],
        },
    },

    Bash: {
        displayName: "Running",
        icon: TerminalIcon,
        getDescription: (args) => {
            const command = args.command as string | undefined;
            const description = args.description as string | undefined;
            if (description) return truncate(description, 35);
            if (!command) return undefined;
            const parts = command.split(/\s+/);
            const cmd = parts[0];
            if (parts.length === 1) return cmd;
            return truncate(`${cmd} ...`, 30);
        },
        messages: {
            pending: "Getting ready...",
            running: "Running...",
            completed: "Done",
            error: "Command exited with an error",
        },
        delightMessages: {
            completed: ["Executed", "Complete", "Finished"],
            fast: ["Quick!"],
        },
    },

    Glob: {
        displayName: "Finding",
        icon: FolderOpenIcon,
        getDescription: (args) => {
            const pattern = args.pattern as string | undefined;
            return pattern ? truncate(pattern, 40) : undefined;
        },
        messages: {
            pending: "Getting ready...",
            running: "Finding files...",
            completed: "Found them",
            error: "Search didn't match anything",
        },
        delightMessages: {
            completed: ["Located", "Matched", "Here they are"],
            fast: ["Quick!"],
        },
    },

    Grep: {
        displayName: "Searching",
        icon: FileMagnifyingGlassIcon,
        getDescription: (args) => {
            const pattern = args.pattern as string | undefined;
            return pattern ? truncate(`"${pattern}"`, 40) : undefined;
        },
        messages: {
            pending: "Getting ready...",
            running: "Searching...",
            completed: "Found matches",
            error: "No matches found",
        },
        delightMessages: {
            completed: ["Results ready", "Located", "Here they are"],
            fast: ["Quick!"],
        },
    },

    Task: {
        displayName: "Working",
        icon: RobotIcon,
        getDescription: (args) => {
            const agentType = args.subagent_type as string | undefined;
            const description = args.description as string | undefined;
            return agentType || (description ? truncate(description, 30) : undefined);
        },
        messages: {
            pending: "Getting ready...",
            running: "Working on this...",
            completed: "Finished",
            error: "Sub-task hit an issue",
        },
        delightMessages: {
            completed: ["Done", "Complete", "All set"],
        },
    },

    TodoWrite: {
        displayName: "Tasks",
        icon: ListChecksIcon,
        messages: {
            pending: "Getting ready...",
            running: "Updating tasks...",
            completed: "Tasks updated",
            error: "Couldn't update task list",
        },
        delightMessages: {
            completed: ["Organized", "Tracked", "Ready"],
            fast: ["Quick!"],
        },
    },

    LSP: {
        displayName: "Analyzing",
        icon: CodeIcon,
        getDescription: (args) => {
            const operation = args.operation as string | undefined;
            return operation;
        },
        messages: {
            pending: "Getting ready...",
            running: "Analyzing code...",
            completed: "Analysis ready",
            error: "Couldn't analyze that code",
        },
        delightMessages: {
            completed: ["Found it", "Understood", "Here's what I see"],
            fast: ["Quick!"],
        },
    },

    NotebookEdit: {
        displayName: "Notebook",
        icon: NotebookIcon,
        getDescription: (args) => {
            const notebookPath = args.notebook_path as string | undefined;
            if (!notebookPath) return undefined;
            const parts = notebookPath.split("/");
            return truncate(parts[parts.length - 1] || notebookPath, 30);
        },
        messages: {
            pending: "Getting ready...",
            running: "Editing notebook...",
            completed: "Notebook updated",
            error: "Couldn't edit that cell",
        },
        delightMessages: {
            completed: ["Updated", "Modified", "Done"],
            fast: ["Quick!"],
        },
    },

    WebFetch: {
        displayName: "Fetching",
        icon: GlobeIcon,
        getDescription: (args) => {
            const url = args.url as string | undefined;
            if (!url) return undefined;
            try {
                return new URL(url).hostname;
            } catch {
                return truncate(url, 40);
            }
        },
        messages: {
            pending: "Getting ready...",
            running: "Fetching page...",
            completed: "Page ready",
            error: "Page not reachable. It may be down or blocking access.",
        },
        delightMessages: {
            completed: ["Got it", "Loaded", "Retrieved"],
            fast: ["Quick!"],
        },
    },

    WebSearch: {
        displayName: "Searching",
        icon: MagnifyingGlassIcon,
        getDescription: (args) => {
            const query = args.query as string | undefined;
            return query ? truncate(query, 50) : undefined;
        },
        messages: {
            pending: "Getting ready...",
            running: "Searching the web...",
            completed: "Found results",
            error: "Search didn't return results. The bots are on it. 🤖",
        },
        delightMessages: {
            completed: ["Discovered", "Here's what I found", "Results ready"],
            fast: ["Quick!"],
        },
    },
    // Post-response enhancement tools
    suggestQuestions: {
        displayName: "Ideas",
        icon: ChatCircleDotsIcon,
        getDescription: (args) => {
            const suggestions = args.suggestions as
                | Array<{ prompt: string }>
                | undefined;
            if (!suggestions?.length) return undefined;
            return `${suggestions.length} idea${suggestions.length > 1 ? "s" : ""}`;
        },
        messages: {
            pending: "Thinking...",
            running: "Finding follow-ups...",
            completed: "Some ideas",
            error: "Couldn't think of follow-ups",
        },
        delightMessages: {
            completed: ["What's next?", "Keep exploring?", "Curious about more?"],
            fast: ["Quick thoughts!"],
        },
    },
    showReferences: {
        displayName: "Sources",
        icon: LinkIcon,
        getDescription: (args) => {
            const refs = args.references as Array<{ title: string }> | undefined;
            if (!refs?.length) return undefined;
            return `${refs.length} source${refs.length > 1 ? "s" : ""}`;
        },
        messages: {
            pending: "Getting ready...",
            running: "Gathering sources...",
            completed: "Sources",
            error: "Couldn't load sources",
        },
        delightMessages: {
            completed: ["Here's where this came from", "The sources"],
            fast: ["Quick reference!"],
        },
    },
    askUserInput: {
        displayName: "Question",
        icon: QuestionIcon,
        getDescription: (args) => {
            const question = args.question as string | undefined;
            return question ? truncate(question, 40) : undefined;
        },
        messages: {
            pending: "Getting ready...",
            running: "Preparing...",
            completed: "Your turn",
            error: "Something went wrong preparing that question",
        },
        delightMessages: {
            completed: ["Over to you", "Your input", "What do you think?"],
        },
    },
    acknowledge: {
        displayName: "Gratitude",
        icon: HeartIcon,
        messages: {
            pending: "Getting ready...",
            running: "Thinking...",
            completed: "With gratitude",
            error: "Couldn't quite express that",
        },
        delightMessages: {
            completed: ["From the heart", "With care", "Truly appreciated"],
            fast: ["❤️"],
        },
    },
};

/**
 * Default configuration for unknown tools
 *
 * This is a fallback - if you see this in production, add the tool to TOOL_CONFIG.
 * The development warning will help catch missing configs.
 */
export const DEFAULT_TOOL_CONFIG: ToolConfig = {
    displayName: "Working",
    icon: SparkleIcon,
    messages: {
        pending: "Getting ready...",
        running: "Working on this...",
        completed: "Done",
        error: "Something went sideways. The robots are on it. 🤖",
    },
    delightMessages: {
        completed: ["Got it", "All set", "Ready"],
        fast: ["Quick!"],
    },
};

/**
 * Get tool configuration.
 *
 * @param toolName - Name of the tool
 * @param options - Configuration options
 * @param options.fallbackToDefault - If true, returns DEFAULT_TOOL_CONFIG for unknown tools instead of throwing.
 *                                     Use this in UI rendering contexts where graceful degradation is preferred.
 *                                     Defaults to false to enforce explicit tool configuration.
 *
 * @throws Error if tool is not configured and fallbackToDefault is false
 */
export function getToolConfig(
    toolName: string,
    options: { fallbackToDefault?: boolean } = {}
): ToolConfig {
    const config = TOOL_CONFIG[toolName];

    if (!config) {
        if (options.fallbackToDefault) {
            // Log warning in development to help catch missing configs
            if (process.env.NODE_ENV === "development") {
                logger.warn(
                    {
                        toolName,
                        fallback: true,
                        location: "lib/tools/tool-config.ts",
                    },
                    `Tool configuration missing for "${toolName}". Add to TOOL_CONFIG.`
                );
            }
            return DEFAULT_TOOL_CONFIG;
        }

        throw new Error(
            `Tool configuration missing for "${toolName}". ` +
                `Add configuration to TOOL_CONFIG in lib/tools/tool-config.ts`
        );
    }

    return config;
}

/**
 * Get a brief description for a tool call from its arguments.
 *
 * Used by ToolStatus for the collapsed view. Falls back gracefully
 * if the tool doesn't have a getDescription function or args are malformed.
 */
export function getToolDescription(
    toolName: string,
    args: Record<string, unknown> | undefined
): string | undefined {
    if (!args) return undefined;

    const config = getToolConfig(toolName, { fallbackToDefault: true });
    if (!config.getDescription) return undefined;

    try {
        return config.getDescription(args);
    } catch (error) {
        // Log in development to surface bugs in getDescription implementations
        if (process.env.NODE_ENV === "development") {
            logger.warn(
                { error, toolName, args },
                `Error extracting description for tool "${toolName}"`
            );
        }
        // Graceful degradation - don't crash if args are unexpected
        return undefined;
    }
}

// ============================================================================
// Delight utilities - hash-based probability for consistent, unpredictable joy
// ============================================================================

/**
 * Simple hash function for strings.
 * Produces consistent results for the same input.
 */
function simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash + char) | 0; // | 0 converts to 32-bit integer
    }
    return Math.abs(hash);
}

/**
 * Determine if we should show a delight variant.
 * Uses hash-based probability so the same ID always gets the same result.
 *
 * @param id - Unique identifier (e.g., tool call ID)
 * @param probability - Chance of delight (0.0 to 1.0)
 */
export function shouldDelight(id: string, probability: number): boolean {
    const hash = simpleHash(id);
    return hash % 100 < probability * 100;
}

/**
 * Select a message from an array using hash-based selection.
 * Same ID always selects the same message.
 */
export function selectMessage(id: string, messages: string[]): string {
    if (messages.length === 0) return "";
    const hash = simpleHash(id);
    return messages[hash % messages.length];
}

/**
 * Get the appropriate status message for a tool, with occasional delight.
 *
 * @param toolName - Name of the tool
 * @param status - Current status
 * @param toolCallId - Unique ID for this tool call (for consistent delight)
 * @param durationMs - How long the tool took (for fast completion messages)
 */
export function getStatusMessage(
    toolName: string,
    status: ToolStatus,
    toolCallId: string,
    durationMs?: number
): string {
    const config = getToolConfig(toolName);
    const baseMessage = config.messages[status];

    // Only add delight to completed status
    if (status !== "completed") {
        return baseMessage;
    }

    // Fast completion (under 500ms) - 20% chance of speed acknowledgment
    if (durationMs !== undefined && durationMs < 500) {
        const fastMessages = config.delightMessages?.fast;
        if (fastMessages && shouldDelight(toolCallId + "-fast", 0.2)) {
            return selectMessage(toolCallId, fastMessages);
        }
    }

    // Regular delight - 15% chance
    const delightMessages = config.delightMessages?.completed;
    if (delightMessages && shouldDelight(toolCallId, 0.15)) {
        return selectMessage(toolCallId, delightMessages);
    }

    return baseMessage;
}

// ============================================================================
// Thinking indicator messages - Carmenta's oracle voice
// ============================================================================

/**
 * On-brand loading messages that rotate during AI generation.
 * Carmenta = goddess of transformation, oracle, wisdom keeper.
 * All messages use "we" language per brand guidelines.
 */
export const THINKING_MESSAGES = [
    // Oracle/Wisdom themed
    "Consulting the oracle...",
    "Summoning wisdom...",
    "The muses are conferring...",
    "Gathering cosmic insights...",
    "Channeling the collective...",
    // Creative/Making themed
    "Brewing brilliance...",
    "Weaving words...",
    "Crafting something beautiful...",
    // Collaborative (we language)
    "We're onto something...",
    "Our thoughts are aligning...",
    "Brilliance incoming...",
];

/**
 * Messages shown after 8+ seconds - acknowledge the wait with warmth.
 */
export const LONG_WAIT_MESSAGES = [
    "Almost there...",
    "Worth the wait...",
    "The good stuff takes time...",
    "Still weaving...",
];

/**
 * Get a thinking message for rotation. Returns all messages for the component
 * to cycle through, plus metadata about timing.
 *
 * @param elapsedMs - How long we've been thinking
 * @returns The appropriate message pool for current elapsed time
 */
export function getThinkingMessages(elapsedMs: number): string[] {
    // After 8 seconds, switch to long wait messages
    if (elapsedMs >= 8000) {
        return LONG_WAIT_MESSAGES;
    }
    return THINKING_MESSAGES;
}

/**
 * Legacy function for backwards compatibility with tests.
 * Returns a single message based on elapsed time.
 */
export function getThinkingMessage(messageId: string, elapsedMs: number): string {
    const messages = getThinkingMessages(elapsedMs);
    return selectMessage(messageId, messages);
}

// ============================================================================
// Reasoning display messages (Claude Code-style variations)
// ============================================================================

/**
 * Reasoning completion messages - warm, human, no time.
 *
 * Time doesn't communicate value. "Reasoned for 3.8s" says nothing useful.
 * Instead, we use warm verbs that acknowledge the thinking happened.
 */
const REASONING_COMPLETE_MESSAGES = [
    "Thought it through",
    "Worked through it",
    "Figured it out",
    "Found clarity",
    "All sorted",
    "Considered carefully",
    "Explored this",
    "Understood",
];

/**
 * Delight variants with emojis (15% chance).
 */
const REASONING_COMPLETE_DELIGHT = [
    "Thought that through ✨",
    "Figured it out 💡",
    "Found clarity 🧠",
    "All sorted 💭",
];

/**
 * Get reasoning completion message.
 *
 * Cycles through warm verbs that acknowledge thinking happened.
 * Duration is intentionally not shown - it doesn't communicate value.
 *
 * @param reasoningId - Unique ID for consistent selection
 * @param _durationSeconds - Unused, kept for API compatibility
 */
export function getReasoningCompleteMessage(
    reasoningId: string,
    _durationSeconds: number
): string {
    // 15% chance of delight with emoji
    if (shouldDelight(reasoningId, 0.15)) {
        return selectMessage(reasoningId, REASONING_COMPLETE_DELIGHT);
    }

    // Standard rotation through warm messages
    return selectMessage(reasoningId, REASONING_COMPLETE_MESSAGES);
}

// ============================================================================
// Error messages with heart
// ============================================================================

/**
 * Get a warm error message for tool failures.
 */
export function getErrorMessage(toolName: string, errorText?: string): string {
    const config = getToolConfig(toolName, { fallbackToDefault: true });

    // If we have specific error text, wrap it warmly
    if (errorText) {
        return `Something went wrong: ${errorText}`;
    }

    return config.messages.error;
}

// ============================================================================
// First-time celebration tracking
// ============================================================================

const FIRST_USE_KEY = "carmenta-first-tool-use";

/**
 * Check if this is the first time using a tool in this session.
 * Returns true only once per tool per session.
 */
export function isFirstToolUse(toolName: string): boolean {
    if (typeof window === "undefined") return false;

    try {
        const usedTools = JSON.parse(
            sessionStorage.getItem(FIRST_USE_KEY) ?? "[]"
        ) as string[];

        if (usedTools.includes(toolName)) {
            return false;
        }

        // Mark as used
        sessionStorage.setItem(FIRST_USE_KEY, JSON.stringify([...usedTools, toolName]));
        return true;
    } catch {
        return false;
    }
}

/**
 * Get first-use celebration message for a tool.
 */
export function getFirstUseMessage(toolName: string): string | null {
    const config = getToolConfig(toolName, { fallbackToDefault: true });
    return `First ${config.displayName.toLowerCase()} check!`;
}
