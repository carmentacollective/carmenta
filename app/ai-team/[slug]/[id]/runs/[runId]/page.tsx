import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { loadJob } from "@/lib/actions/jobs";
import { isValidJobId, generateJobSlug } from "@/lib/sqids";
import { StandardPageLayout } from "@/components/layouts/standard-page-layout";
import { JobRunDetail } from "@/components/ai-team/job-run-detail";

interface RunDetailPageProps {
    params: Promise<{ slug: string; id: string; runId: string }>;
}

/**
 * Generate dynamic metadata for SEO.
 */
export async function generateMetadata({
    params,
}: RunDetailPageProps): Promise<Metadata> {
    const { id } = await params;

    if (!isValidJobId(id)) {
        return { title: "Lost · Carmenta" };
    }

    const job = await loadJob(id);

    if (!job) {
        return { title: "Lost · Carmenta" };
    }

    return {
        title: `Run Details · ${job.name} · AI Team · Carmenta`,
        description: `View execution details for ${job.name}`,
    };
}

export default async function RunDetailPage({ params }: RunDetailPageProps) {
    const { slug, id, runId } = await params;

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
        redirect(`/ai-team/${expectedSlug}/${id}/runs/${runId}`);
    }

    return (
        <StandardPageLayout maxWidth="standard" contentClassName="py-8">
            <JobRunDetail
                jobId={job.internalId}
                runId={runId}
                jobSlug={slug}
                jobEncodedId={id}
            />
        </StandardPageLayout>
    );
}
