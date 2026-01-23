/**
 * E2E Test Credentials Helper
 *
 * Provides consistent credential checking and developer-friendly warnings
 * when tests are skipped due to missing credentials.
 */

export const testCredentials = {
    clerkPublishableKey:
        process.env.CLERK_PUBLISHABLE_KEY ||
        process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    clerkSecretKey: process.env.CLERK_SECRET_KEY,
    testUserEmail: process.env.TEST_USER_EMAIL,
    testUserPassword: process.env.TEST_USER_PASSWORD,
};

export const hasClerkSecrets =
    !!testCredentials.clerkPublishableKey && !!testCredentials.clerkSecretKey;

export const hasTestUserCredentials =
    !!testCredentials.testUserEmail && !!testCredentials.testUserPassword;

export const hasAllCredentials = hasClerkSecrets && hasTestUserCredentials;

export type CredentialOptions = { requireTestUser?: boolean };

/**
 * Returns a skip reason and list of missing credentials.
 * Call this in test.describe() to get consistent messaging.
 */
export function checkCredentials(options?: CredentialOptions): {
    shouldSkip: boolean;
    skipReason: string;
    missing: string[];
} {
    const requireTestUser = options?.requireTestUser ?? true;
    const missing: string[] = [];

    if (!testCredentials.clerkPublishableKey) {
        missing.push("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY");
    }
    if (!testCredentials.clerkSecretKey) {
        missing.push("CLERK_SECRET_KEY");
    }
    if (requireTestUser) {
        if (!testCredentials.testUserEmail) {
            missing.push("TEST_USER_EMAIL");
        }
        if (!testCredentials.testUserPassword) {
            missing.push("TEST_USER_PASSWORD");
        }
    }

    if (missing.length === 0) {
        return { shouldSkip: false, skipReason: "", missing: [] };
    }

    return {
        shouldSkip: true,
        skipReason: `Missing credentials: ${missing.join(", ")}`,
        missing,
    };
}

/**
 * Escape special characters for GitHub Actions annotation format.
 * Per GitHub docs: %, \r, \n, and : need escaping in annotation values.
 */
function escapeAnnotation(str: string): string {
    return str
        .replace(/%/g, "%25")
        .replace(/\r/g, "%0D")
        .replace(/\n/g, "%0A")
        .replace(/:/g, "%3A");
}

/**
 * Emits a developer-friendly warning about skipped tests.
 * Call this in beforeAll() when tests will be skipped.
 *
 * In GitHub Actions, this creates a warning annotation visible in the UI.
 * Locally, it prints a formatted box to the console.
 */
export function warnSkippedTests(
    testSuiteName: string,
    options?: CredentialOptions
): void {
    const { shouldSkip, missing } = checkCredentials(options);
    if (!shouldSkip) return;

    const missingList = missing.join(", ");

    // GitHub Actions: Create a warning annotation that shows in the Actions UI
    if (process.env.GITHUB_ACTIONS) {
        const escapedName = escapeAnnotation(testSuiteName);
        console.log(
            `::warning title=Tests Skipped: ${escapedName}::Missing credentials: ${missingList}. Fork PRs cannot access repository secrets - these tests will run when merged to main.`
        );
        return;
    }

    // Local dev: Pretty formatted box (truncate long names)
    const maxNameLen = 44;
    const displayName =
        testSuiteName.length > maxNameLen
            ? testSuiteName.slice(0, maxNameLen - 3) + "..."
            : testSuiteName.padEnd(maxNameLen);

    console.warn(`
┌─────────────────────────────────────────────────────────────────┐
│  ⚠️  SKIPPING: ${displayName} │
├─────────────────────────────────────────────────────────────────┤
│  Missing environment variables:                                 │
${missing.map((v) => `│    • ${v.padEnd(56)} │`).join("\n")}
├─────────────────────────────────────────────────────────────────┤
│  To run these tests:                                            │
│                                                                 │
│  Local dev:                                                     │
│    Copy values from .env.example or ask a team member           │
│                                                                 │
│  Fork PRs:                                                      │
│    GitHub prevents forks from accessing repository secrets.     │
│    These tests will run when the PR is merged to main.          │
└─────────────────────────────────────────────────────────────────┘
`);
}
