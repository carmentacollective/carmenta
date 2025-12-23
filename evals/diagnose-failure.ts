import { config } from "dotenv";
config({ path: ".env.local" });
import { testData } from "./routing-test-data";

const BASE_URL = "http://localhost:3000";
const JWT_TOKEN = process.env.TEST_USER_TOKEN;

function buildMessage(content: string) {
    return {
        id: "test-" + Date.now(),
        role: "user",
        content,
        parts: [{ type: "text", text: content }],
    };
}

async function testOne(test: (typeof testData)[0]) {
    if (!test.expected.model) return null;

    const content = Array.isArray(test.input.content)
        ? test.input.content[0]
        : test.input.content;

    const response = await fetch(BASE_URL + "/api/connection", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + JWT_TOKEN,
        },
        body: JSON.stringify({
            messages: [buildMessage(content)],
            ...test.input.overrides,
        }),
    });

    const model = response.headers.get("X-Concierge-Model-Id") || "";
    const explanation = response.headers.get("X-Concierge-Explanation") || "";
    const status = response.status;
    const expectedPatterns = test.expected.model.split("|");
    const matches = expectedPatterns.some((p) =>
        model.toLowerCase().includes(p.toLowerCase())
    );

    return {
        id: test.input.id,
        description: test.input.description,
        query: content.slice(0, 60),
        expected: test.expected.model,
        actual: model || "(empty - status " + status + ")",
        explanation,
        matches,
    };
}

async function main() {
    console.log(
        "Token loaded:",
        JWT_TOKEN ? "yes (" + JWT_TOKEN.length + " chars)" : "NO!"
    );
    console.log("Testing model selection...\n");

    let passed = 0;
    let failed = 0;

    for (const test of testData) {
        const result = await testOne(test);
        if (result) {
            if (result.matches) {
                passed++;
            } else {
                failed++;
                console.log("❌ FAILED: " + result.id);
                console.log("   Desc:     " + result.description);
                console.log("   Query:    " + result.query + "...");
                console.log("   Expected: " + result.expected);
                console.log("   Actual:   " + result.actual);
                console.log(
                    "   Why:      " + (result.explanation || "(no explanation)") + "\n"
                );
            }
        }
    }

    console.log("Done. Passed: " + passed + ", Failed: " + failed);
}

main().catch(console.error);
