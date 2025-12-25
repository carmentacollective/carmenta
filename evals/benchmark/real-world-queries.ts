/**
 * Carmenta Real-World Benchmark Dataset v2.0.0
 *
 * 100 queries representing actual user behavior patterns, balanced across:
 * - Everyday life questions
 * - Personal growth & emotional support
 * - Work & productivity
 * - Technical & coding
 * - Research & current events
 *
 * Design principles:
 * - Queries people actually ask AI assistants (based on LMSYS, user research)
 * - Mix of simple and complex
 * - Test both knowledge AND emotional intelligence
 * - Include tool-requiring queries (web search, MCP)
 * - Avoid over-indexing on logic puzzles
 */

export type RealWorldCategory =
    | "everyday-life"
    | "personal-growth"
    | "work-productivity"
    | "technical"
    | "research";

export type Difficulty = "simple" | "moderate" | "complex";

export interface RealWorldQuery {
    id: string;
    query: string;
    category: RealWorldCategory;
    difficulty: Difficulty;
    rationale: string;
    tags: string[];
    requiresWebSearch: boolean;
    requiresTool?: string;
    emotionalContext?: boolean;
}

// ============================================================================
// EVERYDAY LIFE (20 queries)
// Practical questions people ask daily - recommendations, how-to, decisions
// ============================================================================

const everydayLifeQueries: RealWorldQuery[] = [
    {
        id: "everyday-001-wine-stain",
        query: "What's the best way to get red wine out of a white carpet? I just spilled a glass.",
        category: "everyday-life",
        difficulty: "simple",
        rationale: "Common household problem, tests practical advice.",
        tags: ["home", "cleaning", "urgent"],
        requiresWebSearch: false,
    },
    {
        id: "everyday-002-podcast",
        query: "I need a good podcast for my commute - something funny but also educational. About 30-45 min episodes.",
        category: "everyday-life",
        difficulty: "simple",
        rationale: "Recommendation with constraints, tests personalization.",
        tags: ["entertainment", "recommendation", "commute"],
        requiresWebSearch: true,
    },
    {
        id: "everyday-003-steak",
        query: "How do I cook a medium-rare steak on a cast iron pan? I've never done it before.",
        category: "everyday-life",
        difficulty: "simple",
        rationale: "Step-by-step instructions, tests clarity and completeness.",
        tags: ["cooking", "how-to", "beginner"],
        requiresWebSearch: false,
    },
    {
        id: "everyday-004-ira",
        query: "What's the difference between a Roth IRA and traditional IRA? I'm trying to decide which to open.",
        category: "everyday-life",
        difficulty: "moderate",
        rationale: "Financial literacy, tests clear explanation of complex topic.",
        tags: ["finance", "retirement", "comparison"],
        requiresWebSearch: false,
    },
    {
        id: "everyday-005-coffee-austin",
        query: "Best coffee shops in Austin with good wifi for working? Preferably not too crowded.",
        category: "everyday-life",
        difficulty: "simple",
        rationale: "Local search with specific constraints.",
        tags: ["local", "recommendation", "remote-work"],
        requiresWebSearch: true,
    },
    {
        id: "everyday-006-plant-care",
        query: "My fiddle leaf fig is dropping leaves. How often should I water it and what else might be wrong?",
        category: "everyday-life",
        difficulty: "simple",
        rationale: "Troubleshooting with multiple possible causes.",
        tags: ["plants", "home", "troubleshooting"],
        requiresWebSearch: false,
    },
    {
        id: "everyday-007-gift",
        query: "I need a gift for my sister's 30th birthday. She likes reading, hiking, and cooking. Budget is around $50.",
        category: "everyday-life",
        difficulty: "simple",
        rationale: "Personalized recommendation with constraints.",
        tags: ["gift", "recommendation", "personal"],
        requiresWebSearch: true,
    },
    {
        id: "everyday-008-garbage-disposal",
        query: "My garbage disposal is making a humming noise but not spinning. Is this something I can fix myself?",
        category: "everyday-life",
        difficulty: "moderate",
        rationale: "DIY troubleshooting, tests judgment on when to call a pro.",
        tags: ["home", "repair", "diy"],
        requiresWebSearch: false,
    },
    {
        id: "everyday-009-tipping",
        query: "What's the tipping etiquette at restaurants now? I heard it changed. What about takeout?",
        category: "everyday-life",
        difficulty: "simple",
        rationale: "Social norms question, tests current knowledge.",
        tags: ["etiquette", "social", "dining"],
        requiresWebSearch: true,
    },
    {
        id: "everyday-010-dinner",
        query: "I have chicken thighs, rice, broccoli, and some basic pantry stuff. What can I make for dinner that's not boring?",
        category: "everyday-life",
        difficulty: "simple",
        rationale: "Creative constraint problem, tests practical suggestions.",
        tags: ["cooking", "meal-planning", "creative"],
        requiresWebSearch: false,
    },
    {
        id: "everyday-011-cat-scratching",
        query: "How do I get my cat to stop scratching the furniture? I've tried the spray but it's not working.",
        category: "everyday-life",
        difficulty: "simple",
        rationale: "Pet behavior with failed first attempt, tests alternatives.",
        tags: ["pets", "behavior", "troubleshooting"],
        requiresWebSearch: false,
    },
    {
        id: "everyday-012-spanish",
        query: "I'm going to Mexico City in 3 weeks. What's the fastest way to learn enough Spanish to get around?",
        category: "everyday-life",
        difficulty: "moderate",
        rationale: "Time-constrained learning, tests realistic expectations.",
        tags: ["language", "learning", "travel"],
        requiresWebSearch: true,
    },
    {
        id: "everyday-013-credit-card",
        query: "Should I get a credit card with travel points or cash back? I travel maybe 2-3 times a year.",
        category: "everyday-life",
        difficulty: "moderate",
        rationale: "Personal finance decision with tradeoffs.",
        tags: ["finance", "credit", "decision"],
        requiresWebSearch: true,
    },
    {
        id: "everyday-014-rent-negotiate",
        query: "My landlord wants to raise my rent 15%. Is there any way to negotiate this down?",
        category: "everyday-life",
        difficulty: "moderate",
        rationale: "Negotiation advice, tests practical strategies.",
        tags: ["housing", "negotiation", "money"],
        requiresWebSearch: false,
    },
    {
        id: "everyday-015-flights",
        query: "When's the best time to book flights for Thanksgiving? And what day is cheapest to fly?",
        category: "everyday-life",
        difficulty: "simple",
        rationale: "Time-sensitive travel planning.",
        tags: ["travel", "booking", "planning"],
        requiresWebSearch: true,
    },
    {
        id: "everyday-016-composting",
        query: "How do I start composting in an apartment? I don't have any outdoor space.",
        category: "everyday-life",
        difficulty: "simple",
        rationale: "Constraint-based how-to.",
        tags: ["sustainability", "apartment", "how-to"],
        requiresWebSearch: false,
    },
    {
        id: "everyday-017-apr",
        query: "What's the difference between APR and interest rate on a mortgage? My lender keeps using both.",
        category: "everyday-life",
        difficulty: "moderate",
        rationale: "Financial literacy, tests clear explanation.",
        tags: ["finance", "mortgage", "explanation"],
        requiresWebSearch: false,
    },
    {
        id: "everyday-018-bread-storage",
        query: "My bread always goes stale or moldy before I can finish it. How should I store it?",
        category: "everyday-life",
        difficulty: "simple",
        rationale: "Practical food storage advice.",
        tags: ["food", "storage", "practical"],
        requiresWebSearch: false,
    },
    {
        id: "everyday-019-netflix",
        query: "How do I remove someone from my Netflix account? They still have access after we broke up.",
        category: "everyday-life",
        difficulty: "simple",
        rationale: "Tech support with emotional context.",
        tags: ["tech", "accounts", "how-to"],
        requiresWebSearch: true,
        emotionalContext: true,
    },
    {
        id: "everyday-020-rescue-dog",
        query: "I'm thinking about adopting a rescue dog. What should I know before I commit?",
        category: "everyday-life",
        difficulty: "moderate",
        rationale: "Life decision, tests comprehensive advice.",
        tags: ["pets", "adoption", "decision"],
        requiresWebSearch: false,
    },
];

