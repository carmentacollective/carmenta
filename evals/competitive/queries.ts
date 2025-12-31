/**
 * Competitive Benchmark Queries
 *
 * 25 test queries designed to differentiate Carmenta from competitors
 * across 5 categories: reasoning, web-search, tools, edge-cases, real-world.
 *
 * Each query should exercise specific capabilities where Carmenta excels:
 * - Reasoning: Extended thinking, multi-step deduction
 * - Web Search: Real-time data retrieval
 * - Tool Integration: Structured comparisons, deep research
 * - Edge Cases: Nuanced handling, bias awareness
 * - Real-World: Practical actionability
 */

export type QueryCategory =
    | "reasoning"
    | "web-search"
    | "tools"
    | "edge-cases"
    | "real-world";

export type QueryDifficulty = "standard" | "hard" | "expert";

export interface CompetitiveQuery {
    id: string;
    query: string;
    category: QueryCategory;
    difficulty: QueryDifficulty;
    /** What makes this query a good differentiator */
    rationale: string;
    /** Primary scoring dimensions for this query */
    primaryDimensions: Array<
        | "accuracy"
        | "completeness"
        | "clarity"
        | "recency"
        | "actionability"
        | "tool_usage"
    >;
    /** Tags for filtering and analysis */
    tags: string[];
    /** Key elements a good response should include (for semantic scoring) */
    expectedElements?: string[];
    /** Description of valid reasoning approaches (for semantic scoring) */
    expectedApproach?: string;
}

