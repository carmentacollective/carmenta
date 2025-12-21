import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { Book, Sparkles } from "lucide-react";

import { SiteHeader } from "@/components/site-header";
import { HolographicBackground } from "@/components/ui/holographic-background";
import { KnowledgeViewer } from "@/components/knowledge-viewer";
import {
    getKBFolders,
    getValuesDocument,
    initializeKBWithClerkData,
    hasKBProfile,
    type KBFolder,
} from "@/lib/kb/actions";

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
    const user = await currentUser();

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
    const [userFolders, valuesDoc] = await Promise.all([
        getKBFolders(),
        getValuesDocument(),
    ]);

    // Build folder structure in order: philosophy, personality, knowledge
    // Note: System documentation moved to /guide page
    const allFolders: KBFolder[] = [];

    // 1. Heart-Centered Philosophy (top-level, not nested under Values)
    allFolders.push({
        id: "philosophy",
        name: "philosophy",
        path: "philosophy",
        documents: [valuesDoc],
    });

    // 2. AI Personality folder (from user profile folders)
    const profileFolder = userFolders.find((f) => f.path === "profile");
    if (profileFolder) {
        allFolders.push({
            ...profileFolder,
            id: "personality",
            name: "personality",
            path: "personality",
        });
    }

    // 3. Knowledge folder (from user folders, if exists)
    const knowledgeFolder = userFolders.find((f) => f.path === "knowledge");
    if (knowledgeFolder) {
        allFolders.push(knowledgeFolder);
    }

    return (
        <div className="relative flex min-h-screen flex-col">
            <HolographicBackground />

            <div className="relative z-10 flex flex-1 flex-col">
                <SiteHeader bordered />

                <main className="flex-1 px-6 py-8">
                    <div className="mx-auto flex h-full max-w-5xl flex-col gap-8">
                        {/* Header */}
                        <section className="space-y-2">
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
