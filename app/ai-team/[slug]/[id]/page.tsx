import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { loadJob } from "@/lib/actions/jobs";
import { isValidJobId, generateJobSlug } from "@/lib/sqids";

import { EditAutomationForm } from "./edit-form";

interface EditJobPageProps {
    params: Promise<{ slug: string; id: string }>;
}

/**
 * Generate dynamic metadata for SEO.
 *
 * Page title format: "{Job Name} · AI Team · Carmenta"
 */
export async function generateMetadata({
    params,
}: EditJobPageProps): Promise<Metadata> {
    const { id } = await params;

    if (!isValidJobId(id)) {
        return { title: "Lost · Carmenta" };
    }

    const job = await loadJob(id);

    if (!job) {
        return { title: "Lost · Carmenta" };
    }

    return {
        title: `${job.name} · AI Team · Carmenta`,
        description: `Configure ${job.name} - your AI team member automation`,
    };
}

export default async function EditJobPage({ params }: EditJobPageProps) {
    const { slug, id } = await params;

    if (!isValidJobId(id)) {
        notFound();
    }

    const job = await loadJob(id);

    if (!job) {
        notFound();
    }

    // Redirect to canonical URL if slug doesn't match
    const expectedSlug = generateJobSlug(job.name);
    if (slug !== expectedSlug) {
        redirect(`/ai-team/${expectedSlug}/${id}`);
    }

    return <EditAutomationForm job={job} />;
}
