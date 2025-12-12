import Link from "next/link";

/**
 * Not Found Page (404)
 *
 * Shown when a user navigates to a page that doesn't exist.
 * Maintains Carmenta's heart-centered aesthetic while helping users
 * find their way.
 */
export default function NotFound() {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
            <div className="mx-auto max-w-md space-y-6">
                {/* Icon */}
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500/10 to-purple-500/10">
                    <svg
                        className="h-10 w-10 text-indigo-500"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        aria-hidden="true"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                    </svg>
                </div>

                {/* Heading */}
                <h1 className="text-3xl font-semibold tracking-tight text-foreground">
                    Page Not Found
                </h1>

                {/* Description */}
                <p className="text-lg text-muted-foreground">
                    This page doesn&apos;t exist—it may have moved or the link is
                    outdated.
                </p>

                {/* Actions */}
                <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                    <Link
                        href="/"
                        className="inline-flex items-center justify-center rounded-lg bg-primary px-6 py-3 font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                        Go Home
                    </Link>
                    <Link
                        href="/connection/new"
                        className="inline-flex items-center justify-center rounded-lg border border-input bg-background px-6 py-3 font-medium text-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                        Start Creating
                    </Link>
                </div>
            </div>
        </div>
    );
}
