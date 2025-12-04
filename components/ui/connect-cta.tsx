import Link from "next/link";

/**
 * CTA button that starts a new connection.
 * Always goes to /connection/new for a fresh conversation.
 */
export function ConnectCTA() {
    return (
        <Link
            href="/connection/new"
            className="btn-holo inline-flex items-center gap-2"
        >
            <span>Start Connecting</span>
            <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
            >
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 7l5 5m0 0l-5 5m5-5H6"
                />
            </svg>
        </Link>
    );
}