// ============================================================================
// PERSONAL GROWTH (20 queries)
// Relationships, emotions, career, life decisions - tests emotional intelligence
// ============================================================================

const personalGrowthQueries: RealWorldQuery[] = [
    {
        id: "personal-001-burnout",
        query: "I'm completely burned out at work but I can't afford to quit. What should I do?",
        category: "personal-growth",
        difficulty: "complex",
        rationale: "Tests empathy AND practical advice for constrained situation.",
        tags: ["burnout", "work", "mental-health"],
        requiresWebSearch: false,
        emotionalContext: true,
    },
    {
        id: "personal-002-communication",
        query: "My partner and I have totally different communication styles - I want to talk things out immediately and they need time to process. How do we bridge this?",
        category: "personal-growth",
        difficulty: "complex",
        rationale: "Relationship advice requiring nuance and both perspectives.",
        tags: ["relationship", "communication", "advice"],
        requiresWebSearch: false,
        emotionalContext: true,
    },
    {
        id: "personal-003-midlife",
        query: "I'm 35 and feel like I haven't accomplished anything meaningful. Everyone around me seems further ahead. Is this normal?",
        category: "personal-growth",
        difficulty: "complex",
        rationale: "Existential concern, tests validation AND reframing.",
        tags: ["self-worth", "comparison", "existential"],
        requiresWebSearch: false,
        emotionalContext: true,
    },
    {
        id: "personal-004-boundaries",
        query: "How do I set boundaries with my parents as an adult? They still treat me like a kid and get hurt when I push back.",
        category: "personal-growth",
        difficulty: "complex",
        rationale: "Family dynamics, tests nuanced advice.",
        tags: ["family", "boundaries", "relationships"],
        requiresWebSearch: false,
        emotionalContext: true,
    },
    {
        id: "personal-005-presentation-anxiety",
        query: "I have a huge presentation next week and I'm already losing sleep over it. Any tips for managing this anxiety?",
        category: "personal-growth",
        difficulty: "moderate",
        rationale: "Practical anxiety management with time pressure.",
        tags: ["anxiety", "work", "performance"],
        requiresWebSearch: false,
        emotionalContext: true,
    },
    {
        id: "personal-006-friend-conflict",
        query: "My best friend said something really hurtful last week. Should I bring it up or just let it go?",
        category: "personal-growth",
        difficulty: "moderate",
        rationale: "Interpersonal decision, tests weighing options.",
        tags: ["friendship", "conflict", "decision"],
        requiresWebSearch: false,
        emotionalContext: true,
    },
    {
        id: "personal-007-procrastination",
        query: "I keep procrastinating on the things that matter most. I know I'm doing it but can't seem to stop. How do I break this cycle?",
        category: "personal-growth",
        difficulty: "complex",
        rationale: "Behavioral pattern, tests understanding root causes.",
        tags: ["productivity", "psychology", "habits"],
        requiresWebSearch: false,
        emotionalContext: true,
    },
    {
        id: "personal-008-therapy",
        query: "I've been feeling off lately - not depressed exactly, but not myself. How do I know if therapy would help?",
        category: "personal-growth",
        difficulty: "moderate",
        rationale: "Mental health, tests appropriate guidance without diagnosing.",
        tags: ["mental-health", "therapy", "self-awareness"],
        requiresWebSearch: false,
        emotionalContext: true,
    },
    {
        id: "personal-009-new-city",
        query: "I moved to a new city 6 months ago and still haven't made real friends. I'm starting to feel isolated. Any advice?",
        category: "personal-growth",
        difficulty: "moderate",
        rationale: "Social connection, tests practical AND emotional support.",
        tags: ["loneliness", "social", "moving"],
        requiresWebSearch: false,
        emotionalContext: true,
    },
    {
        id: "personal-010-credit-coworker",
        query: "A coworker keeps taking credit for my ideas in meetings. How do I handle this without looking petty?",
        category: "personal-growth",
        difficulty: "moderate",
        rationale: "Workplace dynamics, tests strategic advice.",
        tags: ["work", "conflict", "strategy"],
        requiresWebSearch: false,
        emotionalContext: true,
    },
    {
        id: "personal-011-self-care-guilt",
        query: "I feel guilty whenever I take time for myself instead of being productive. How do I get over this?",
        category: "personal-growth",
        difficulty: "moderate",
        rationale: "Self-care, tests reframing unhelpful beliefs.",
        tags: ["self-care", "guilt", "mindset"],
        requiresWebSearch: false,
        emotionalContext: true,
    },
    {
        id: "personal-012-overwhelmed-boss",
        query: "How do I tell my boss I'm overwhelmed without making it seem like I can't handle my job?",
        category: "personal-growth",
        difficulty: "moderate",
        rationale: "Professional communication in vulnerable situation.",
        tags: ["work", "communication", "vulnerability"],
        requiresWebSearch: false,
        emotionalContext: true,
    },
    {
        id: "personal-013-long-distance",
        query: "My partner and I are about to go long distance for a year. Any advice for making it work?",
        category: "personal-growth",
        difficulty: "moderate",
        rationale: "Relationship advice with specific challenge.",
        tags: ["relationship", "long-distance", "planning"],
        requiresWebSearch: false,
        emotionalContext: true,
    },
    {
        id: "personal-014-teenager",
        query: "My teenage daughter barely talks to me anymore. I know it's normal but it hurts. What can I do?",
        category: "personal-growth",
        difficulty: "complex",
        rationale: "Parenting with emotional pain, tests empathy.",
        tags: ["parenting", "teenagers", "communication"],
        requiresWebSearch: false,
        emotionalContext: true,
    },
    {
        id: "personal-015-social-comparison",
        query: "I keep comparing myself to people on Instagram and it makes me feel terrible. How do I stop?",
        category: "personal-growth",
        difficulty: "moderate",
        rationale: "Social media impact, tests practical strategies.",
        tags: ["social-media", "comparison", "self-esteem"],
        requiresWebSearch: false,
        emotionalContext: true,
    },
    {
        id: "personal-016-imposter",
        query: "I just started a senior role and feel like a complete fraud. Everyone seems to expect me to have answers I don't have.",
        category: "personal-growth",
        difficulty: "complex",
        rationale: "Imposter syndrome, tests validation AND practical advice.",
        tags: ["imposter-syndrome", "career", "confidence"],
        requiresWebSearch: false,
        emotionalContext: true,
    },
    {
        id: "personal-017-grief",
        query: "I lost my mom three months ago and I'm struggling more now than I was right after. Is that normal?",
        category: "personal-growth",
        difficulty: "complex",
        rationale: "Grief, tests compassion and understanding of grief process.",
        tags: ["grief", "loss", "mental-health"],
        requiresWebSearch: false,
        emotionalContext: true,
    },
    {
        id: "personal-018-career-change",
        query: "I'm 40 and thinking about going back to school to change careers. Am I too old? Is this crazy?",
        category: "personal-growth",
        difficulty: "moderate",
        rationale: "Life transition, tests encouragement AND realistic guidance.",
        tags: ["career", "education", "life-change"],
        requiresWebSearch: false,
        emotionalContext: true,
    },
    {
        id: "personal-019-forgiveness",
        query: "How do I forgive someone who hurt me and never apologized? I'm tired of carrying this anger.",
        category: "personal-growth",
        difficulty: "complex",
        rationale: "Deep emotional work, tests psychological insight.",
        tags: ["forgiveness", "healing", "emotions"],
        requiresWebSearch: false,
        emotionalContext: true,
    },
    {
        id: "personal-020-introvert-networking",
        query: "I'm an introvert who needs to network more for my career. The thought of it exhausts me. Any strategies?",
        category: "personal-growth",
        difficulty: "moderate",
        rationale: "Practical advice for personality-specific challenge.",
        tags: ["introvert", "networking", "career"],
        requiresWebSearch: false,
        emotionalContext: true,
    },
];

