import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { Book } from "@phosphor-icons/react/dist/ssr";

import { StandardPageLayout } from "@/components/layouts/standard-page-layout";
import { KBPageContent } from "@/components/knowledge-viewer/kb-page-content";
import {
    getKBDocuments,
    initializeKBWithClerkData,
    hasKBProfile,
    getRecentActivity,
    type KBDocument,
} from "@/lib/kb/actions";
import { ActivityFeed } from "@/components/knowledge-viewer/activity-feed";

export const metadata: Metadata = {
    title: "Knowledge Base · Carmenta",
    description: "View and shape our shared understanding.",
};

/**
 * Knowledge Base Page
 *
 * Displays the user's knowledge base with tree navigation and content editor.
 * Uses Option 3 design: clean tree view with ⌘K command palette.
 *
 * Profile Seeding:
 * On first visit, initializes the user's KB profile with their name from Clerk.
 * This creates identity.txt and instructions.txt documents.
 */
export default async function KnowledgeBasePage() {
    // Get current user from Clerk
    // Handle CI environments where Clerk may not be properly initialized
    let user;
    try {
        user = await currentUser();
    } catch {
        // In CI/test environments, Clerk may throw - treat as unauthenticated
        redirect("/sign-in?redirect_url=/knowledge-base");
    }

    if (!user) {
        // Redirect to sign-in if not authenticated
        redirect("/sign-in?redirect_url=/knowledge-base");
    }

    // Check if user has a profile, initialize if not
    const hasProfile = await hasKBProfile();
    if (!hasProfile) {
        await initializeKBWithClerkData({
            firstName: user.firstName,
            lastName: user.lastName,
            fullName: user.fullName,
            email: user.primaryEmailAddress?.emailAddress ?? null,
        });
    }

    // Fetch KB data in parallel
    const [allDocuments, activityItems] = await Promise.all([
        getKBDocuments(),
        getRecentActivity(),
    ]);

    // Extract the identity document for prominent display at top of KB
    // All other documents go to the unified explorer
    const identityDoc = allDocuments.find((d) => d.path === "profile.identity") ?? null;

    // Filter out identity doc - it's shown separately in "About You" section
    const explorerDocuments = allDocuments.filter((d) => d.path !== "profile.identity");

    return (
        <StandardPageLayout
            maxWidth="standard"
            contentClassName="flex h-full flex-col gap-8 py-8"
        >
            {/* Header */}
            <section className="space-y-2">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-primary/20 rounded-xl p-3">
                            <Book className="text-primary h-6 w-6" />
                        </div>
                        <div>
                            <h1 className="text-foreground text-3xl font-light tracking-tight">
                                Knowledge Base
                            </h1>
                            <p className="text-foreground/70">
                                What we remember together
                            </p>
                        </div>
                    </div>

                    {/* Activity Feed */}
                    {activityItems.length > 0 && (
                        <ActivityFeed initialItems={activityItems} />
                    )}
                </div>
            </section>

            {/* About You + Knowledge Explorer */}
            <KBPageContent
                identityDocument={identityDoc}
                documents={explorerDocuments}
            />
        </StandardPageLayout>
    );
}
