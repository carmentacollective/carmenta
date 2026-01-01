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
    },

    // ============================================================
    // TOOL QUALITY EVALUATION QUERIES
    // Tests the new tool quality scorers: web search relevance,
    // research depth, and comparison completeness
    // ============================================================

    // WEB SEARCH QUALITY - Tests search result synthesis and relevance
    {
        id: "tool-quality-01-current-pricing",
        query: `What is the current pricing for Vercel Pro, Netlify Pro, and Cloudflare Pages paid tier? I need exact monthly costs for a project with 100GB bandwidth/month.`,
        category: "web-search",
        difficulty: "standard",
        rationale:
            "Tests web search quality by requiring current, specific pricing data. Good synthesis should compare all three with sources.",
        primaryDimensions: ["recency", "accuracy", "tool_usage"],
        tags: ["pricing", "web-search-quality", "synthesis"],
    },
    {
        id: "tool-quality-02-recent-release",
        query: `What are the most significant new features in React 19? Focus on changes that affect how developers build applications.`,
        category: "web-search",
        difficulty: "standard",
        rationale:
            "Tests ability to find and synthesize recent technical announcements. Quality requires distinguishing major from minor features.",
        primaryDimensions: ["recency", "completeness", "tool_usage"],
        tags: ["react", "web-search-quality", "technical"],
    },

    // RESEARCH DEPTH - Tests thoroughness of investigation
    {
        id: "tool-quality-03-research-tradeoffs",
        query: `Research the tradeoffs between server components and client components in Next.js. When should I use each, and what are the performance implications?`,
        category: "tools",
        difficulty: "hard",
        rationale:
            "Tests research depth by requiring multiple perspectives on a nuanced topic. Should explore use cases, limitations, and real-world considerations.",
        primaryDimensions: ["completeness", "accuracy", "tool_usage"],
        tags: ["research-depth", "nextjs", "architecture"],
    },
    {
        id: "tool-quality-04-investigate-options",
        query: `Investigate my options for adding authentication to a Next.js app. Consider both managed services and self-hosted solutions. What are the pros and cons of each approach?`,
        category: "tools",
        difficulty: "standard",
        rationale:
            "Tests research depth with explicit request for multiple options and tradeoffs. Quality requires balanced coverage and actionable recommendations.",
        primaryDimensions: ["completeness", "actionability", "tool_usage"],
        tags: ["research-depth", "authentication", "options"],
    },

    // COMPARISON COMPLETENESS - Tests thorough, balanced comparisons
    {
        id: "tool-quality-05-db-comparison",
        query: `Compare Supabase vs Firebase vs PlanetScale for a new startup. Consider: ease of use, pricing at scale, real-time capabilities, and vendor lock-in.`,
        category: "tools",
        difficulty: "standard",
        rationale:
            "Tests comparison completeness with explicit criteria. All three should be covered on all four dimensions.",
        primaryDimensions: ["completeness", "accuracy", "tool_usage"],
        tags: ["comparison", "databases", "startup"],
    },
    {
        id: "tool-quality-06-framework-comparison",
        query: `Tailwind CSS vs styled-components vs CSS Modules - which should I use for a large team building a component library?`,
        category: "tools",
        difficulty: "standard",
        rationale:
            "Tests comparison completeness with team context. Should address collaboration, maintainability, and performance for each option.",
        primaryDimensions: ["completeness", "actionability", "tool_usage"],
        tags: ["comparison", "css", "team-context"],
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
