import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { Book } from "@phosphor-icons/react/dist/ssr";

import { StandardPageLayout } from "@/components/layouts/standard-page-layout";
import { KBPageContent } from "@/components/knowledge-viewer/kb-page-content";
import {
    getKBFolders,
    initializeKBWithClerkData,
    hasKBProfile,
    getRecentActivity,
    type KBFolder,
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

    // Build folder structure: Profile, Memories
    // Communication preferences are on dedicated /communication page
    // Philosophy (Heart-Centered AI) is on dedicated /philosophy page
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
                children: [],
            });
        }
    }

    // 2. Memories - learned knowledge from conversations
    // Aggregate ALL folders under knowledge.* namespace (knowledge.people, knowledge.preferences, etc.)
    // Since getKBFolders() now returns a tree structure with nested children,
    // we need to recursively collect all documents from the knowledge folder and its descendants
    const knowledgeFolder = userFolders.find((f) => f.path === "knowledge");

    // Helper to recursively collect all documents from a folder and its children
    const collectAllDocuments = (folder: KBFolder): typeof folder.documents => {
        const docs = [...folder.documents];
        for (const child of folder.children) {
            docs.push(...collectAllDocuments(child));
        }
        return docs;
    };

    // Filter out documents that duplicate profile content (about-you, identity, etc.)
    // These belong in profile.identity, not knowledge.*
    const knowledgeDocuments = knowledgeFolder
        ? collectAllDocuments(knowledgeFolder).filter(
              (d) =>
                  !d.path.toLowerCase().includes("about") &&
                  !d.path.toLowerCase().includes("identity")
          )
        : [];

    if (knowledgeDocuments.length > 0) {
        allFolders.push({
            id: "memories",
            name: "memories",
            path: "memories",
            documents: knowledgeDocuments.sort((a, b) => a.name.localeCompare(b.name)),
            children: [],
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
            children: [],
        });
    }

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

            {/* Librarian Task Bar + Knowledge Viewer */}
            <KBPageContent initialFolders={allFolders} />
        </StandardPageLayout>
    );
}