// ============================================================================
// WORK & PRODUCTIVITY (20 queries)
// Emails, planning, professional advice, writing assistance
// ============================================================================

const workProductivityQueries: RealWorldQuery[] = [
    {
        id: "work-001-decline-meeting",
        query: "Help me write an email politely declining a meeting that I really don't need to be in.",
        category: "work-productivity",
        difficulty: "simple",
        rationale: "Professional writing, tests tone and diplomacy.",
        tags: ["email", "communication", "boundaries"],
        requiresWebSearch: false,
    },
    {
        id: "work-002-feedback",
        query: "I need to give feedback to a direct report who's been missing deadlines. Can you help me draft it? I want to be firm but not demoralizing.",
        category: "work-productivity",
        difficulty: "moderate",
        rationale: "Difficult conversation, tests balancing firmness and empathy.",
        tags: ["feedback", "management", "communication"],
        requiresWebSearch: false,
    },
    {
        id: "work-003-week-planning",
        query: "Help me plan my week. I have: a product launch Friday, 2 reports due, 6 meetings, and I need to hire someone. What should I prioritize?",
        category: "work-productivity",
        difficulty: "moderate",
        rationale: "Prioritization, tests strategic thinking.",
        tags: ["planning", "prioritization", "time-management"],
        requiresWebSearch: false,
    },
    {
        id: "work-004-rewrite-professional",
        query: "Can you rewrite this to sound more professional? 'Hey, so I was thinking we should probably push the launch back because things are kinda messy right now.'",
        category: "work-productivity",
        difficulty: "simple",
        rationale: "Writing improvement, tests tone adjustment.",
        tags: ["writing", "communication", "editing"],
        requiresWebSearch: false,
    },
    {
        id: "work-005-one-on-one",
        query: "I have a 1:1 with my manager tomorrow. What should I bring up? I want a promotion but also have some concerns about my workload.",
        category: "work-productivity",
        difficulty: "moderate",
        rationale: "Meeting prep with multiple objectives.",
        tags: ["career", "communication", "strategy"],
        requiresWebSearch: false,
    },
    {
        id: "work-006-salary-negotiation",
        query: "I got a job offer for $120k but I was hoping for $140k. How should I approach the negotiation?",
        category: "work-productivity",
        difficulty: "moderate",
        rationale: "Negotiation strategy, tests specific tactics.",
        tags: ["negotiation", "salary", "career"],
        requiresWebSearch: false,
    },
    {
        id: "work-007-linkedin-outreach",
        query: "Help me write a LinkedIn message to a VP at a company I want to work for. I don't want to sound desperate or salesy.",
        category: "work-productivity",
        difficulty: "moderate",
        rationale: "Professional networking, tests authentic tone.",
        tags: ["networking", "linkedin", "job-search"],
        requiresWebSearch: false,
    },
    {
        id: "work-008-brainstorm-agenda",
        query: "Create an agenda for a 90-minute brainstorming session. We're trying to come up with new product ideas for Gen Z.",
        category: "work-productivity",
        difficulty: "moderate",
        rationale: "Meeting design, tests structure and facilitation.",
        tags: ["meetings", "facilitation", "brainstorming"],
        requiresWebSearch: false,
    },
    {
        id: "work-009-remote-meetings",
        query: "My remote team meetings are boring and unproductive. People have cameras off and barely participate. How do I fix this?",
        category: "work-productivity",
        difficulty: "moderate",
        rationale: "Remote work challenge, tests practical interventions.",
        tags: ["remote-work", "meetings", "engagement"],
        requiresWebSearch: false,
    },
    {
        id: "work-010-interview-followup",
        query: "I had a job interview yesterday and it went well. Help me write a follow-up email that stands out.",
        category: "work-productivity",
        difficulty: "simple",
        rationale: "Professional email, tests personalization.",
        tags: ["job-search", "email", "interview"],
        requiresWebSearch: false,
    },
    {
        id: "work-011-prioritize-tasks",
        query: "I have 15 tasks on my to-do list and everything feels urgent. How do I figure out what to actually focus on?",
        category: "work-productivity",
        difficulty: "moderate",
        rationale: "Prioritization framework, tests practical methodology.",
        tags: ["prioritization", "productivity", "overwhelm"],
        requiresWebSearch: false,
        emotionalContext: true,
    },
    {
        id: "work-012-interview-questions",
        query: "I'm interviewing for a product manager role next week. What questions should I be prepared to answer?",
        category: "work-productivity",
        difficulty: "simple",
        rationale: "Interview prep, tests role-specific knowledge.",
        tags: ["interview", "job-search", "preparation"],
        requiresWebSearch: true,
    },
    {
        id: "work-013-30-60-90",
        query: "I'm starting a new job as Engineering Manager. Help me create a 30-60-90 day plan.",
        category: "work-productivity",
        difficulty: "complex",
        rationale: "Strategic planning for role transition.",
        tags: ["career", "planning", "leadership"],
        requiresWebSearch: false,
    },
    {
        id: "work-014-proposal",
        query: "Help me write a project proposal to get buy-in from leadership. The project is migrating our app to a new framework.",
        category: "work-productivity",
        difficulty: "complex",
        rationale: "Business writing, tests persuasion and structure.",
        tags: ["proposal", "writing", "stakeholders"],
        requiresWebSearch: false,
    },
    {
        id: "work-015-delegation",
        query: "I'm a new manager and I'm terrible at delegating. I keep doing everything myself. How do I get better at this?",
        category: "work-productivity",
        difficulty: "moderate",
        rationale: "Leadership skill, tests self-awareness and growth.",
        tags: ["management", "delegation", "leadership"],
        requiresWebSearch: false,
        emotionalContext: true,
    },
    {
        id: "work-016-deadline-extension",
        query: "I need to ask for a deadline extension on a project. How do I do this without looking incompetent?",
        category: "work-productivity",
        difficulty: "moderate",
        rationale: "Difficult communication, tests framing.",
        tags: ["communication", "deadlines", "professionalism"],
        requiresWebSearch: false,
        emotionalContext: true,
    },
    {
        id: "work-017-document-work",
        query: "My performance review is in 2 months. How should I document my work so I have good examples to share?",
        category: "work-productivity",
        difficulty: "moderate",
        rationale: "Career management, tests systematic approach.",
        tags: ["career", "performance", "documentation"],
        requiresWebSearch: false,
    },
    {
        id: "work-018-presentation-outline",
        query: "I'm presenting our Q4 results to the board. Help me create an outline that tells a compelling story even though we missed targets.",
        category: "work-productivity",
        difficulty: "complex",
        rationale: "Difficult presentation, tests narrative framing.",
        tags: ["presentation", "storytelling", "leadership"],
        requiresWebSearch: false,
    },
    {
        id: "work-019-say-no",
        query: "My boss keeps adding to my plate but I'm already working 60 hours a week. How do I say no without hurting my career?",
        category: "work-productivity",
        difficulty: "complex",
        rationale: "Boundaries at work, tests strategic pushback.",
        tags: ["boundaries", "workload", "communication"],
        requiresWebSearch: false,
        emotionalContext: true,
    },
    {
        id: "work-020-recommendation",
        query: "A colleague asked me to write her a LinkedIn recommendation. She's great at her job. Can you help me write something genuine and specific?",
        category: "work-productivity",
        difficulty: "simple",
        rationale: "Professional writing, tests specificity.",
        tags: ["writing", "linkedin", "professional"],
        requiresWebSearch: false,
    },
];

