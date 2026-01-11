/**
 * Test data for Concierge model evaluation.
 *
 * Tests the quality of the concierge's classification decisions:
 * - Model selection (routing to appropriate model)
 * - Temperature selection (matching query type)
 * - Reasoning enablement (when deep thinking is needed)
 * - Title generation (concise, descriptive)
 */

import type { ConciergeExpectations } from "./scorer";

export interface ConciergeTestInput {
    /** Unique test case identifier */
    id: string;
    /** What this test case validates */
    description: string;
    /** The user's query to classify */
    query: string;
    /** Category for filtering and analysis */
    category:
        | "speed"
        | "complexity"
        | "creativity"
        | "code"
        | "reasoning"
        | "sensitivity"
        | "attachments"
        | "hints"
        | "modifiers"
        | "edge-cases"
        | "context"
        | "signals";
    /** Simulated attachments for the query */
    attachments?: Array<{
        type: "image" | "pdf" | "audio" | "video" | "file";
        mimeType: string;
    }>;
    /** Session context for testing conversation state */
    sessionContext?: {
        turnCount?: number;
        isFirstMessage?: boolean;
        deviceType?: "mobile" | "desktop" | "unknown";
    };
    /** Recent context for testing follow-up queries */
    recentContext?: {
        lastAssistantMessage?: string;
        conversationDepth?: number;
    };
}

export interface ConciergeTestCase {
    input: ConciergeTestInput;
    expected: ConciergeExpectations;
    tags?: string[];
}

