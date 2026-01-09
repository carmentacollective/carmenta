/**
 * Generate synthetic test fixtures for import parsers
 *
 * Creates ZIP files matching the exact structure of ChatGPT and Anthropic exports
 * with completely fake data - NO real user data.
 *
 * Run with: npx ts-node __tests__/fixtures/import/generate-fixtures.ts
 */

import JSZip from "jszip";
import { writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const FIXTURE_DIR = __dirname;

// ============================================================================
// ChatGPT Export Fixture
// ============================================================================

function generateChatGPTFixture(): JSZip {
    const zip = new JSZip();

    // conversations.json - tree-based message structure with various content types
    const conversations = [
        // Conversation 1: Basic text conversation
        {
            id: "conv-001-text-basic",
            title: "How to make pasta",
            create_time: 1704067200, // 2024-01-01 00:00:00 UTC
            update_time: 1704070800, // 2024-01-01 01:00:00 UTC
            mapping: {
                "root-001": {
                    id: "root-001",
                    parent: null,
                    children: ["msg-001-user"],
                    message: null,
                },
                "msg-001-user": {
                    id: "msg-001-user",
                    parent: "root-001",
                    children: ["msg-001-assistant"],
                    message: {
                        id: "msg-001-user",
                        author: { role: "user" },
                        create_time: 1704067200,
                        update_time: 1704067200,
                        content: {
                            content_type: "text",
                            parts: ["What's the best way to cook pasta al dente?"],
                        },
                        status: "finished_successfully",
                        end_turn: true,
                        weight: 1,
                        metadata: {},
                        recipient: "all",
                    },
                },
                "msg-001-assistant": {
                    id: "msg-001-assistant",
                    parent: "msg-001-user",
                    children: [],
                    message: {
                        id: "msg-001-assistant",
                        author: { role: "assistant" },
                        create_time: 1704067260,
                        update_time: 1704067260,
                        content: {
                            content_type: "text",
                            parts: [
                                "To cook pasta al dente:\n\n1. Use plenty of water (about 4 quarts per pound)\n2. Salt generously\n3. Cook 1-2 minutes less than package directions\n4. Test by biting - should have slight resistance\n5. Reserve pasta water before draining",
                            ],
                        },
                        status: "finished_successfully",
                        end_turn: true,
                        weight: 1,
                        metadata: { model_slug: "gpt-4" },
                        recipient: "all",
                    },
                },
            },
            current_node: "msg-001-assistant",
            conversation_template_id: null,
            gizmo_id: null,
            is_archived: false,
            safe_urls: [],
            moderation_results: [],
            plugin_ids: null,
        },
        // Conversation 2: Code execution with output
        {
            id: "conv-002-code-exec",
            title: "Python fibonacci function",
            create_time: 1704153600, // 2024-01-02 00:00:00 UTC
            update_time: 1704157200,
            mapping: {
                "root-002": {
                    id: "root-002",
                    parent: null,
                    children: ["msg-002-user"],
                    message: null,
                },
                "msg-002-user": {
                    id: "msg-002-user",
                    parent: "root-002",
                    children: ["msg-002-code"],
                    message: {
                        id: "msg-002-user",
                        author: { role: "user" },
                        create_time: 1704153600,
                        update_time: 1704153600,
                        content: {
                            content_type: "text",
                            parts: [
                                "Write a Python function to calculate fibonacci numbers and run it for n=10",
                            ],
                        },
                        status: "finished_successfully",
                        end_turn: true,
                        weight: 1,
                        metadata: {},
                        recipient: "all",
                    },
                },
                "msg-002-code": {
                    id: "msg-002-code",
                    parent: "msg-002-user",
                    children: ["msg-002-output"],
                    message: {
                        id: "msg-002-code",
                        author: { role: "assistant", name: "python" },
                        create_time: 1704153660,
                        update_time: 1704153660,
                        content: {
                            content_type: "code",
                            language: "python",
                            text: 'def fibonacci(n):\n    if n <= 1:\n        return n\n    return fibonacci(n-1) + fibonacci(n-2)\n\nfor i in range(10):\n    print(f"fib({i}) = {fibonacci(i)}")',
                        },
                        status: "finished_successfully",
                        end_turn: false,
                        weight: 1,
                        metadata: { model_slug: "gpt-4" },
                        recipient: "all",
                    },
                },
                "msg-002-output": {
                    id: "msg-002-output",
                    parent: "msg-002-code",
                    children: ["msg-002-assistant"],
                    message: {
                        id: "msg-002-output",
                        author: { role: "tool", name: "python" },
                        create_time: 1704153700,
                        update_time: 1704153700,
                        content: {
                            content_type: "execution_output",
                            text: "fib(0) = 0\nfib(1) = 1\nfib(2) = 1\nfib(3) = 2\nfib(4) = 3\nfib(5) = 5\nfib(6) = 8\nfib(7) = 13\nfib(8) = 21\nfib(9) = 34",
                        },
                        status: "finished_successfully",
                        end_turn: false,
                        weight: 1,
                        metadata: {},
                        recipient: "all",
                    },
                },
                "msg-002-assistant": {
                    id: "msg-002-assistant",
                    parent: "msg-002-output",
                    children: [],
                    message: {
                        id: "msg-002-assistant",
                        author: { role: "assistant" },
                        create_time: 1704153750,
                        update_time: 1704153750,
                        content: {
                            content_type: "text",
                            parts: [
                                "The recursive fibonacci function has been executed. You can see the first 10 fibonacci numbers. Note that this recursive implementation has O(2^n) time complexity - for larger values, consider using memoization or an iterative approach.",
                            ],
                        },
                        status: "finished_successfully",
                        end_turn: true,
                        weight: 1,
                        metadata: { model_slug: "gpt-4" },
                        recipient: "all",
                    },
                },
            },
            current_node: "msg-002-assistant",
            conversation_template_id: null,
            gizmo_id: null,
            is_archived: false,
            safe_urls: [],
            moderation_results: [],
            plugin_ids: null,
        },
        // Conversation 3: Extended thinking (o1 model)
        {
            id: "conv-003-thinking",
            title: "Complex math problem",
            create_time: 1704240000, // 2024-01-03 00:00:00 UTC
            update_time: 1704243600,
            mapping: {
                "root-003": {
                    id: "root-003",
                    parent: null,
                    children: ["msg-003-user"],
                    message: null,
                },
                "msg-003-user": {
                    id: "msg-003-user",
                    parent: "root-003",
                    children: ["msg-003-thinking"],
                    message: {
                        id: "msg-003-user",
                        author: { role: "user" },
                        create_time: 1704240000,
                        update_time: 1704240000,
                        content: {
                            content_type: "text",
                            parts: ["Prove that the square root of 2 is irrational"],
                        },
                        status: "finished_successfully",
                        end_turn: true,
                        weight: 1,
                        metadata: {},
                        recipient: "all",
                    },
                },
                "msg-003-thinking": {
                    id: "msg-003-thinking",
                    parent: "msg-003-user",
                    children: ["msg-003-assistant"],
                    message: {
                        id: "msg-003-thinking",
                        author: { role: "assistant" },
                        create_time: 1704240060,
                        update_time: 1704240060,
                        content: {
                            content_type: "thoughts",
                            thoughts: [
                                {
                                    summary: "Considering proof approach",
                                    content:
                                        "The classic approach is proof by contradiction. Assume sqrt(2) is rational, meaning it can be expressed as a/b where a and b are coprime integers.",
                                    chunks: [],
                                    finished: true,
                                },
                                {
                                    summary: "Working through the algebra",
                                    content:
                                        "If sqrt(2) = a/b, then 2 = a²/b², so a² = 2b². This means a² is even, therefore a must be even. Let a = 2k for some integer k.",
                                    chunks: [],
                                    finished: true,
                                },
                            ],
                        },
                        status: "finished_successfully",
                        end_turn: false,
                        weight: 1,
                        metadata: {
                            model_slug: "o1-preview",
                            is_visually_hidden_from_conversation: true,
                        },
                        recipient: "all",
                    },
                },
                "msg-003-assistant": {
                    id: "msg-003-assistant",
                    parent: "msg-003-thinking",
                    children: [],
                    message: {
                        id: "msg-003-assistant",
                        author: { role: "assistant" },
                        create_time: 1704240120,
                        update_time: 1704240120,
                        content: {
                            content_type: "text",
                            parts: [
                                "**Proof that √2 is irrational:**\n\nAssume √2 is rational. Then √2 = a/b where a, b are coprime integers.\n\nSquaring: 2 = a²/b², so a² = 2b²\n\nThis means a² is even, so a must be even. Let a = 2k.\n\nThen: (2k)² = 2b² → 4k² = 2b² → 2k² = b²\n\nSo b² is even, meaning b is even.\n\nBut if both a and b are even, they're not coprime. Contradiction!\n\nTherefore √2 is irrational. ∎",
                            ],
                        },
                        status: "finished_successfully",
                        end_turn: true,
                        weight: 1,
                        metadata: { model_slug: "o1-preview" },
                        recipient: "all",
                    },
                },
            },
            current_node: "msg-003-assistant",
            conversation_template_id: null,
            gizmo_id: null,
            is_archived: false,
            safe_urls: [],
            moderation_results: [],
            plugin_ids: null,
        },
        // Conversation 4: Contains user_editable_context (Memory/Custom Instructions)
        {
            id: "conv-004-memory",
            title: "Session with memory context",
            create_time: 1704326400, // 2024-01-04 00:00:00 UTC
            update_time: 1704330000,
            mapping: {
                "root-004": {
                    id: "root-004",
                    parent: null,
                    children: ["msg-004-context"],
                    message: null,
                },
                "msg-004-context": {
                    id: "msg-004-context",
                    parent: "root-004",
                    children: ["msg-004-user"],
                    message: {
                        id: "msg-004-context",
                        author: { role: "system" },
                        create_time: 1704326400,
                        update_time: 1704326400,
                        content: {
                            content_type: "user_editable_context",
                            user_profile:
                                "TestUser is a software developer who prefers TypeScript. They work on web applications and enjoy hiking on weekends.",
                            user_instructions:
                                "Please provide code examples in TypeScript when possible. Be concise but thorough. Use metric units.",
                        },
                        status: "finished_successfully",
                        end_turn: false,
                        weight: 0,
                        metadata: { is_visually_hidden_from_conversation: true },
                        recipient: "all",
                    },
                },
                "msg-004-user": {
                    id: "msg-004-user",
                    parent: "msg-004-context",
                    children: ["msg-004-assistant"],
                    message: {
                        id: "msg-004-user",
                        author: { role: "user" },
                        create_time: 1704326460,
                        update_time: 1704326460,
                        content: {
                            content_type: "text",
                            parts: ["What's the best way to handle async errors?"],
                        },
                        status: "finished_successfully",
                        end_turn: true,
                        weight: 1,
                        metadata: {},
                        recipient: "all",
                    },
                },
                "msg-004-assistant": {
                    id: "msg-004-assistant",
                    parent: "msg-004-user",
                    children: [],
                    message: {
                        id: "msg-004-assistant",
                        author: { role: "assistant" },
                        create_time: 1704326520,
                        update_time: 1704326520,
                        content: {
                            content_type: "text",
                            parts: [
                                "For async error handling in TypeScript:\n\n```typescript\nasync function fetchData(): Promise<Data> {\n  try {\n    const response = await fetch(url);\n    if (!response.ok) throw new Error(`HTTP ${response.status}`);\n    return await response.json();\n  } catch (error) {\n    if (error instanceof Error) {\n      console.error('Fetch failed:', error.message);\n    }\n    throw error;\n  }\n}\n```\n\nKey patterns: always type your errors, use specific error classes, and consider whether to recover or rethrow.",
                            ],
                        },
                        status: "finished_successfully",
                        end_turn: true,
                        weight: 1,
                        metadata: { model_slug: "gpt-4" },
                        recipient: "all",
                    },
                },
            },
            current_node: "msg-004-assistant",
            conversation_template_id: null,
            gizmo_id: null,
            is_archived: false,
            safe_urls: [],
            moderation_results: [],
            plugin_ids: null,
        },
    ];

    // user.json
    const user = {
        id: "user-test-synthetic-001",
        email: "testuser@example.com",
        chatgpt_plus_user: true,
        birth_year: null,
    };

    // group_chats.json
    const groupChats = { chats: [] };

    // shared_conversations.json
    const sharedConversations = [
        {
            id: "share-001-synthetic",
            conversation_id: "conv-001-text-basic",
            title: "How to make pasta",
            is_anonymous: true,
        },
    ];

    // shopping.json
    const shopping: unknown[] = [];

    // message_feedback.json
    const messageFeedback: unknown[] = [];

    // sora.json
    const sora = {
        user: {
            id: "user-test-synthetic-001",
            name: "Test User",
            username: null,
            is_under_18: false,
        },
        generations: [],
        tasks: [
            {
                id: "task_synthetic_001",
                title: "Test Task",
                prompt: "A synthetic test video task",
            },
        ],
        presets: [],
        uploads: [],
    };

    // Add all files to ZIP
    zip.file("conversations.json", JSON.stringify(conversations, null, 2));
    zip.file("user.json", JSON.stringify(user, null, 2));
    zip.file("group_chats.json", JSON.stringify(groupChats, null, 2));
    zip.file("shared_conversations.json", JSON.stringify(sharedConversations, null, 2));
    zip.file("shopping.json", JSON.stringify(shopping, null, 2));
    zip.file("message_feedback.json", JSON.stringify(messageFeedback, null, 2));
    zip.file("sora.json", JSON.stringify(sora, null, 2));

    return zip;
}

// ============================================================================
// Anthropic Export Fixture
// ============================================================================

function generateAnthropicFixture(): JSZip {
    const zip = new JSZip();

    // conversations.json - linear message structure
    const conversations = [
        {
            uuid: "conv-anthropic-001",
            name: "Understanding recursion",
            summary: "A discussion about recursive algorithms",
            created_at: "2024-01-01T10:00:00.000Z",
            updated_at: "2024-01-01T10:30:00.000Z",
            account: "account-synthetic-001",
            chat_messages: [
                {
                    uuid: "msg-anthropic-001-a",
                    text: "Can you explain recursion in simple terms?",
                    sender: "human",
                    created_at: "2024-01-01T10:00:00.000Z",
                    updated_at: "2024-01-01T10:00:00.000Z",
                    content: [
                        {
                            type: "text",
                            text: "Can you explain recursion in simple terms?",
                            start_timestamp: "2024-01-01T10:00:00.000Z",
                            stop_timestamp: "2024-01-01T10:00:05.000Z",
                            citations: [],
                            flags: null,
                        },
                    ],
                    attachments: [],
                    files: [],
                },
                {
                    uuid: "msg-anthropic-001-b",
                    text: "Recursion is when a function calls itself to solve smaller versions of the same problem.\n\nThink of it like Russian nesting dolls - each doll contains a smaller version of itself until you reach the smallest one.\n\nA classic example is calculating factorial:\n- factorial(5) = 5 × factorial(4)\n- factorial(4) = 4 × factorial(3)\n- And so on until factorial(1) = 1\n\nEvery recursive function needs:\n1. A base case (when to stop)\n2. A recursive case (calling itself with a simpler input)",
                    sender: "assistant",
                    created_at: "2024-01-01T10:00:30.000Z",
                    updated_at: "2024-01-01T10:00:30.000Z",
                    content: [
                        {
                            type: "text",
                            text: "Recursion is when a function calls itself to solve smaller versions of the same problem.\n\nThink of it like Russian nesting dolls - each doll contains a smaller version of itself until you reach the smallest one.\n\nA classic example is calculating factorial:\n- factorial(5) = 5 × factorial(4)\n- factorial(4) = 4 × factorial(3)\n- And so on until factorial(1) = 1\n\nEvery recursive function needs:\n1. A base case (when to stop)\n2. A recursive case (calling itself with a simpler input)",
                            start_timestamp: "2024-01-01T10:00:10.000Z",
                            stop_timestamp: "2024-01-01T10:00:30.000Z",
                            citations: [],
                            flags: null,
                        },
                    ],
                    attachments: [],
                    files: [],
                },
            ],
        },
        {
            uuid: "conv-anthropic-002",
            name: "TypeScript generics",
            summary: "Learning about generic types in TypeScript",
            created_at: "2024-01-02T14:00:00.000Z",
            updated_at: "2024-01-02T14:45:00.000Z",
            account: "account-synthetic-001",
            chat_messages: [
                {
                    uuid: "msg-anthropic-002-a",
                    text: "How do I create a generic function in TypeScript?",
                    sender: "human",
                    created_at: "2024-01-02T14:00:00.000Z",
                    updated_at: "2024-01-02T14:00:00.000Z",
                    content: [
                        {
                            type: "text",
                            text: "How do I create a generic function in TypeScript?",
                            start_timestamp: "2024-01-02T14:00:00.000Z",
                            stop_timestamp: "2024-01-02T14:00:05.000Z",
                            citations: [],
                            flags: null,
                        },
                    ],
                    attachments: [],
                    files: [],
                },
                {
                    uuid: "msg-anthropic-002-b",
                    text: "Here's how to create a generic function in TypeScript:\n\n```typescript\nfunction identity<T>(value: T): T {\n  return value;\n}\n\n// Usage\nconst num = identity<number>(42);      // T is number\nconst str = identity<string>('hello'); // T is string\nconst inferred = identity(true);       // T is inferred as boolean\n```\n\nYou can also constrain generics:\n\n```typescript\nfunction getLength<T extends { length: number }>(item: T): number {\n  return item.length;\n}\n\ngetLength('hello');  // 5\ngetLength([1, 2, 3]); // 3\n```",
                    sender: "assistant",
                    created_at: "2024-01-02T14:00:45.000Z",
                    updated_at: "2024-01-02T14:00:45.000Z",
                    content: [
                        {
                            type: "text",
                            text: "Here's how to create a generic function in TypeScript:\n\n```typescript\nfunction identity<T>(value: T): T {\n  return value;\n}\n\n// Usage\nconst num = identity<number>(42);      // T is number\nconst str = identity<string>('hello'); // T is string\nconst inferred = identity(true);       // T is inferred as boolean\n```\n\nYou can also constrain generics:\n\n```typescript\nfunction getLength<T extends { length: number }>(item: T): number {\n  return item.length;\n}\n\ngetLength('hello');  // 5\ngetLength([1, 2, 3]); // 3\n```",
                            start_timestamp: "2024-01-02T14:00:10.000Z",
                            stop_timestamp: "2024-01-02T14:00:45.000Z",
                            citations: [],
                            flags: null,
                        },
                    ],
                    attachments: [],
                    files: [],
                },
                {
                    uuid: "msg-anthropic-002-c",
                    text: "What about multiple type parameters?",
                    sender: "human",
                    created_at: "2024-01-02T14:15:00.000Z",
                    updated_at: "2024-01-02T14:15:00.000Z",
                    content: [
                        {
                            type: "text",
                            text: "What about multiple type parameters?",
                            start_timestamp: "2024-01-02T14:15:00.000Z",
                            stop_timestamp: "2024-01-02T14:15:05.000Z",
                            citations: [],
                            flags: null,
                        },
                    ],
                    attachments: [],
                    files: [],
                },
                {
                    uuid: "msg-anthropic-002-d",
                    text: "You can use multiple type parameters like this:\n\n```typescript\nfunction pair<K, V>(key: K, value: V): [K, V] {\n  return [key, value];\n}\n\nconst result = pair('age', 30); // [string, number]\n```\n\nThis is especially useful for Map-like structures or when you need to relate multiple types.",
                    sender: "assistant",
                    created_at: "2024-01-02T14:15:30.000Z",
                    updated_at: "2024-01-02T14:15:30.000Z",
                    content: [
                        {
                            type: "text",
                            text: "You can use multiple type parameters like this:\n\n```typescript\nfunction pair<K, V>(key: K, value: V): [K, V] {\n  return [key, value];\n}\n\nconst result = pair('age', 30); // [string, number]\n```\n\nThis is especially useful for Map-like structures or when you need to relate multiple types.",
                            start_timestamp: "2024-01-02T14:15:10.000Z",
                            stop_timestamp: "2024-01-02T14:15:30.000Z",
                            citations: [],
                            flags: null,
                        },
                    ],
                    attachments: [],
                    files: [],
                },
            ],
        },
        {
            uuid: "conv-anthropic-003",
            name: "Empty conversation test",
            summary: null,
            created_at: "2024-01-03T09:00:00.000Z",
            updated_at: "2024-01-03T09:00:00.000Z",
            account: "account-synthetic-001",
            chat_messages: [], // Empty - should be skipped by parser
        },
    ];

    // users.json
    const users = [
        {
            uuid: "user-anthropic-synthetic-001",
            full_name: "Test User",
            email_address: "testuser@example.com",
            verified_phone_number: null,
        },
    ];

    // memories.json - User's Claude memory
    const memories = [
        {
            conversations_memory:
                "**Work context**\n\nTest User is a software developer working primarily with TypeScript and React. They focus on building web applications and have a preference for functional programming patterns.\n\n**Preferences**\n\nThey prefer concise code examples with comments explaining key decisions. They use VS Code as their primary editor.",
            project_memories: {
                "project-001-synthetic":
                    "This is a test project about building a CLI tool in Node.js",
                "project-002-synthetic":
                    "This project explores React Server Components patterns",
            },
            account_uuid: "account-synthetic-001",
        },
    ];

    // projects.json
    const projects = [
        {
            uuid: "project-001-synthetic",
            name: "CLI Tool Project",
            description: "Building a Node.js CLI tool",
            created_at: "2024-01-01T00:00:00.000Z",
            updated_at: "2024-01-02T00:00:00.000Z",
            is_private: false,
        },
        {
            uuid: "project-002-synthetic",
            name: "RSC Patterns",
            description: "Exploring React Server Components",
            created_at: "2024-01-02T00:00:00.000Z",
            updated_at: "2024-01-03T00:00:00.000Z",
            is_private: true,
        },
    ];

    // Add all files to ZIP
    zip.file("conversations.json", JSON.stringify(conversations, null, 2));
    zip.file("users.json", JSON.stringify(users, null, 2));
    zip.file("memories.json", JSON.stringify(memories, null, 2));
    zip.file("projects.json", JSON.stringify(projects, null, 2));

    return zip;
}

// ============================================================================
// Main
// ============================================================================

async function main() {
    console.log("Generating synthetic test fixtures...\n");

    // Generate ChatGPT fixture
    const chatgptZip = generateChatGPTFixture();
    const chatgptBuffer = await chatgptZip.generateAsync({ type: "nodebuffer" });
    const chatgptPath = join(FIXTURE_DIR, "chatgpt-export.zip");
    writeFileSync(chatgptPath, chatgptBuffer);
    console.log(`✓ ChatGPT fixture: ${chatgptPath} (${chatgptBuffer.length} bytes)`);

    // Generate Anthropic fixture
    const anthropicZip = generateAnthropicFixture();
    const anthropicBuffer = await anthropicZip.generateAsync({ type: "nodebuffer" });
    const anthropicPath = join(FIXTURE_DIR, "anthropic-export.zip");
    writeFileSync(anthropicPath, anthropicBuffer);
    console.log(
        `✓ Anthropic fixture: ${anthropicPath} (${anthropicBuffer.length} bytes)`
    );

    console.log("\nDone! Fixtures contain 100% synthetic data.");
}

main().catch(console.error);
