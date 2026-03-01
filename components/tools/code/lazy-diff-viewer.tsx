"use client";

/**
 * LazyDiffViewer - Lazily-loaded DiffViewer with loading skeleton
 *
 * Single source of truth for the dynamic DiffViewer import (~50kB).
 * All consumers import this instead of DiffViewer directly to keep
 * the module out of the initial bundle and avoid layout shift.
 */

import dynamic from "next/dynamic";

export const LazyDiffViewer = dynamic(
    () => import("./diff-viewer").then((m) => ({ default: m.DiffViewer })),
    {
        ssr: false,
        loading: () => <div className="bg-muted h-32 animate-pulse rounded" />,
    }
);
