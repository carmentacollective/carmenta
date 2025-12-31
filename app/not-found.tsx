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
        <div className="bg-background flex min-h-screen flex-col items-center justify-center px-4 text-center">
            <div className="mx-auto max-w-md space-y-6">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src="/logos/icon-transparent.png"
                    alt="Carmenta"
                    className="mx-auto h-12 w-12 opacity-90"
                />

                <h1 className="text-foreground text-2xl font-semibold tracking-tight">
                    Nothing here
                </h1>

                <p className="text-muted-foreground leading-relaxed">
                    This path doesn&apos;t lead anywhere—it may have moved or the link
                    is outdated.
                </p>

                <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                    <Link
                        href="/"
                        className="bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:outline-ring inline-flex items-center justify-center rounded-lg px-6 py-3 font-medium shadow-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                    >
                        Go home
                    </Link>
                    <Link
                        href="/connection?new"
                        className="border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground focus-visible:outline-ring inline-flex items-center justify-center rounded-lg border px-6 py-3 font-medium shadow-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                    >
                        Start connecting
                    </Link>
                </div>
            </div>
        </div>
    );
}