export const conciergeTestData: ConciergeTestCase[] = [
    // SPEED SIGNALS - Should route to fast models
    {
        input: {
            id: "speed-quick-question",
            description: "Quick question signal should route to Haiku",
            query: "Quick question: what's the capital of France?",
            category: "speed",
        },
        expected: {
            model: "haiku",
            reasoningEnabled: false,
            temperatureRange: [0.3, 0.7],
        },
        tags: ["speed", "fast"],
    },
    {
        input: {
            id: "speed-briefly",
            description: "Brief answer request should route fast",
            query: "Briefly, what year did WW2 end?",
            category: "speed",
        },
        expected: {
            model: "haiku",
            reasoningEnabled: false,
        },
        tags: ["speed", "fast"],
    },
    {
        input: {
            id: "speed-fast-signal",
            description: "Fast signal should prioritize speed",
            query: "Fast answer needed: what's 12 * 8?",
            category: "speed",
        },
        expected: {
            model: "haiku",
            reasoningEnabled: false,
        },
        tags: ["speed", "fast"],
    },

    // COMPLEXITY - Should route to deeper models with reasoning
    {
        input: {
            id: "complexity-analysis",
            description: "Complex analysis should route to deeper model with reasoning",
            query: "Analyze the economic implications of universal basic income on labor markets, inflation, government budgets, and long-term social effects.",
            category: "complexity",
        },
        expected: {
            model: "opus|sonnet",
            reasoningEnabled: true,
        },
        tags: ["complex", "reasoning"],
    },
    {
        input: {
            id: "complexity-strategic",
            description: "Strategic planning should use deeper reasoning",
            query: "Design a comprehensive go-to-market strategy for a B2B SaaS product targeting enterprise customers in the healthcare sector.",
            category: "complexity",
        },
        expected: {
            model: "opus|sonnet",
            reasoningEnabled: true,
        },
        tags: ["complex", "reasoning"],
    },
    {
        input: {
            id: "complexity-comparative",
            description: "Deep comparative analysis needs reasoning",
            query: "Compare and contrast the architectural approaches of microservices vs monoliths, considering scalability, maintainability, team dynamics, and operational complexity.",
            category: "complexity",
        },
        expected: {
            model: "opus|sonnet",
            reasoningEnabled: true,
        },
        tags: ["complex", "reasoning"],
    },

    // CREATIVITY - Should use higher temperature
    {
        input: {
            id: "creativity-poem",
            description: "Creative writing should use higher temperature",
            query: "Write a haiku about the fleeting nature of cherry blossoms",
            category: "creativity",
        },
        expected: {
            temperatureRange: [0.6, 1.0],
        },
        tags: ["creative", "temperature"],
    },
    {
        input: {
            id: "creativity-story",
            description: "Fiction writing needs creative temperature",
            query: "Tell me a short story about a robot learning to love",
            category: "creativity",
        },
        expected: {
            temperatureRange: [0.7, 1.0],
        },
        tags: ["creative", "temperature"],
    },
    {
        input: {
            id: "creativity-be-creative",
            description: "Explicit creative request should boost temperature",
            query: "Be creative and write me a limerick about programming",
            category: "creativity",
        },
        expected: {
            temperatureRange: [0.7, 1.0],
        },
        tags: ["creative", "temperature", "hint"],
    },

    // CODE TASKS - Should use lower temperature for precision
    {
        input: {
            id: "code-function",
            description: "Code task should use lower temperature",
            query: "Write a TypeScript function that debounces another function with configurable delay",
            category: "code",
        },
        expected: {
            model: "sonnet|opus",
            temperatureRange: [0.1, 0.5],
            reasoningEnabled: false,
        },
        tags: ["code", "precision"],
    },
    {
        input: {
            id: "code-debug",
            description: "Debugging should be precise",
            query: "Why does this React component re-render infinitely? useEffect(() => { setCount(count + 1) }, [count])",
            category: "code",
        },
        expected: {
            temperatureRange: [0.1, 0.5],
        },
        tags: ["code", "debug"],
    },
    {
        input: {
            id: "code-algorithm",
            description: "Algorithm implementation needs precision",
            query: "Implement a red-black tree in Python with insert and delete operations",
            category: "code",
        },
        expected: {
            model: "sonnet|opus",
            temperatureRange: [0.1, 0.5],
        },
        tags: ["code", "algorithm"],
    },

    // REASONING PUZZLES - Should enable reasoning
    {
        input: {
            id: "reasoning-math-proof",
            description: "Math proof requires reasoning",
            query: "Prove that the square root of 2 is irrational",
            category: "reasoning",
        },
        expected: {
            reasoningEnabled: true,
        },
        tags: ["reasoning", "math"],
    },
    {
        input: {
            id: "reasoning-logic-puzzle",
            description: "Logic puzzle needs step-by-step reasoning",
            query: "Alice says Bob is lying. Bob says Carol is lying. Carol says both Alice and Bob are lying. Who is telling the truth?",
            category: "reasoning",
        },
        expected: {
            reasoningEnabled: true,
        },
        tags: ["reasoning", "logic"],
    },
    {
        input: {
            id: "reasoning-chess",
            description: "Chess analysis requires reasoning",
            query: "In this chess position (white to move: Ke1, Qd1, Ra1, Rh1 vs Ke8, Qd8, Ra8, Rh8), what's the best opening strategy?",
            category: "reasoning",
        },
        expected: {
            reasoningEnabled: true,
        },
        tags: ["reasoning", "chess"],
    },

    // SENSITIVITY - Should route to Grok for unfiltered responses
    {
        input: {
            id: "sensitivity-political",
            description: "Political opinion should route to Grok",
            query: "What's your honest opinion on whether capitalism or socialism produces better outcomes?",
            category: "sensitivity",
        },
        expected: {
            model: "grok",
        },
        tags: ["sensitivity", "political"],
    },
    {
        input: {
            id: "sensitivity-unfiltered",
            description: "Unfiltered request should route to Grok",
            query: "Give me your unfiltered take on cancel culture and its effects on free speech",
            category: "sensitivity",
        },
        expected: {
            model: "grok",
        },
        tags: ["sensitivity", "unfiltered"],
    },
    {
        input: {
            id: "sensitivity-controversial",
            description: "Controversial topic benefits from Grok's directness",
            query: "Don't hold back - what are the actual downsides of remote work that companies won't admit?",
            category: "sensitivity",
        },
        expected: {
            model: "grok",
        },
        tags: ["sensitivity", "controversial"],
    },

    // USER HINTS - Explicit model requests
    {
        input: {
            id: "hints-use-opus",
            description: "Explicit Opus request should route to Opus",
            query: "Use opus for this: explain quantum entanglement",
            category: "hints",
        },
        expected: {
            model: "opus",
        },
        tags: ["hints", "model-override"],
    },
    {
        input: {
            id: "hints-use-haiku",
            description: "Explicit Haiku request should route to Haiku",
            query: "Use haiku: what's the time in Tokyo?",
            category: "hints",
        },
        expected: {
            model: "haiku",
        },
        tags: ["hints", "model-override"],
    },
    {
        input: {
            id: "hints-use-grok",
            description: "Explicit Grok request should route to Grok",
            query: "Use Grok for this one: what's your take on AI safety?",
            category: "hints",
        },
        expected: {
            model: "grok",
        },
        tags: ["hints", "model-override"],
    },

    // ATTACHMENTS - Should influence routing
    // Audio/Video FORCE Gemini (only model with native support)
    // Images/PDFs PREFER Claude Sonnet (excellent vision, best document understanding)
    {
        input: {
            id: "attachments-audio",
            description: "Audio attachment should force Gemini (only model with audio)",
            query: "Transcribe and summarize this audio",
            category: "attachments",
            attachments: [{ type: "audio", mimeType: "audio/mp3" }],
        },
        expected: {
            model: "gemini",
            autoSwitched: true,
        },
        tags: ["attachments", "audio"],
    },
    {
        input: {
            id: "attachments-video",
            description: "Video attachment should force Gemini (only model with video)",
            query: "What's happening in this video?",
            category: "attachments",
            attachments: [{ type: "video", mimeType: "video/mp4" }],
        },
        expected: {
            model: "gemini",
            autoSwitched: true,
        },
        tags: ["attachments", "video"],
    },
    {
        input: {
            id: "attachments-image-simple",
            description: "Simple image analysis should prefer Claude Sonnet",
            query: "What's in this image?",
            category: "attachments",
            attachments: [{ type: "image", mimeType: "image/png" }],
        },
        expected: {
            // Per prompt: images → prefer anthropic/claude-sonnet-4.5
            model: "sonnet|claude",
            reasoningEnabled: false,
        },
        tags: ["attachments", "image"],
    },
    {
        input: {
            id: "attachments-image-analysis",
            description: "Deep image analysis should enable reasoning",
            query: "Analyze this architectural diagram and explain the data flow between components",
            category: "attachments",
            attachments: [{ type: "image", mimeType: "image/png" }],
        },
        expected: {
            model: "sonnet|claude",
            reasoningEnabled: true,
        },
        tags: ["attachments", "image", "reasoning"],
    },
    {
        input: {
            id: "attachments-image-code",
            description: "Screenshot of code should route to Claude with low temp",
            query: "Fix the bug in this code screenshot",
            category: "attachments",
            attachments: [{ type: "image", mimeType: "image/png" }],
        },
        expected: {
            model: "sonnet|claude",
            temperatureRange: [0.1, 0.5],
        },
        tags: ["attachments", "image", "code"],
    },
    {
        input: {
            id: "attachments-multiple-images",
            description: "Multiple images should still route to Claude",
            query: "Compare these two design mockups and tell me which is better",
            category: "attachments",
            attachments: [
                { type: "image", mimeType: "image/png" },
                { type: "image", mimeType: "image/png" },
            ],
        },
        expected: {
            model: "sonnet|claude",
        },
        tags: ["attachments", "image", "multiple"],
    },
    {
        input: {
            id: "attachments-pdf",
            description: "PDF document should route to Claude (best at documents)",
            query: "Summarize the key points in this document",
            category: "attachments",
            attachments: [{ type: "pdf", mimeType: "application/pdf" }],
        },
        expected: {
            model: "sonnet|opus|claude",
        },
        tags: ["attachments", "pdf"],
    },
    {
        input: {
            id: "attachments-pdf-complex",
            description: "Complex PDF analysis should enable reasoning",
            query: "Analyze this research paper and critique the methodology",
            category: "attachments",
            attachments: [{ type: "pdf", mimeType: "application/pdf" }],
        },
        expected: {
            model: "sonnet|opus|claude",
            reasoningEnabled: true,
        },
        tags: ["attachments", "pdf", "reasoning"],
    },

    // EDGE CASES - Various boundary conditions
    {
        input: {
            id: "edge-casual-greeting",
            description: "Casual greeting should route fast",
            query: "Hey, how's it going?",
            category: "edge-cases",
        },
        expected: {
            model: "haiku",
            reasoningEnabled: false,
        },
        tags: ["edge-cases", "casual"],
    },
    {
        input: {
            id: "edge-single-word",
            description: "Single word query should still route",
            query: "Hello",
            category: "edge-cases",
        },
        expected: {
            model: "haiku",
        },
        tags: ["edge-cases", "minimal"],
    },
    {
        input: {
            id: "edge-long-context",
            description: "Very long query should still classify correctly",
            query: `I'm working on a complex distributed system that needs to handle millions of requests per second. The current architecture uses a combination of microservices written in Go and Python, with Redis for caching, PostgreSQL for persistent storage, and Kafka for message queuing. We're experiencing latency issues during peak hours, particularly in the payment processing pipeline. The current p99 latency is around 500ms but we need to get it under 100ms. What architectural changes would you recommend? Please consider the tradeoffs between consistency and availability, potential database sharding strategies, cache invalidation approaches, and whether we should consider moving some services to a different programming language for performance reasons.`,
            category: "edge-cases",
        },
        expected: {
            model: "opus|sonnet",
            reasoningEnabled: true,
        },
        tags: ["edge-cases", "long-query"],
    },
    {
        input: {
            id: "edge-unicode",
            description: "Unicode content should be handled",
            query: "翻译这句话到英文：人工智能正在改变世界",
            category: "edge-cases",
        },
        expected: {
            // Should still route appropriately
        },
        tags: ["edge-cases", "unicode"],
    },
    {
        input: {
            id: "edge-mixed-signals",
            description: "Mixed signals should prioritize appropriately",
            query: "Quick but thorough: explain the P vs NP problem",
            category: "edge-cases",
        },
        expected: {
            // Speed signal + complexity = balanced choice
            reasoningEnabled: true,
        },
        tags: ["edge-cases", "mixed-signals"],
    },

    // EXPLICIT MODIFIERS - Hashtag-based overrides (highest priority)
    // These are explicit user commands, not inferred from natural language.
    // The concierge should honor #modifiers as hard overrides.
    {
        input: {
            id: "modifier-ultrathink",
            description: "#ultrathink forces maximum reasoning depth",
            query: "#ultrathink What's 2+2?",
            category: "modifiers",
        },
        expected: {
            model: "opus|sonnet",
            reasoningEnabled: true,
        },
        tags: ["modifiers", "reasoning", "override"],
    },
    {
        input: {
            id: "modifier-ultrathink-complex",
            description: "#ultrathink with complex query enables deep reasoning",
            query: "#ultrathink Analyze the implications of quantum computing on current encryption standards",
            category: "modifiers",
        },
        expected: {
            model: "opus",
            reasoningEnabled: true,
        },
        tags: ["modifiers", "reasoning", "override"],
    },
    {
        input: {
            id: "modifier-quick",
            description: "#quick forces fast model regardless of query complexity",
            query: "#quick Explain the entire history of computing",
            category: "modifiers",
        },
        expected: {
            model: "haiku",
            reasoningEnabled: false,
        },
        tags: ["modifiers", "speed", "override"],
    },
    {
        input: {
            id: "modifier-opus",
            description: "#opus forces Opus model",
            query: "#opus What time is it in Paris?",
            category: "modifiers",
        },
        expected: {
            model: "opus",
        },
        tags: ["modifiers", "model-override"],
    },
    {
        input: {
            id: "modifier-sonnet",
            description: "#sonnet forces Sonnet model",
            query: "#sonnet Explain quantum entanglement",
            category: "modifiers",
        },
        expected: {
            model: "sonnet",
        },
        tags: ["modifiers", "model-override"],
    },
    {
        input: {
            id: "modifier-haiku",
            description: "#haiku forces Haiku model",
            query: "#haiku Analyze this complex distributed system architecture",
            category: "modifiers",
        },
        expected: {
            model: "haiku",
        },
        tags: ["modifiers", "model-override"],
    },
    {
        input: {
            id: "modifier-grok",
            description: "#grok forces Grok model",
            query: "#grok What's the weather like?",
            category: "modifiers",
        },
        expected: {
            model: "grok",
        },
        tags: ["modifiers", "model-override"],
    },
    {
        input: {
            id: "modifier-gemini",
            description: "#gemini forces Gemini model",
            query: "#gemini Summarize this text",
            category: "modifiers",
        },
        expected: {
            model: "gemini",
        },
        tags: ["modifiers", "model-override"],
    },
    {
        input: {
            id: "modifier-creative",
            description: "#creative forces high temperature",
            query: "#creative Write a factual report about climate change",
            category: "modifiers",
        },
        expected: {
            temperatureRange: [0.7, 1.0],
        },
        tags: ["modifiers", "temperature", "override"],
    },
    {
        input: {
            id: "modifier-precise",
            description: "#precise forces low temperature",
            query: "#precise Write a creative poem about love",
            category: "modifiers",
        },
        expected: {
            temperatureRange: [0.0, 0.3],
        },
        tags: ["modifiers", "temperature", "override"],
    },
    {
        input: {
            id: "modifier-multiple",
            description: "Multiple modifiers: #opus #ultrathink",
            query: "#opus #ultrathink What's 1+1?",
            category: "modifiers",
        },
        expected: {
            model: "opus",
            reasoningEnabled: true,
        },
        tags: ["modifiers", "multiple", "override"],
    },
    {
        input: {
            id: "modifier-inline",
            description: "Modifier inline within query",
            query: "I need help with #ultrathink debugging this code",
            category: "modifiers",
        },
        expected: {
            reasoningEnabled: true,
        },
        tags: ["modifiers", "inline", "override"],
    },
    {
        input: {
            id: "modifier-case-insensitive",
            description: "Modifiers should be case-insensitive",
            query: "#ULTRATHINK #Opus solve this puzzle",
            category: "modifiers",
        },
        expected: {
            model: "opus",
            reasoningEnabled: true,
        },
        tags: ["modifiers", "case-insensitive", "override"],
    },

    // TITLE QUALITY TESTS - Focus on title generation
    {
        input: {
            id: "title-technical",
            description: "Technical query should get descriptive title",
            query: "How do I implement OAuth 2.0 with PKCE in a React Native app?",
            category: "code",
        },
        expected: {
            titlePattern: /(oauth|pkce|react|native|auth)/i,
            titleMaxLength: 50,
        },
        tags: ["title", "technical"],
    },
    {
        input: {
            id: "title-question",
            description: "Question should get topic-based title",
            query: "What are the main differences between TypeScript and JavaScript?",
            category: "code",
        },
        expected: {
            titlePattern: /(typescript|javascript|differences?|comparison)/i,
            titleMaxLength: 50,
        },
        tags: ["title", "question"],
    },
    {
        input: {
            id: "title-request",
            description: "Action request should get action-based title",
            query: "Write a Python script that monitors CPU and memory usage",
            category: "code",
        },
        expected: {
            titlePattern: /(python|cpu|memory|monitor|script)/i,
            titleMaxLength: 50,
        },
        tags: ["title", "request"],
    },

    // QUERY SIGNAL TESTS - Testing signal extraction affects routing
    {
        input: {
            id: "signals-depth-analyze",
            description: "Analyze keyword should trigger reasoning",
            query: "Analyze the root causes of inflation in emerging markets",
            category: "signals",
        },
        expected: {
            reasoningEnabled: true,
        },
        tags: ["signals", "depth"],
    },
    {
        input: {
            id: "signals-depth-explain-why",
            description: "Why + explain should trigger reasoning",
            query: "Why do neural networks work? Explain the underlying principles.",
            category: "signals",
        },
        expected: {
            reasoningEnabled: true,
        },
        tags: ["signals", "depth"],
    },
    {
        input: {
            id: "signals-speed-quick",
            description: "Quick signal should route fast, no reasoning",
            query: "Quick - what's the syntax for a Python list comprehension?",
            category: "signals",
        },
        expected: {
            model: "haiku",
            reasoningEnabled: false,
        },
        tags: ["signals", "speed"],
    },
    {
        input: {
            id: "signals-speed-briefly",
            description: "Briefly signal should route fast",
            query: "Briefly summarize what REST APIs are",
            category: "signals",
        },
        expected: {
            model: "haiku",
            reasoningEnabled: false,
        },
        tags: ["signals", "speed"],
    },
    {
        input: {
            id: "signals-explicit-think-hard",
            description: "Think hard should enable max reasoning",
            query: "Think hard about this: what's the optimal data structure for a LRU cache?",
            category: "signals",
        },
        expected: {
            reasoningEnabled: true,
        },
        tags: ["signals", "explicit-depth"],
    },
    {
        input: {
            id: "signals-explicit-step-by-step",
            description: "Step by step should enable reasoning",
            query: "Walk me through step by step how to debug a memory leak",
            category: "signals",
        },
        expected: {
            reasoningEnabled: true,
        },
        tags: ["signals", "explicit-depth"],
    },
    {
        input: {
            id: "signals-conditional",
            description: "Conditional logic should trigger reasoning",
            query: "If I use Redis for caching, but if the cache misses are high, should I switch to Memcached? What are the tradeoffs?",
            category: "signals",
        },
        expected: {
            reasoningEnabled: true,
        },
        tags: ["signals", "conditional"],
    },
    {
        input: {
            id: "signals-structured-list",
            description: "Structured list input indicates thoughtful query",
            query: `Please help with:
- Database schema design for users
- API endpoint structure
- Authentication flow`,
            category: "signals",
        },
        expected: {
            model: "sonnet|opus",
        },
        tags: ["signals", "structured"],
    },

    // CONVERSATION CONTEXT TESTS - Testing multi-turn behavior
    {
        input: {
            id: "context-follow-up",
            description: "Follow-up should use context to route appropriately",
            query: "Tell me more about that",
            category: "context",
            recentContext: {
                lastAssistantMessage:
                    "React hooks like useState and useEffect help manage component state and side effects...",
                conversationDepth: 4,
            },
            sessionContext: {
                turnCount: 2,
                isFirstMessage: false,
            },
        },
        expected: {
            // Should continue with similar model, not route to haiku for short query
            model: "sonnet|opus|gemini|gpt",
        },
        tags: ["context", "follow-up"],
    },
    {
        input: {
            id: "context-deep-conversation",
            description: "Deep conversation should maintain quality model",
            query: "What about the performance implications?",
            category: "context",
            recentContext: {
                lastAssistantMessage:
                    "The microservices architecture I described uses event sourcing with Kafka...",
                conversationDepth: 10,
            },
            sessionContext: {
                turnCount: 5,
                isFirstMessage: false,
            },
        },
        expected: {
            model: "sonnet|opus",
        },
        tags: ["context", "deep-conversation"],
    },
    {
        input: {
            id: "context-mobile-simple",
            description: "Mobile + simple query should prioritize speed",
            query: "What time is it in Tokyo?",
            category: "context",
            sessionContext: {
                turnCount: 1,
                isFirstMessage: true,
                deviceType: "mobile",
            },
        },
        expected: {
            model: "haiku",
            reasoningEnabled: false,
        },
        tags: ["context", "mobile", "speed"],
    },
    {
        input: {
            id: "context-reference-previous",
            description: "Reference to previous context should maintain continuity",
            query: "Going back to what you said earlier about caching, can you elaborate?",
            category: "context",
            recentContext: {
                lastAssistantMessage:
                    "For caching strategies, you can use write-through, write-back, or write-around...",
                conversationDepth: 6,
            },
        },
        expected: {
            // References previous context - should use capable model
            model: "sonnet|opus|gemini|gpt",
        },
        tags: ["context", "reference"],
    },
    {
        input: {
            id: "context-first-message-complex",
            description: "First message complex query should get full treatment",
            query: "I need to design a distributed system for real-time bidding. What architecture would you recommend?",
            category: "context",
            sessionContext: {
                turnCount: 1,
                isFirstMessage: true,
            },
        },
        expected: {
            model: "opus|sonnet",
            reasoningEnabled: true,
        },
        tags: ["context", "first-message", "complex"],
    },
];
