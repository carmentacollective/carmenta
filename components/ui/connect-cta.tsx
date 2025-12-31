import Link from "next/link";

/**
 * CTA button that starts a new connection.
 * The ?new param signals a fresh conversation state.
 */
export function ConnectCTA() {
    return (
        <Link
            href="/connection?new"
            prefetch={false}
            className="btn-glass-interactive group/btn relative inline-flex overflow-hidden rounded-full px-8 py-3"
        >
            <span className="z-content text-foreground/80 group-hover/btn:text-foreground relative text-base font-medium transition-colors">
                Connect
            </span>
            <div
                className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover/btn:opacity-100"
                style={{
                    background:
                        "linear-gradient(135deg, rgba(200,160,220,0.2), rgba(160,200,220,0.2))",
                }}
            />
        </Link>
    );
}
