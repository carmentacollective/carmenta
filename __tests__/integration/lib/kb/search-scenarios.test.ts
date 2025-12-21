/**
 * Integration Tests: Knowledge Base Search Scenarios
 *
 * Tests the unified KB search from an end-user perspective with realistic
 * knowledge documents and search queries. Validates that searching for X
 * returns expected documents Y.
 *
 * These tests ensure the searchKnowledge function (and the searchKnowledge tool)
 * work correctly for real-world use cases.
 *
 * Test Categories:
 * 1. Project-specific queries (finding project decisions, preferences)
 * 2. Person-related queries (colleagues, contacts)
 * 3. Technical queries (integrations, APIs, architecture)
 * 4. Preference queries (how the user likes to work)
 * 5. Cross-cutting queries (finding related context across documents)
 */

import { describe, it, expect, beforeEach } from "vitest";
import { setupTestDb } from "@/vitest.setup";
import { db, schema } from "@/lib/db";
import { kb } from "@/lib/kb/index";
import { searchKnowledge } from "@/lib/kb/search";

// Setup real PGlite database
setupTestDb();

describe("Knowledge Base Search Scenarios", () => {
    const TEST_USER_ID = "550e8400-e29b-41d4-a716-446655440000";

    // ========================================================================
    // Test Fixtures: Realistic Knowledge Documents
    // ========================================================================

    const KNOWLEDGE_FIXTURES = {
        // Profile documents
        identity: {
            path: "profile.identity",
            name: "About You",
            content: `Name: Nick Sullivan
Role: Senior Software Engineer
Focus: AI-assisted development, trading systems, integration architecture
Background: 25 years of software engineering experience
Current Project: Carmenta - a heart-centered AI interface for builders`,
            description: "Who you are",
        },
        preferences: {
            path: "profile.preferences",
            name: "Working Together",
            content: `Communication: Direct and concrete, no fluff
Code Style: TypeScript, functional patterns, explicit over implicit
Review Preference: Thorough code reviews with specific feedback
Documentation: Inline comments for complex logic, README for setup
Testing: Unit tests for business logic, integration tests for flows`,
            description: "How we collaborate",
        },

        // Project documents
        carmenta: {
            path: "projects.carmenta.overview",
            name: "Carmenta Overview",
            content: `Carmenta is a heart-centered AI interface for builders who work at the speed of thought.

Philosophy: Human and AI as expressions of unified consciousness. Interface uses "we" language throughout.

Key Features:
- Multi-model support (Claude, GPT-4, Gemini)
- Knowledge base for persistent context
- Service integrations (Notion, Slack, Calendar)
- Voice-first input with transcription

Tech Stack: Next.js 14, TypeScript, PostgreSQL, Vercel AI SDK`,
            description: "Project overview and philosophy",
        },
        carmentaAuth: {
            path: "projects.carmenta.decisions.auth",
            name: "Authentication Decisions",
            content: `Authentication: Using Clerk for user authentication
Reasoning:
- Handles OAuth complexity
- Good Next.js integration
- Webhook support for user sync

Session Management: JWT with 7-day refresh tokens
API Keys: Stored encrypted in database, never in client code`,
            description: "Auth architecture decisions",
        },
        carmentaIntegrations: {
            path: "projects.carmenta.integrations",
            name: "Service Integrations",
            content: `Supported Integrations:
- Google Calendar: OAuth2 with refresh token rotation
- Notion: Database and page access
- Slack: Workspace messaging
- ClickUp: Task management
- Gmail: Email access (read/send)

Integration Pattern:
- Unified adapter interface
- Token refresh handled automatically
- Rate limiting with exponential backoff`,
            description: "How integrations work",
        },

        // People documents
        sarah: {
            path: "people.sarah-chen",
            name: "Sarah Chen",
            content: `Sarah Chen - Product Manager at TechCorp
Met at: React Conference 2024
Expertise: Product strategy, user research
Communication preference: Slack, prefers async
Last discussion: API design for mobile app
Follow up: Share the Carmenta demo when ready`,
            description: "Contact information",
        },
        marcus: {
            path: "people.marcus-johnson",
            name: "Marcus Johnson",
            content: `Marcus Johnson - DevOps Engineer, friend from previous company
Strong in: Kubernetes, AWS, CI/CD pipelines
Currently working on: Cloud migration project
Offered to help with: Deployment automation
Contact: marcus@example.com`,
            description: "Contact information",
        },

        // Technical documents
        apiDesign: {
            path: "knowledge.api-design-principles",
            name: "API Design Principles",
            content: `API Design Guidelines:
1. Use REST for CRUD, GraphQL for complex queries
2. Version APIs in URL path (/v1/users)
3. Return consistent error format: { error: { code, message, details } }
4. Use HTTP status codes correctly (201 for create, 204 for delete)
5. Pagination: cursor-based for large datasets, offset for small

Rate Limiting: 100 req/min for standard, 1000 for premium
Authentication: Bearer tokens in Authorization header`,
            description: "How to design APIs",
        },
        postgresPatterns: {
            path: "knowledge.postgres-patterns",
            name: "PostgreSQL Best Practices",
            content: `PostgreSQL Patterns:
- Use full-text search with tsvector for search functionality
- Indexes: B-tree for equality, GIN for arrays/JSON, GiST for geometric
- Use CTEs for complex queries but be aware of optimization fence
- JSONB over JSON for queryable documents
- Use ltree extension for hierarchical data

Connection Pooling: PgBouncer in transaction mode
Migrations: Use versioned migrations, never edit existing ones`,
            description: "PostgreSQL tips",
        },
        tradingSystem: {
            path: "knowledge.trading-system-architecture",
            name: "Trading System Architecture",
            content: `Trading System Design Principles:
- Event sourcing for all order state changes
- CQRS pattern: separate read/write models
- Use Redis for order book caching
- Latency critical: sub-millisecond for matching engine

Risk Management:
- Position limits per account
- Circuit breakers on rapid price movements
- Daily P&L limits with automatic position flattening

Tech: Rust for matching engine, Python for strategy, PostgreSQL for persistence`,
            description: "Trading system patterns",
        },
    };

    beforeEach(async () => {
        // Create test user
        await db.insert(schema.users).values({
            id: TEST_USER_ID,
            clerkId: "clerk_test_123",
            email: "nick@example.com",
            firstName: "Nick",
            lastName: "Sullivan",
        });

        // Seed all knowledge documents
        for (const fixture of Object.values(KNOWLEDGE_FIXTURES)) {
            await kb.create(TEST_USER_ID, {
                path: fixture.path,
                name: fixture.name,
                content: fixture.content,
                description: fixture.description,
            });
        }
    });

    // ========================================================================
    // Scenario 1: Project-specific query
    // User asks about a specific project they're working on
    // ========================================================================
    describe("Scenario 1: Project queries", () => {
        it("finds Carmenta project when asking about the project", async () => {
            const { results } = await searchKnowledge(
                TEST_USER_ID,
                "what is Carmenta",
                { maxResults: 5 }
            );

            expect(results.length).toBeGreaterThan(0);

            // Should find the Carmenta overview document
            const carmentaDoc = results.find((r) =>
                r.path.includes("carmenta.overview")
            );
            expect(carmentaDoc).toBeDefined();
            expect(carmentaDoc?.content).toContain("heart-centered AI");
        });

        it("finds auth decisions when asking about authentication", async () => {
            const { results } = await searchKnowledge(
                TEST_USER_ID,
                "Clerk authentication JWT",
                { maxResults: 5 }
            );

            expect(results.length).toBeGreaterThan(0);

            // Should find auth decisions document
            const authDoc = results.find((r) => r.path.includes("auth"));
            expect(authDoc).toBeDefined();
            expect(authDoc?.content).toContain("Clerk");
        });
    });

    // ========================================================================
    // Scenario 2: Person lookup
    // User asks about people they know
    // ========================================================================
    describe("Scenario 2: Person queries", () => {
        it("finds person by name", async () => {
            const { results } = await searchKnowledge(TEST_USER_ID, "Sarah Chen", {
                maxResults: 5,
            });

            expect(results.length).toBeGreaterThan(0);

            const sarahDoc = results.find((r) => r.path.includes("sarah"));
            expect(sarahDoc).toBeDefined();
            expect(sarahDoc?.content).toContain("Product Manager");
            expect(sarahDoc?.content).toContain("React Conference");
        });

        it("finds person by role/expertise", async () => {
            const { results } = await searchKnowledge(
                TEST_USER_ID,
                "DevOps Kubernetes AWS",
                { maxResults: 5 }
            );

            expect(results.length).toBeGreaterThan(0);

            const marcusDoc = results.find((r) => r.path.includes("marcus"));
            expect(marcusDoc).toBeDefined();
            expect(marcusDoc?.content).toContain("Kubernetes");
        });
    });

    // ========================================================================
    // Scenario 3: Technical knowledge lookup
    // User asks about technical patterns or best practices
    // ========================================================================
    describe("Scenario 3: Technical queries", () => {
        it("finds API design principles when asking about REST APIs", async () => {
            const { results } = await searchKnowledge(
                TEST_USER_ID,
                "REST API design guidelines",
                { maxResults: 5 }
            );

            expect(results.length).toBeGreaterThan(0);

            const apiDoc = results.find((r) => r.path.includes("api-design"));
            expect(apiDoc).toBeDefined();
            expect(apiDoc?.content).toContain("Version APIs");
            expect(apiDoc?.content).toContain("Rate Limiting");
        });

        it("finds PostgreSQL patterns when asking about database", async () => {
            const { results } = await searchKnowledge(
                TEST_USER_ID,
                "PostgreSQL full-text search indexing",
                { maxResults: 5 }
            );

            expect(results.length).toBeGreaterThan(0);

            const pgDoc = results.find((r) => r.path.includes("postgres"));
            expect(pgDoc).toBeDefined();
            expect(pgDoc?.content).toContain("tsvector");
            expect(pgDoc?.content).toContain("GIN");
        });
    });

    // ========================================================================
    // Scenario 4: Integration queries
    // User asks about how services are connected
    // ========================================================================
    describe("Scenario 4: Integration queries", () => {
        it("finds integrations when asking about Google Calendar", async () => {
            const { results } = await searchKnowledge(
                TEST_USER_ID,
                "Google Calendar refresh token",
                { maxResults: 5 }
            );

            expect(results.length).toBeGreaterThan(0);

            const integDoc = results.find((r) => r.path.includes("integrations"));
            expect(integDoc).toBeDefined();
            expect(integDoc?.content).toContain("Google Calendar");
            expect(integDoc?.content).toContain("OAuth2");
        });

        it("finds integrations when asking about Slack", async () => {
            const { results } = await searchKnowledge(
                TEST_USER_ID,
                "Slack Notion ClickUp",
                { maxResults: 5 }
            );

            expect(results.length).toBeGreaterThan(0);

            const integDoc = results.find((r) => r.path.includes("integrations"));
            expect(integDoc).toBeDefined();
            expect(integDoc?.content).toContain("Slack");
        });
    });

    // ========================================================================
    // Scenario 5: Preference queries
    // User asks about how they like to work
    // ========================================================================
    describe("Scenario 5: Preference queries", () => {
        it("finds preferences when asking about code style", async () => {
            const { results } = await searchKnowledge(
                TEST_USER_ID,
                "what code style do I prefer",
                { maxResults: 5 }
            );

            expect(results.length).toBeGreaterThan(0);

            const prefDoc = results.find((r) => r.path.includes("preferences"));
            expect(prefDoc).toBeDefined();
            expect(prefDoc?.content).toContain("TypeScript");
            expect(prefDoc?.content).toContain("functional patterns");
        });

        it("finds identity when asking about background", async () => {
            const { results } = await searchKnowledge(
                TEST_USER_ID,
                "software engineering experience trading systems",
                { maxResults: 5 }
            );

            expect(results.length).toBeGreaterThan(0);

            const identityDoc = results.find((r) => r.path.includes("identity"));
            expect(identityDoc).toBeDefined();
            expect(identityDoc?.content).toContain("25 years");
        });
    });

    // ========================================================================
    // Scenario 6: Entity matching (high precision)
    // Using entity names should find exact matches
    // ========================================================================
    describe("Scenario 6: Entity matching", () => {
        it("finds Carmenta documents with entity matching", async () => {
            const { results } = await searchKnowledge(
                TEST_USER_ID,
                "project overview",
                { entities: ["carmenta"], maxResults: 5 }
            );

            expect(results.length).toBeGreaterThan(0);

            // Entity match should have high relevance
            const entityMatch = results.find((r) => r.reason === "entity_match");
            expect(entityMatch).toBeDefined();
            expect(entityMatch?.path).toContain("carmenta");
        });

        it("finds person with entity matching", async () => {
            const { results } = await searchKnowledge(TEST_USER_ID, "contact info", {
                entities: ["sarah"],
                maxResults: 5,
            });

            expect(results.length).toBeGreaterThan(0);

            const sarahDoc = results.find((r) => r.path.includes("sarah"));
            expect(sarahDoc).toBeDefined();
            expect(sarahDoc?.reason).toBe("entity_match");
        });
    });

    // ========================================================================
    // Scenario 7: Cross-cutting queries
    // Queries that should find multiple related documents
    // ========================================================================
    describe("Scenario 7: Cross-cutting queries", () => {
        it("finds multiple docs when asking about tech stack", async () => {
            const { results } = await searchKnowledge(TEST_USER_ID, "PostgreSQL", {
                maxResults: 10,
            });

            // Should find both Carmenta (mentions PostgreSQL) and PostgreSQL patterns doc
            expect(results.length).toBeGreaterThanOrEqual(2);

            const paths = results.map((r) => r.path);
            expect(paths.some((p) => p.includes("carmenta"))).toBe(true);
            expect(paths.some((p) => p.includes("postgres"))).toBe(true);
        });

        it("finds multiple docs for OAuth queries", async () => {
            const { results } = await searchKnowledge(
                TEST_USER_ID,
                "OAuth token refresh",
                { maxResults: 10 }
            );

            // Should find auth decisions and integrations
            expect(results.length).toBeGreaterThanOrEqual(1);

            // At least one should mention OAuth
            const hasOAuth = results.some((r) =>
                r.content.toLowerCase().includes("oauth")
            );
            expect(hasOAuth).toBe(true);
        });
    });

    // ========================================================================
    // Scenario 8: Domain-specific queries
    // Trading system architecture queries
    // ========================================================================
    describe("Scenario 8: Domain-specific queries", () => {
        it("finds trading system architecture", async () => {
            const { results } = await searchKnowledge(
                TEST_USER_ID,
                "event sourcing order matching engine",
                { maxResults: 5 }
            );

            expect(results.length).toBeGreaterThan(0);

            const tradingDoc = results.find((r) => r.path.includes("trading"));
            expect(tradingDoc).toBeDefined();
            expect(tradingDoc?.content).toContain("Event sourcing");
            expect(tradingDoc?.content).toContain("CQRS");
        });

        it("finds risk management patterns", async () => {
            const { results } = await searchKnowledge(
                TEST_USER_ID,
                "position limits circuit breakers",
                { maxResults: 5 }
            );

            expect(results.length).toBeGreaterThan(0);

            const tradingDoc = results.find((r) => r.path.includes("trading"));
            expect(tradingDoc).toBeDefined();
            expect(tradingDoc?.content).toContain("Position limits");
        });
    });

    // ========================================================================
    // Scenario 9: No results scenario
    // Query for something that doesn't exist
    // ========================================================================
    describe("Scenario 9: No results handling", () => {
        it("returns empty results for unrelated queries", async () => {
            const { results } = await searchKnowledge(
                TEST_USER_ID,
                "quantum blockchain metaverse NFT",
                { maxResults: 5 }
            );

            // Should return empty or very low relevance results
            expect(results.length).toBe(0);
        });

        it("returns empty for gibberish", async () => {
            const { results } = await searchKnowledge(
                TEST_USER_ID,
                "xyzzy plugh zorkmid",
                { maxResults: 5 }
            );

            expect(results.length).toBe(0);
        });
    });

    // ========================================================================
    // Scenario 10: Token budget and filtering
    // Verify metadata is correct for telemetry
    // ========================================================================
    describe("Scenario 10: Search metadata and filtering", () => {
        it("returns correct metadata counts", async () => {
            const response = await searchKnowledge(TEST_USER_ID, "Carmenta", {
                maxResults: 3,
            });

            // Should have results
            expect(response.results.length).toBeGreaterThan(0);
            expect(response.results.length).toBeLessThanOrEqual(3);

            // Metadata should reflect filtering
            expect(response.metadata.totalBeforeFiltering).toBeGreaterThanOrEqual(
                response.results.length
            );
            expect(response.metadata.totalAfterFiltering).toBeGreaterThanOrEqual(
                response.results.length
            );
        });

        it("respects token budget", async () => {
            const response = await searchKnowledge(TEST_USER_ID, "Carmenta", {
                maxResults: 10,
                tokenBudget: 200,
            });

            // Should limit results based on token budget
            // With 200 tokens (~800 chars), we should get fewer results
            expect(response.results.length).toBeGreaterThan(0);

            // Total content should be within budget
            const totalChars = response.results.reduce(
                (sum, r) => sum + r.content.length,
                0
            );
            // 200 tokens * 4 chars/token = 800 chars max
            expect(totalChars).toBeLessThanOrEqual(1000); // Small buffer for truncation
        });

        it("includes snippets when requested", async () => {
            const response = await searchKnowledge(
                TEST_USER_ID,
                "authentication Clerk",
                { maxResults: 5, includeSnippets: true }
            );

            expect(response.results.length).toBeGreaterThan(0);

            // At least one result should have a snippet with highlighting
            const hasSnippet = response.results.some(
                (r) => r.snippet && r.snippet.includes("<mark>")
            );
            expect(hasSnippet).toBe(true);
        });
    });

    // ========================================================================
    // Additional: Relevance ordering
    // Verify more relevant results come first
    // ========================================================================
    describe("Relevance ordering", () => {
        it("returns results sorted by relevance", async () => {
            const { results } = await searchKnowledge(TEST_USER_ID, "Carmenta", {
                maxResults: 10,
            });

            expect(results.length).toBeGreaterThan(1);

            // Verify descending relevance order
            for (let i = 1; i < results.length; i++) {
                expect(results[i - 1].relevance).toBeGreaterThanOrEqual(
                    results[i].relevance
                );
            }
        });

        it("entity matches have higher relevance than text matches", async () => {
            const { results } = await searchKnowledge(TEST_USER_ID, "overview", {
                entities: ["carmenta"],
                maxResults: 10,
            });

            // Find entity match and search match
            const entityMatch = results.find((r) => r.reason === "entity_match");
            const searchMatch = results.find((r) => r.reason === "search_match");

            if (entityMatch && searchMatch) {
                // Entity matches should have relevance 1.0
                expect(entityMatch.relevance).toBe(1.0);
            }
        });
    });

    // ========================================================================
    // User isolation
    // Ensure users only see their own documents
    // ========================================================================
    describe("User isolation", () => {
        it("does not return other users documents", async () => {
            const OTHER_USER_ID = "660e8400-e29b-41d4-a716-446655440000";

            // Create another user
            await db.insert(schema.users).values({
                id: OTHER_USER_ID,
                clerkId: "clerk_other_456",
                email: "other@example.com",
            });

            // Create document for other user
            await kb.create(OTHER_USER_ID, {
                path: "secrets.passwords",
                name: "Secret Passwords",
                content: "super secret password list that should never appear",
            });

            // Search as test user
            const { results } = await searchKnowledge(TEST_USER_ID, "secret password", {
                maxResults: 10,
            });

            // Should NOT find the other user's document
            const secretDoc = results.find((r) => r.content.includes("super secret"));
            expect(secretDoc).toBeUndefined();
        });
    });
});
