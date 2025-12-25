import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { Book, Sparkles } from "lucide-react";

import { SiteHeader } from "@/components/site-header";
import { HolographicBackground } from "@/components/ui/holographic-background";
import { KnowledgeViewer } from "@/components/knowledge-viewer";
import {
    getKBFolders,
    initializeKBWithClerkData,
    hasKBProfile,
    getRecentActivity,
    type KBFolder,
    type ActivityItem,
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
    const [userFolders, activityItems] = await Promise.all([
        getKBFolders(),
        getRecentActivity(),
    ]);

    // Build folder structure: Profile, Communication, Memories
    // Philosophy (Heart-Centered AI) is displayed on dedicated /philosophy page
    const allFolders: KBFolder[] = [];
    const profileFolder = userFolders.find((f) => f.path === "profile");

    // 1. Profile - personal identity info (displays as "About You" document)
    if (profileFolder) {
        const identityDoc = profileFolder.documents.find(
            (d) => d.path === "profile.identity"
        );
        if (identityDoc) {
            allFolders.push({
                id: "about",
                name: "about",
                path: "about",
                documents: [identityDoc],
            });
        }
    }

    // 2. Communication - voice, style, working together
    if (profileFolder) {
        const communicationDocs = profileFolder.documents.filter(
            (d) => d.path === "profile.character" || d.path === "profile.preferences"
        );
        if (communicationDocs.length > 0) {
            allFolders.push({
                id: "communication",
                name: "communication",
                path: "communication",
                documents: communicationDocs,
            });
        }
    }

    // 3. Memories - learned knowledge from conversations
    const knowledgeFolder = userFolders.find((f) => f.path === "knowledge");
    if (knowledgeFolder) {
        allFolders.push({
            ...knowledgeFolder,
            id: "memories",
            name: "memories",
            path: "memories",
        });
    } else {
        allFolders.push({
            id: "memories",
            name: "memories",
            path: "memories",
            documents: [
                {
                    id: "memories-placeholder",
                    path: "_placeholder.memories",
                    name: "Coming Soon",
                    content:
                        "What we learn together will appear here.\n\nSoon we'll capture insights, preferences, and context from our conversations.",
                    description: "What we learn from our conversations",
                    promptLabel: null,
                    editable: false,
                    updatedAt: new Date(),
                },
            ],
        });
    }

    return (
        <div className="relative flex min-h-screen flex-col">
            <HolographicBackground />

            <div className="relative z-content flex flex-1 flex-col">
                <SiteHeader bordered />

                <main className="flex-1 px-6 py-8">
                    <div className="mx-auto flex h-full max-w-5xl flex-col gap-8">
                        {/* Header */}
                        <section className="space-y-2">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="rounded-xl bg-primary/20 p-3">
                                        <Book className="h-6 w-6 text-primary" />
                                    </div>
                                    <div>
                                        <h1 className="text-3xl font-light tracking-tight text-foreground">
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

                        {/* Knowledge Viewer */}
                        <section className="min-h-[500px] flex-1">
                            {allFolders.length === 0 ? (
                                <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-foreground/5 bg-foreground/[0.02] py-16 text-center">
                                    <Sparkles className="mb-4 h-12 w-12 text-foreground/30" />
                                    <h3 className="text-lg font-medium text-foreground/80">
                                        We're setting up your knowledge base
                                    </h3>
                                    <p className="mt-2 text-sm text-foreground/60">
                                        Refresh the page in a moment.
                                    </p>
                                </div>
                            ) : (
                                <KnowledgeViewer initialFolders={allFolders} />
                            )}
                        </section>
                    </div>
                </main>
            </div>
        </div>
    );
}
