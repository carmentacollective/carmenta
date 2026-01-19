"use client";

/**
 * Communication Content
 *
 * Client component for the communication page that uses KnowledgeExplorer
 * to display voice/style and collaboration preferences.
 */

import { useRouter } from "next/navigation";
import { KnowledgeExplorer, type KBDocumentData } from "@/components/kb";
import type { KBDocument } from "@/lib/kb/actions";

interface CommunicationContentProps {
    documents: KBDocument[];
}

export function CommunicationContent({ documents }: CommunicationContentProps) {
    const router = useRouter();

    return (
        <KnowledgeExplorer
            documents={documents as KBDocumentData[]}
            mode="edit"
            enableSearch={false}
            onDocumentUpdate={() => router.refresh()}
            treeHeader={
                <h3 className="text-muted-foreground mb-3 text-xs font-medium tracking-wide uppercase">
                    Communication
                </h3>
            }
        />
    );
}