// ============================================================================
// TECHNICAL (20 queries)
// Coding, architecture, debugging, explanations - developer-focused
// ============================================================================

const technicalQueries: RealWorldQuery[] = [
    {
        id: "tech-001-react-rerender",
        query: `This React component keeps re-rendering when I type in the input. What's wrong?

\`\`\`jsx
function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);

  useEffect(() => {
    fetch(\`/api/search?q=\${query}\`)
      .then(r => r.json())
      .then(setResults);
  }, [query]);

  return (
    <div>
      <input value={query} onChange={e => setQuery(e.target.value)} />
      {results.map(r => <div key={r.id}>{r.title}</div>)}
    </div>
  );
}
\`\`\``,
        category: "technical",
        difficulty: "moderate",
        rationale: "Common React bug (missing debounce), tests debugging.",
        tags: ["react", "debugging", "performance"],
        requiresWebSearch: false,
    },
    {
        id: "tech-002-sql-vs-nosql",
        query: "We're building a new app and debating SQL vs NoSQL. We need flexible schemas but also some complex queries. What should we consider?",
        category: "technical",
        difficulty: "moderate",
        rationale: "Architecture decision, tests tradeoff analysis.",
        tags: ["database", "architecture", "decision"],
        requiresWebSearch: false,
    },
    {
        id: "tech-003-nextjs-auth",
        query: "What's the best way to handle authentication in a Next.js app in 2025? I've seen like 5 different approaches.",
        category: "technical",
        difficulty: "complex",
        rationale: "Current best practices, tests up-to-date knowledge.",
        tags: ["nextjs", "auth", "best-practices"],
        requiresWebSearch: true,
    },
    {
        id: "tech-004-security-review",
        query: `Can you review this for security issues?

\`\`\`typescript
app.post('/api/users', async (req, res) => {
  const { email, password, role } = req.body;
  const user = await db.query(
    \`INSERT INTO users (email, password, role) VALUES ('\${email}', '\${password}', '\${role}')\`
  );
  res.json({ user, token: jwt.sign({ id: user.id }, 'secret123') });
});
\`\`\``,
        category: "technical",
        difficulty: "moderate",
        rationale:
            "Security review (SQL injection, hardcoded secret, role escalation).",
        tags: ["security", "code-review", "api"],
        requiresWebSearch: false,
    },
    {
        id: "tech-005-cicd-python",
        query: "I need to set up CI/CD for a Python project. We use GitHub and want to deploy to AWS Lambda. What's a good setup?",
        category: "technical",
        difficulty: "moderate",
        rationale: "DevOps, tests practical pipeline design.",
        tags: ["cicd", "python", "devops"],
        requiresWebSearch: true,
    },
    {
        id: "tech-006-regex",
        query: "What does this regex do and can you explain each part? `^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%]).{8,}$`",
        category: "technical",
        difficulty: "moderate",
        rationale: "Regex explanation, tests teaching ability.",
        tags: ["regex", "explanation", "patterns"],
        requiresWebSearch: false,
    },
    {
        id: "tech-007-database-design",
        query: "I'm building a food delivery app. Help me design the database schema. Key features: restaurants, menus, orders, delivery tracking, reviews.",
        category: "technical",
        difficulty: "complex",
        rationale: "Schema design, tests completeness and normalization.",
        tags: ["database", "design", "architecture"],
        requiresWebSearch: false,
    },
    {
        id: "tech-008-rest-vs-graphql",
        query: "Should we use REST or GraphQL for our new API? We have a mobile app and web app with different data needs.",
        category: "technical",
        difficulty: "moderate",
        rationale: "API design decision, tests context-aware advice.",
        tags: ["api", "architecture", "decision"],
        requiresWebSearch: false,
    },
    {
        id: "tech-009-slow-query",
        query: `This query takes 30 seconds on 5M rows. How can I speed it up?

\`\`\`sql
SELECT u.*, COUNT(o.id) as order_count, SUM(o.total) as lifetime_value
FROM users u
LEFT JOIN orders o ON u.id = o.user_id
WHERE u.created_at > '2024-01-01'
GROUP BY u.id
ORDER BY lifetime_value DESC
LIMIT 100;
\`\`\``,
        category: "technical",
        difficulty: "complex",
        rationale: "Query optimization, tests database expertise.",
        tags: ["sql", "performance", "optimization"],
        requiresWebSearch: false,
    },
    {
        id: "tech-010-rate-limiting",
        query: "How should I implement rate limiting for my API? I need per-user limits and also per-endpoint limits.",
        category: "technical",
        difficulty: "moderate",
        rationale: "API design, tests practical implementation.",
        tags: ["api", "rate-limiting", "design"],
        requiresWebSearch: false,
    },
    {
        id: "tech-011-async-await",
        query: "Can you explain async/await in JavaScript? I'm a beginner and Promises confuse me.",
        category: "technical",
        difficulty: "simple",
        rationale: "Concept explanation for beginner, tests teaching.",
        tags: ["javascript", "async", "beginner"],
        requiresWebSearch: false,
    },
    {
        id: "tech-012-react-structure",
        query: "I'm starting a large React project. What folder structure would you recommend? We'll have about 50 components and 20 pages.",
        category: "technical",
        difficulty: "moderate",
        rationale: "Project organization, tests best practices.",
        tags: ["react", "architecture", "organization"],
        requiresWebSearch: false,
    },
    {
        id: "tech-013-python-error",
        query: `I keep getting this error and can't figure out why:
TypeError: 'NoneType' object is not subscriptable

Here's my code:
\`\`\`python
def get_user_email(user_id):
    user = db.get_user(user_id)
    return user['email']
\`\`\``,
        category: "technical",
        difficulty: "simple",
        rationale: "Common debugging, tests error understanding.",
        tags: ["python", "debugging", "errors"],
        requiresWebSearch: false,
    },
    {
        id: "tech-014-caching",
        query: "My API is getting slow under load. How should I add caching? It's a Node.js app with PostgreSQL.",
        category: "technical",
        difficulty: "complex",
        rationale: "Performance optimization, tests caching strategies.",
        tags: ["caching", "performance", "architecture"],
        requiresWebSearch: false,
    },
    {
        id: "tech-015-kubernetes",
        query: "Can you explain Kubernetes to me? I understand Docker but K8s seems really complex.",
        category: "technical",
        difficulty: "moderate",
        rationale: "Concept explanation building on prior knowledge.",
        tags: ["kubernetes", "devops", "explanation"],
        requiresWebSearch: false,
    },
    {
        id: "tech-016-testing",
        query: `What tests should I write for this function?

\`\`\`typescript
function calculateDiscount(price: number, userTier: 'free' | 'pro' | 'enterprise', couponCode?: string): number {
  let discount = 0;
  if (userTier === 'pro') discount = 0.1;
  if (userTier === 'enterprise') discount = 0.2;
  if (couponCode === 'SAVE20') discount += 0.2;
  return price * (1 - Math.min(discount, 0.3));
}
\`\`\``,
        category: "technical",
        difficulty: "moderate",
        rationale: "Test design, tests edge case thinking.",
        tags: ["testing", "typescript", "best-practices"],
        requiresWebSearch: false,
    },
    {
        id: "tech-017-aws-lambda-ec2",
        query: "We're deciding between AWS Lambda and EC2 for a new service. It handles about 1000 requests/minute with spikes to 10000. What would you recommend?",
        category: "technical",
        difficulty: "moderate",
        rationale: "Infrastructure decision, tests context-aware advice.",
        tags: ["aws", "infrastructure", "decision"],
        requiresWebSearch: false,
    },
    {
        id: "tech-018-api-security",
        query: "What are the most important security measures I should implement for a public API?",
        category: "technical",
        difficulty: "moderate",
        rationale: "Security best practices, tests comprehensive knowledge.",
        tags: ["security", "api", "best-practices"],
        requiresWebSearch: false,
    },
    {
        id: "tech-019-git-conflict",
        query: `I'm trying to merge a branch and got this conflict. What should I do?

\`\`\`
<<<<<<< HEAD
const API_URL = 'https://api.prod.example.com';
=======
const API_URL = process.env.API_URL || 'https://api.staging.example.com';
>>>>>>> feature/config-cleanup
\`\`\``,
        category: "technical",
        difficulty: "simple",
        rationale: "Git conflict resolution, tests practical guidance.",
        tags: ["git", "conflict", "collaboration"],
        requiresWebSearch: false,
    },
    {
        id: "tech-020-microservices",
        query: "Help me design a simple microservices architecture for an e-commerce site. Key services: users, products, orders, payments, inventory.",
        category: "technical",
        difficulty: "complex",
        rationale: "System design, tests architecture thinking.",
        tags: ["microservices", "architecture", "design"],
        requiresWebSearch: false,
    },
];

