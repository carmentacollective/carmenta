import Link from "next/link";

/**
 * CTA button that starts a new connection.
 * Always goes to /connection/new for a fresh conversation.
 */
export function ConnectCTA() {
    return (
        <Link
            href="/connection/new"
            className="group/btn relative inline-flex overflow-hidden rounded-full bg-white/80 px-8 py-3 shadow-lg backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl"
        >
            <span className="relative z-10 text-base font-medium text-foreground/80 transition-colors group-hover/btn:text-foreground">
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
