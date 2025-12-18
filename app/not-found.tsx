import Link from "next/link";

/**
 * Not Found Page (404)
 *
 * Shown when a user navigates to a page that doesn't exist.
 * Maintains Carmenta's heart-centered voice while helping users
 * find their way.
 */
export default function NotFound() {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
            <div className="mx-auto max-w-md space-y-6">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src="/logos/icon-transparent.png"
                    alt="Carmenta"
                    className="mx-auto h-12 w-12 opacity-90"
                />

                <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                    Nothing here
                </h1>

                <p className="leading-relaxed text-muted-foreground">
                    This path doesn&apos;t lead anywhere—it may have moved or the link
                    is outdated.
                </p>

                <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                    <Link
                        href="/"
                        className="inline-flex items-center justify-center rounded-lg bg-primary px-6 py-3 font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                        Go home
                    </Link>
                    <Link
                        href="/connection/new"
                        className="inline-flex items-center justify-center rounded-lg border border-input bg-background px-6 py-3 font-medium text-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                        Start connecting
                    </Link>
                </div>
            </div>
        </div>
    );
}