// ============================================================================
// RESEARCH & CURRENT EVENTS (20 queries)
// Web search required, fact-checking, comparisons, deep research
// ============================================================================

const researchQueries: RealWorldQuery[] = [
    {
        id: "research-001-ai-safety",
        query: "What are the most significant AI safety developments in the past few months?",
        category: "research",
        difficulty: "moderate",
        rationale: "Current events, tests recent knowledge.",
        tags: ["ai", "safety", "current-events"],
        requiresWebSearch: true,
    },
    {
        id: "research-002-ev-comparison",
        query: "I'm looking to buy an electric car. Compare the top options in 2025 for someone who drives 50 miles/day and lives in an apartment.",
        category: "research",
        difficulty: "complex",
        rationale: "Product comparison with constraints.",
        tags: ["cars", "comparison", "research"],
        requiresWebSearch: true,
    },
    {
        id: "research-003-remote-work",
        query: "What's the current state of remote work policies at major tech companies? Are they still doing return-to-office?",
        category: "research",
        difficulty: "moderate",
        rationale: "Current business trends.",
        tags: ["work", "tech", "trends"],
        requiresWebSearch: true,
    },
    {
        id: "research-004-company-research",
        query: "I have an interview at Stripe next week. Help me research the company - culture, recent news, challenges they're facing.",
        category: "research",
        difficulty: "complex",
        rationale: "Company research for interview prep.",
        tags: ["interview", "research", "company"],
        requiresWebSearch: true,
    },
    {
        id: "research-005-housing-market",
        query: "What's happening with the housing market right now? Is it a good time to buy in a major city?",
        category: "research",
        difficulty: "moderate",
        rationale: "Economic analysis, tests nuanced advice.",
        tags: ["housing", "finance", "market"],
        requiresWebSearch: true,
    },
    {
        id: "research-006-intermittent-fasting",
        query: "What does the latest research say about intermittent fasting? Is it actually effective or just a fad?",
        category: "research",
        difficulty: "moderate",
        rationale: "Health research synthesis.",
        tags: ["health", "research", "diet"],
        requiresWebSearch: true,
    },
    {
        id: "research-007-programming-languages",
        query: "What programming languages are most in-demand right now for jobs?",
        category: "research",
        difficulty: "simple",
        rationale: "Job market research.",
        tags: ["programming", "jobs", "trends"],
        requiresWebSearch: true,
    },
    {
        id: "research-008-password-managers",
        query: "Compare the major password managers - 1Password, Bitwarden, LastPass. Which is best for a family?",
        category: "research",
        difficulty: "moderate",
        rationale: "Product comparison with persona.",
        tags: ["security", "comparison", "software"],
        requiresWebSearch: true,
    },
    {
        id: "research-009-renewable-energy",
        query: "What's the current state of renewable energy adoption in the US? Are we on track for climate goals?",
        category: "research",
        difficulty: "complex",
        rationale: "Policy and data research.",
        tags: ["environment", "energy", "policy"],
        requiresWebSearch: true,
    },
    {
        id: "research-010-project-management",
        query: "We're a 10-person team looking for a project management tool. Compare the options - we're currently using spreadsheets.",
        category: "research",
        difficulty: "moderate",
        rationale: "Tool recommendation with context.",
        tags: ["tools", "productivity", "comparison"],
        requiresWebSearch: true,
    },
    {
        id: "research-011-travel-vaccines",
        query: "I'm traveling to Thailand and Vietnam next month. What vaccinations or health precautions do I need?",
        category: "research",
        difficulty: "moderate",
        rationale: "Travel health research.",
        tags: ["travel", "health", "planning"],
        requiresWebSearch: true,
    },
    {
        id: "research-012-cloud-providers",
        query: "We're a startup choosing a cloud provider. Compare AWS, GCP, and Azure for a small engineering team.",
        category: "research",
        difficulty: "complex",
        rationale: "Technical comparison with persona.",
        tags: ["cloud", "infrastructure", "comparison"],
        requiresWebSearch: true,
    },
    {
        id: "research-013-screen-time",
        query: "What does the research actually say about screen time and kids? My daughter is 7 and I'm worried she's on her iPad too much.",
        category: "research",
        difficulty: "moderate",
        rationale: "Research synthesis with personal context.",
        tags: ["parenting", "research", "health"],
        requiresWebSearch: true,
        emotionalContext: true,
    },
    {
        id: "research-014-investment-apps",
        query: "What are the best investment apps for a beginner who wants to start with $100/month?",
        category: "research",
        difficulty: "moderate",
        rationale: "Product recommendation for beginner.",
        tags: ["finance", "investing", "apps"],
        requiresWebSearch: true,
    },
    {
        id: "research-015-tech-job-market",
        query: "How's the tech job market looking right now? I'm a senior engineer thinking about job hunting.",
        category: "research",
        difficulty: "moderate",
        rationale: "Job market analysis.",
        tags: ["jobs", "tech", "career"],
        requiresWebSearch: true,
    },
    {
        id: "research-016-sustainable-fashion",
        query: "What are some good sustainable clothing brands? I want to buy less fast fashion.",
        category: "research",
        difficulty: "simple",
        rationale: "Brand research with values.",
        tags: ["fashion", "sustainability", "shopping"],
        requiresWebSearch: true,
    },
    {
        id: "research-017-crispr",
        query: "What are the latest developments in CRISPR gene editing? Any major breakthroughs recently?",
        category: "research",
        difficulty: "complex",
        rationale: "Scientific research synthesis.",
        tags: ["science", "biotech", "research"],
        requiresWebSearch: true,
    },
    {
        id: "research-018-meditation-apps",
        query: "I want to start meditating. Compare Headspace, Calm, and any other good options.",
        category: "research",
        difficulty: "simple",
        rationale: "App comparison for beginner.",
        tags: ["wellness", "apps", "comparison"],
        requiresWebSearch: true,
    },
    {
        id: "research-019-climate-tech",
        query: "What startups or technologies are making the biggest impact on climate change right now?",
        category: "research",
        difficulty: "complex",
        rationale: "Industry research and analysis.",
        tags: ["climate", "startups", "technology"],
        requiresWebSearch: true,
    },
    {
        id: "research-020-ai-coding-tools",
        query: "What's the current state of AI coding assistants? Compare Copilot, Cursor, Claude, and others for a professional developer.",
        category: "research",
        difficulty: "complex",
        rationale: "Tool comparison in fast-moving space.",
        tags: ["ai", "coding", "tools"],
        requiresWebSearch: true,
    },
];