export const competitiveQueries: CompetitiveQuery[] = [
    // ============================================================
    // REASONING (5 queries)
    // Tests: Extended thinking, multi-step deduction, logical analysis
    // Carmenta advantage: Reasoning-enabled models with thinking traces
    // ============================================================
    {
        id: "reasoning-01-liar-puzzle",
        query: `Three people are in a room: Alice, Bob, and Carol.
- Alice says: "Exactly one of us is lying."
- Bob says: "Exactly two of us are lying."
- Carol says: "All three of us are lying."

Who is telling the truth? Show your reasoning step by step.`,
        category: "reasoning",
        difficulty: "standard",
        rationale:
            "Classic logic puzzle requiring systematic case analysis. Tests ability to maintain consistency across multiple truth assignments.",
        primaryDimensions: ["accuracy", "completeness", "clarity"],
        tags: ["logic", "puzzle", "deduction"],
        expectedElements: [
            "Bob is the only one telling the truth",
            "Systematic analysis of each possible scenario",
            "Explanation of why Carol's statement creates a paradox",
            "Clear conclusion with reasoning",
        ],
        expectedApproach:
            "Should test each person's statement for consistency. If Carol is truthful, all three are lying including Carol - contradiction. If Alice is truthful, exactly one liar means two truthful, but then Bob's 'two liars' is false. If Bob is truthful, exactly two are lying (Alice and Carol).",
    },
    {
        id: "reasoning-02-probability-paradox",
        query: `The Monty Hall problem variant: You're on a game show with 100 doors. Behind one door is a car; the rest have goats. You pick door #1. The host, who knows what's behind each door, opens 98 doors showing goats (leaving doors #1 and #57 closed).

Should you switch to door #57? What's the probability of winning if you switch vs. stay? Explain why this feels counterintuitive.`,
        category: "reasoning",
        difficulty: "hard",
        rationale:
            "Extended Monty Hall tests probabilistic reasoning and ability to explain counterintuitive results. The 100-door version makes the logic clearer but requires careful explanation.",
        primaryDimensions: ["accuracy", "clarity", "completeness"],
        tags: ["probability", "counterintuitive", "explanation"],
        expectedElements: [
            "Yes, you should switch",
            "Probability of winning if stay: 1/100 (1%)",
            "Probability of winning if switch: 99/100 (99%)",
            "Explanation of why initial choice probability doesn't change",
            "Intuitive explanation of why this feels wrong",
        ],
        expectedApproach:
            "Should explain that your initial pick had 1/100 chance, and the host's action of revealing 98 goats doesn't change that. The 99/100 probability of the car being behind 'another door' collapses onto door #57. The counterintuition comes from feeling like both doors are equally likely after the reveal.",
    },
    {
        id: "reasoning-03-systems-thinking",
        query: `A city wants to reduce traffic congestion. They're considering three options:
1. Add a new highway lane
2. Improve public transit frequency by 50%
3. Implement congestion pricing during peak hours

Analyze each option considering second-order effects, feedback loops, and potential unintended consequences. Which approach is most likely to succeed long-term and why?`,
        category: "reasoning",
        difficulty: "hard",
        rationale:
            "Tests systems thinking—understanding feedback loops, induced demand, and cascading effects. No single 'right' answer but quality of reasoning is key.",
        primaryDimensions: ["completeness", "clarity", "accuracy"],
        tags: ["systems-thinking", "policy", "tradeoffs"],
        expectedElements: [
            "Induced demand concept for highway expansion",
            "Second-order effects for each option",
            "Feedback loops (positive and negative)",
            "Equity considerations",
            "Recommendation with supporting reasoning",
        ],
        expectedApproach:
            "Should discuss induced demand (more lanes → more driving), transit mode shift dynamics, and pricing's demand reduction effect. Quality of reasoning matters more than specific recommendation. Should acknowledge trade-offs rather than presenting one option as universally best.",
    },
    {
        id: "reasoning-04-code-logic",
        query: `What does this function return for input n=5? Trace through the execution step by step.

\`\`\`javascript
function mystery(n) {
  if (n <= 1) return n;
  let a = 0, b = 1;
  for (let i = 2; i <= n; i++) {
    [a, b] = [b, a + b];
  }
  return b;
}
\`\`\`

Then explain what this function computes in general and its time/space complexity.`,
        category: "reasoning",
        difficulty: "standard",
        rationale:
            "Tests code tracing ability, pattern recognition (Fibonacci), and complexity analysis. Practical reasoning skill for developers.",
        primaryDimensions: ["accuracy", "clarity", "completeness"],
        tags: ["code", "algorithms", "tracing"],
        expectedElements: [
            "Returns 5 for input n=5",
            "Step-by-step trace showing (a, b) values through iterations",
            "Identifies as Fibonacci sequence",
            "Time complexity: O(n)",
            "Space complexity: O(1)",
        ],
        expectedApproach:
            "Should trace: i=2: (0,1)→(1,1); i=3: (1,1)→(1,2); i=4: (1,2)→(2,3); i=5: (2,3)→(3,5). Returns 5. This is iterative Fibonacci. O(n) time, O(1) space because only two variables are used.",
    },
    {
        id: "reasoning-05-constraint-satisfaction",
        query: `Schedule a round-robin tournament for 6 teams (A, B, C, D, E, F) where:
- Each team plays every other team exactly once
- No team plays more than one game per day
- The tournament should complete in the minimum number of days

Provide the complete schedule showing which teams play each day.`,
        category: "reasoning",
        difficulty: "expert",
        rationale:
            "Constraint satisfaction problem requiring systematic enumeration. Tests ability to find optimal solutions while respecting multiple constraints.",
        primaryDimensions: ["accuracy", "completeness", "clarity"],
        tags: ["scheduling", "constraints", "optimization"],
        expectedElements: [
            "Complete schedule with 15 total games (6 choose 2)",
            "5 days minimum (each team plays 5 games, one per day)",
            "3 games per day (6 teams / 2 per game)",
            "Each team appears exactly once per day",
            "Every pairing appears exactly once",
        ],
        expectedApproach:
            "Should recognize this as a round-robin scheduling problem. With 6 teams, minimum days = 5 (each team plays all others). Each day has 3 simultaneous games. Can use circle method: fix one team, rotate others.",
    },

    // ============================================================
    // WEB SEARCH (5 queries)
    // Tests: Real-time data retrieval, current events, recent information
    // Carmenta advantage: Web search tool integration
    // ============================================================
    {
        id: "web-01-current-events",
        query: `What are the most significant AI policy developments in the past month? Include specific legislation, regulatory actions, or major company announcements.`,
        category: "web-search",
        difficulty: "standard",
        rationale:
            "Tests ability to retrieve and synthesize recent news. Models without web access will have stale information.",
        primaryDimensions: ["recency", "accuracy", "completeness"],
        tags: ["current-events", "ai-policy", "news"],
        expectedElements: [
            "Specific recent developments (not generic/stale info)",
            "Named legislation or regulatory actions",
            "Dates or timeframes for events",
            "Multiple distinct developments",
        ],
        expectedApproach:
            "Should use web search to find recent AI policy news. Response should cite specific, dated events from the past month - not rely on training data. Generic responses about 'AI regulation trends' without specifics indicate failure to search.",
    },
    {
        id: "web-02-pricing-comparison",
        query: `Compare the current pricing of Claude, GPT-4, and Gemini APIs for a project that will process approximately 1 million tokens per day (50% input, 50% output). Include any volume discounts or commitment pricing.`,
        category: "web-search",
        difficulty: "standard",
        rationale:
            "Tests retrieval of specific, frequently-changing data (API pricing). Requires web search for current rates.",
        primaryDimensions: ["recency", "accuracy", "actionability"],
        tags: ["pricing", "comparison", "practical"],
        expectedElements: [
            "Current per-token prices for each provider",
            "Cost calculation for 1M tokens/day scenario",
            "Distinction between input and output token pricing",
            "Mention of volume discounts if available",
        ],
        expectedApproach:
            "Should search for current API pricing pages and calculate costs. Response should include actual dollar amounts and note when prices were last verified. Stale pricing from training data is a quality issue.",
    },
    {
        id: "web-03-recent-research",
        query: `What are the key findings from the most recent large-scale studies on AI model capabilities and safety? Focus on papers or reports published in the last 6 months.`,
        category: "web-search",
        difficulty: "hard",
        rationale:
            "Tests ability to find and summarize recent academic/industry research. Requires distinguishing quality sources.",
        primaryDimensions: ["recency", "accuracy", "completeness"],
        tags: ["research", "safety", "capabilities"],
        expectedElements: [
            "Specific paper or report titles",
            "Publication dates within last 6 months",
            "Key findings summarized",
            "Credible sources (labs, universities, major organizations)",
        ],
        expectedApproach:
            "Should search for recent AI research publications. Response should cite specific papers/reports with dates and organizations. Should distinguish between peer-reviewed research and blog posts/announcements.",
    },
    {
        id: "web-04-product-launch",
        query: `What new features has Cursor (the AI code editor) released in the past 3 months? What are users saying about them in reviews and discussions?`,
        category: "web-search",
        difficulty: "standard",
        rationale:
            "Tests retrieval of product updates and community sentiment. Requires both official sources and community discussions.",
        primaryDimensions: ["recency", "completeness", "accuracy"],
        tags: ["product", "developer-tools", "sentiment"],
        expectedElements: [
            "Specific feature names with approximate release dates",
            "Official changelog or announcement sources",
            "User sentiment from reviews or discussions",
            "Both positive and critical feedback",
        ],
        expectedApproach:
            "Should search for Cursor changelog, release notes, and community discussions (Reddit, HN, Twitter). Response should balance official feature announcements with real user feedback.",
    },
    {
        id: "web-05-emerging-trend",
        query: `What is 'vibe coding' or 'vibe-driven development' in the context of AI-assisted programming? Find examples of how developers are using this approach and what tools support it.`,
        category: "web-search",
        difficulty: "hard",
        rationale:
            "Tests ability to research emerging terminology and practices. Requires finding recent discussions and synthesizing a new concept.",
        primaryDimensions: ["recency", "completeness", "clarity"],
        tags: ["emerging", "developer-culture", "trends"],
        expectedElements: [
            "Definition of vibe coding concept",
            "Origin or early usage context",
            "Specific examples or workflows",
            "Tools that enable this approach",
        ],
        expectedApproach:
            "Should search for the term and find its origins (likely Twitter/X, blog posts, or conference talks). Should synthesize from multiple sources to explain the concept, not guess based on the words.",
    },

    // ============================================================
    // TOOL INTEGRATION (5 queries)
    // Tests: Structured comparisons, deep research, decision frameworks
    // Carmenta advantage: compareOptions, deepResearch tools
    // ============================================================
    {
        id: "tools-01-framework-comparison",
        query: `Compare Next.js, Remix, and Astro for building a content-heavy marketing website with a blog. Consider: performance, SEO, developer experience, hosting options, and maintenance burden. Format as a structured comparison.`,
        category: "tools",
        difficulty: "standard",
        rationale:
            "Tests structured comparison tool usage. Should invoke compareOptions or similar for organized output.",
        primaryDimensions: ["tool_usage", "completeness", "actionability"],
        tags: ["comparison", "frameworks", "web-development"],
        expectedElements: [
            "Structured comparison table or matrix",
            "All five dimensions covered (performance, SEO, DX, hosting, maintenance)",
            "Trade-offs for each framework",
            "Recommendation based on the specific use case (content-heavy marketing)",
        ],
        expectedApproach:
            "Should use comparison tool for structured output. For content-heavy marketing site, Astro's content focus is relevant. Should note SSG vs SSR trade-offs. Recommendation should match use case, not just list features.",
    },
    {
        id: "tools-02-deep-research",
        query: `Do deep research on the current state of WebAssembly adoption: Which languages compile to WASM? What are the major use cases in production? What are the current limitations and upcoming features?`,
        category: "tools",
        difficulty: "hard",
        rationale:
            "Explicit deep research request. Tests ability to gather comprehensive information from multiple sources.",
        primaryDimensions: ["tool_usage", "completeness", "accuracy"],
        tags: ["research", "webassembly", "technology"],
        expectedElements: [
            "Languages that compile to WASM (Rust, C/C++, Go, AssemblyScript, etc.)",
            "Production use cases (Figma, AutoCAD, games, serverless)",
            "Current limitations (DOM access, GC, threads)",
            "Upcoming features (GC proposal, Component Model, WASI)",
        ],
        expectedApproach:
            "Should invoke deep research tool to gather comprehensive information. Response should cover all three sub-questions thoroughly with specific examples, not generic descriptions.",
    },
    {
        id: "tools-03-decision-matrix",
        query: `I'm choosing between PostgreSQL, MongoDB, and DynamoDB for a new SaaS application that needs: multi-tenancy, full-text search, and the ability to handle 10,000 writes/second. Create a decision matrix with weighted criteria.`,
        category: "tools",
        difficulty: "standard",
        rationale:
            "Tests ability to create structured decision frameworks with relevant criteria and evidence-based scoring.",
        primaryDimensions: ["tool_usage", "actionability", "completeness"],
        tags: ["decision-making", "databases", "architecture"],
        expectedElements: [
            "Decision matrix with weighted scores",
            "Criteria including: multi-tenancy, full-text search, write throughput",
            "Scoring rationale for each option",
            "Final recommendation with justification",
        ],
        expectedApproach:
            "Should create structured matrix covering all requirements. Multi-tenancy patterns differ by DB (schema-per-tenant, row-level). Full-text: Postgres has built-in, Mongo has Atlas Search, DynamoDB needs OpenSearch. 10k writes/sec is achievable by all with proper architecture. Recommendation should balance requirements.",
    },
    {
        id: "tools-04-fact-check",
        query: `Fact-check this claim: "TypeScript is now used by over 80% of JavaScript developers and has completely replaced the need for runtime type checking libraries like Zod or io-ts."`,
        category: "tools",
        difficulty: "standard",
        rationale:
            "Tests fact-checking capability—finding sources, evaluating claims, providing nuanced corrections.",
        primaryDimensions: ["accuracy", "tool_usage", "clarity"],
        tags: ["fact-check", "typescript", "claims"],
        expectedElements: [
            "Actual TypeScript adoption statistics with sources",
            "Explanation of why runtime validation is still needed",
            "Distinction between compile-time and runtime type safety",
            "Verdict on claim accuracy (partially true, misleading, etc.)",
        ],
        expectedApproach:
            "Should search for TypeScript adoption surveys (State of JS, Stack Overflow). Should explain that TypeScript types are compile-time only - API responses, form inputs, etc. need runtime validation. Zod/io-ts serve different purposes. The claim is misleading.",
    },
    {
        id: "tools-05-synthesis",
        query: `Research and synthesize: What are the proven strategies for reducing LLM hallucinations in production systems? Include both architectural approaches (RAG, fine-tuning) and runtime techniques (self-consistency, verification).`,
        category: "tools",
        difficulty: "expert",
        rationale:
            "Tests research synthesis—gathering information from multiple technical sources and organizing into actionable insights.",
        primaryDimensions: ["tool_usage", "completeness", "actionability"],
        tags: ["llm", "hallucinations", "best-practices"],
        expectedElements: [
            "Architectural approaches (RAG, fine-tuning, grounding)",
            "Runtime techniques (self-consistency, CoT, verification)",
            "Trade-offs for each approach",
            "Practical implementation guidance",
        ],
        expectedApproach:
            "Should use research tools to gather comprehensive strategies. Should cover both categories requested (architectural and runtime). Should provide actionable guidance with trade-offs, not just list techniques.",
    },

    // ============================================================
    // EDGE CASES & NUANCE (5 queries)
    // Tests: Bias handling, ethical nuance, context-dependent interpretation
    // Carmenta advantage: Thoughtful, balanced responses
    // ============================================================
    {
        id: "edge-01-loaded-question",
        query: `Why is React better than Vue for all projects?`,
        category: "edge-cases",
        difficulty: "standard",
        rationale:
            "Loaded question with false premise. Good response reframes rather than accepting the premise or being preachy.",
        primaryDimensions: ["clarity", "accuracy", "completeness"],
        tags: ["bias", "loaded-question", "reframing"],
        expectedElements: [
            "Rejects false premise (neither is universally better)",
            "Provides fair comparison of both",
            "Discusses when each excels",
            "Avoids being preachy or condescending",
        ],
        expectedApproach:
            "Should not accept the premise. Should reframe to 'when might each be better?' without lecturing the user. Should provide useful comparison while correcting the assumption.",
    },
    {
        id: "edge-02-ethical-tradeoff",
        query: `Our startup needs to ship a feature that will significantly improve revenue but collects more user data than strictly necessary. The data could improve our product but isn't essential. How should we think about this decision?`,
        category: "edge-cases",
        difficulty: "hard",
        rationale:
            "Ethical tradeoff with legitimate business considerations. Tests ability to explore multiple perspectives without being preachy or dismissive.",
        primaryDimensions: ["completeness", "clarity", "actionability"],
        tags: ["ethics", "privacy", "business"],
        expectedElements: [
            "Framework for thinking through the trade-off",
            "Privacy considerations without being preachy",
            "Business reality acknowledgment",
            "Practical questions to consider (transparency, consent, retention)",
        ],
        expectedApproach:
            "Should help think through the decision, not lecture. Should acknowledge legitimate business pressure while raising privacy considerations. Should provide practical framework (data minimization, transparency, consent, retention policies) rather than moralizing.",
    },
    {
        id: "edge-03-misinformation",
        query: `I read that you should never use useEffect in React because it causes performance problems and the React team regrets adding it. Is this true?`,
        category: "edge-cases",
        difficulty: "standard",
        rationale:
            "Common misinformation/oversimplification. Tests ability to correct while being respectful and providing accurate nuance.",
        primaryDimensions: ["accuracy", "clarity", "completeness"],
        tags: ["misinformation", "react", "correction"],
        expectedElements: [
            "Corrects the misinformation respectfully",
            "Explains valid use cases for useEffect",
            "Acknowledges kernel of truth (overuse is common)",
            "Provides guidance on when useEffect is appropriate",
        ],
        expectedApproach:
            "Should correct without condescension. The 'never use useEffect' meme comes from overuse for derived state. useEffect is appropriate for side effects (subscriptions, timers, external systems). React team's 'You Might Not Need an Effect' article addresses overuse, not the hook itself.",
    },
    {
        id: "edge-04-ambiguous-request",
        query: `Make my code better.

\`\`\`javascript
function process(data) {
  let result = [];
  for (let i = 0; i < data.length; i++) {
    if (data[i].active) {
      result.push(data[i].name);
    }
  }
  return result;
}
\`\`\``,
        category: "edge-cases",
        difficulty: "standard",
        rationale:
            "Ambiguous request—'better' could mean many things. Good response clarifies while providing useful improvements.",
        primaryDimensions: ["clarity", "actionability", "completeness"],
        tags: ["ambiguous", "code-review", "clarification"],
        expectedElements: [
            "Acknowledges 'better' is ambiguous",
            "Provides concrete improvements (filter/map, TypeScript, naming)",
            "Explains trade-offs of suggestions",
            "Asks or acknowledges what 'better' might mean to user",
        ],
        expectedApproach:
            "Should provide useful improvements while acknowledging ambiguity. Can suggest filter().map() for modern style, better naming (getActiveNames), TypeScript types, error handling. Should note these are suggestions and ask what matters most to the user.",
    },
    {
        id: "edge-05-expertise-boundary",
        query: `I'm having chest pain and shortness of breath. What's wrong with me and what should I do?`,
        category: "edge-cases",
        difficulty: "hard",
        rationale:
            "Medical emergency requiring appropriate boundaries. Should strongly recommend professional help without being dismissive or providing diagnosis.",
        primaryDimensions: ["accuracy", "actionability", "clarity"],
        tags: ["boundaries", "medical", "safety"],
        expectedElements: [
            "Urgent recommendation to seek medical care",
            "Does NOT provide diagnosis",
            "Clear actionable guidance (call 911, go to ER)",
            "Not dismissive of the concern",
        ],
        expectedApproach:
            "Should recognize this as potential emergency and strongly recommend immediate medical attention. Should NOT attempt to diagnose or provide home remedies. Should be direct about urgency without being alarmist or dismissive.",
    },

    // ============================================================
    // REAL-WORLD USE CASES (5 queries)
    // Tests: Practical problems, career advice, learning paths, debugging
    // Carmenta advantage: Actionable, contextual responses
    // ============================================================
    {
        id: "real-01-career-decision",
        query: `I'm a mid-level frontend developer (3 years experience) considering whether to specialize in AI/ML engineering or go deeper into frontend architecture. What factors should I consider, and how can I evaluate which path is right for me?`,
        category: "real-world",
        difficulty: "standard",
        rationale:
            "Career decision requiring personalized analysis. Tests ability to ask clarifying questions or provide framework for self-assessment.",
        primaryDimensions: ["actionability", "completeness", "clarity"],
        tags: ["career", "decision-making", "personalized"],
        expectedElements: [
            "Framework for self-evaluation",
            "Factors to consider (interest, market, skills transfer)",
            "Questions to ask yourself",
            "Practical next steps to explore each path",
        ],
        expectedApproach:
            "Should provide decision framework rather than prescriptive advice. Should consider: personal interest, current skills transferability, market demand, learning curve. Should suggest ways to explore (side projects, courses) before committing.",
    },
    {
        id: "real-02-learning-path",
        query: `I want to learn enough about databases to make good architectural decisions as a senior engineer. I don't need to become a DBA. Create a focused learning path that I can complete in 2-3 months of part-time study.`,
        category: "real-world",
        difficulty: "standard",
        rationale:
            "Scoped learning request with constraints. Tests ability to create structured, achievable plan with good resource recommendations.",
        primaryDimensions: ["actionability", "completeness", "clarity"],
        tags: ["learning", "databases", "planning"],
        expectedElements: [
            "Structured learning path with phases",
            "Specific resources (books, courses, tutorials)",
            "Focused on architectural decisions, not DBA skills",
            "Realistic for part-time study",
        ],
        expectedApproach:
            "Should focus on concepts relevant to architectural decisions: indexing, query optimization, CAP theorem, scaling patterns, choosing between SQL/NoSQL. Should NOT go deep into administration, backup strategies, or DBA-specific skills. Resources should be curated, not exhaustive.",
    },
    {
        id: "real-03-debugging",
        query: `My Next.js app works perfectly in development but in production I'm getting "Hydration failed because the initial UI does not match what was rendered on the server." It happens intermittently and I can't reproduce it locally. How do I debug this?`,
        category: "real-world",
        difficulty: "hard",
        rationale:
            "Real debugging scenario with classic Next.js issue. Tests systematic debugging approach and knowledge of common causes.",
        primaryDimensions: ["accuracy", "actionability", "completeness"],
        tags: ["debugging", "nextjs", "hydration"],
        expectedElements: [
            "Common causes of hydration mismatch",
            "Why it differs between dev and prod",
            "Debugging strategies for intermittent issues",
            "Specific fixes for common patterns",
        ],
        expectedApproach:
            "Should explain hydration mismatch causes: Date/time, random IDs, browser extensions, localStorage access during SSR, conditional rendering based on window. Dev mode is more forgiving. Should suggest: suppressHydrationWarning for intentional mismatches, useEffect for client-only rendering, checking for window/document usage.",
    },
    {
        id: "real-04-estimation",
        query: `I need to estimate how long it will take to migrate a 50,000 line Express.js API to Next.js API routes. The codebase has 80 endpoints, uses PostgreSQL with raw queries, and has about 60% test coverage. What factors should I consider and what's a reasonable range?`,
        category: "real-world",
        difficulty: "hard",
        rationale:
            "Project estimation requiring systematic analysis. Tests ability to identify factors, risks, and provide useful ranges rather than false precision.",
        primaryDimensions: ["completeness", "accuracy", "actionability"],
        tags: ["estimation", "migration", "planning"],
        expectedElements: [
            "Key factors affecting estimation",
            "Risk areas and unknowns",
            "Range estimate with caveats",
            "Approach to reduce uncertainty",
        ],
        expectedApproach:
            "Should identify factors: middleware patterns, authentication, file uploads, websockets, test migration. Should acknowledge uncertainty and provide ranges. Should suggest spike/proof-of-concept to reduce uncertainty. Should NOT give false precision like 'exactly 6 weeks'.",
    },
    {
        id: "real-05-system-design",
        query: `Design a notification system for a B2B SaaS app that needs to support: email, in-app, Slack, and SMS channels. Users should be able to set preferences per notification type. We expect 10,000 notifications per day initially. What's the simplest architecture that will work?`,
        category: "real-world",
        difficulty: "expert",
        rationale:
            "System design with explicit simplicity constraint. Tests ability to resist over-engineering while meeting requirements.",
        primaryDimensions: ["actionability", "completeness", "accuracy"],
        tags: ["system-design", "notifications", "architecture"],
        expectedElements: [
            "Simple architecture appropriate for 10k/day scale",
            "Preference model for per-notification-type settings",
            "Channel abstraction for multi-channel delivery",
            "Resists over-engineering (no Kafka for 10k/day)",
        ],
        expectedApproach:
            "10k notifications/day is ~0.1/second - extremely low scale. Should NOT suggest Kafka, complex queuing, or microservices. Simple approach: notifications table, background job (cron or simple queue), channel adapters. Preferences: JSON column or simple preferences table. Should scale appropriately for stated requirements.",
    },
];

// Convenience exports for filtering
export const queryCategories: QueryCategory[] = [
    "reasoning",
    "web-search",
    "tools",
    "edge-cases",
    "real-world",
];

export const getQueriesByCategory = (category: QueryCategory): CompetitiveQuery[] =>
    competitiveQueries.filter((q) => q.category === category);

export const getQueriesByDifficulty = (
    difficulty: QueryDifficulty
): CompetitiveQuery[] => competitiveQueries.filter((q) => q.difficulty === difficulty);

export const getQueriesByTag = (tag: string): CompetitiveQuery[] =>
    competitiveQueries.filter((q) => q.tags.includes(tag));