// ============================================================================
// EXPORTS
// ============================================================================

export const realWorldQueries: RealWorldQuery[] = [
    ...everydayLifeQueries,
    ...personalGrowthQueries,
    ...workProductivityQueries,
    ...technicalQueries,
    ...researchQueries,
];

// Convenience exports
export const getQueriesByCategory = (category: RealWorldCategory): RealWorldQuery[] =>
    realWorldQueries.filter((q) => q.category === category);

export const getQueriesByDifficulty = (difficulty: Difficulty): RealWorldQuery[] =>
    realWorldQueries.filter((q) => q.difficulty === difficulty);

export const getWebSearchQueries = (): RealWorldQuery[] =>
    realWorldQueries.filter((q) => q.requiresWebSearch);

export const getEmotionalQueries = (): RealWorldQuery[] =>
    realWorldQueries.filter((q) => q.emotionalContext);

export const getQueriesByTag = (tag: string): RealWorldQuery[] =>
    realWorldQueries.filter((q) => q.tags.includes(tag));

// Category counts for validation
export const categoryCounts = {
    "everyday-life": everydayLifeQueries.length,
    "personal-growth": personalGrowthQueries.length,
    "work-productivity": workProductivityQueries.length,
    technical: technicalQueries.length,
    research: researchQueries.length,
    total: realWorldQueries.length,
};

// Stats
export const queryStats = {
    total: realWorldQueries.length,
    requiresWebSearch: realWorldQueries.filter((q) => q.requiresWebSearch).length,
    emotionalContext: realWorldQueries.filter((q) => q.emotionalContext).length,
    byDifficulty: {
        simple: realWorldQueries.filter((q) => q.difficulty === "simple").length,
        moderate: realWorldQueries.filter((q) => q.difficulty === "moderate").length,
        complex: realWorldQueries.filter((q) => q.difficulty === "complex").length,
    },
};

console.log("Real-world benchmark loaded:", categoryCounts);
console.log("Query stats:", queryStats);
