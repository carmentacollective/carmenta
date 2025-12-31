/**
 * Root Loading State - Breathing + Orbital Design
 *
 * Shows during page transitions and initial hydration.
 * Uses the unified "breathing logo with orbiting dot" design.
 *
 * Key timing sync (matches oracle-breathing animation):
 * - Breathing: 8.8s cycle
 * - Orbital: 4.4s (2 complete orbits per breath cycle)
 *
 * This loading state appears:
 * - During client-side navigation between routes
 * - While React Server Components are streaming
 * - During initial app hydration
 *
 * @see knowledge/components/pwa-mobile-enhancements.md
 */

export default function Loading() {
    return (
        <div className="z-loading bg-background fixed inset-0 flex items-center justify-center">
            {/* Keyframe animations and dark mode adjustments - inline to ensure they're available before CSS loads */}
            <style
                dangerouslySetInnerHTML={{
                    __html: `
                        @keyframes loaderBreathe {
                            0%, 100% { transform: scale(0.95); }
                            50% { transform: scale(1.05); }
                        }
                        @keyframes loaderSpin {
                            to { transform: rotate(360deg); }
                        }
                        @media (prefers-color-scheme: dark) {
                            .orbit-path-dark {
                                border-color: hsl(270 40% 56% / 0.15) !important;
                            }
                            .orbit-dot-dark {
                                box-shadow: 0 0 24px hsl(270 60% 65% / 0.6) !important;
                            }
                        }
                    `,
                }}
            />

            {/* Loading container */}
            <div
                className="relative"
                style={{
                    width: "min(50vh, 70vw)",
                    height: "min(50vh, 70vw)",
                }}
            >
                {/* Orbiting dot (4.4s = 2 orbits per 8.8s breath) */}
                <div
                    className="absolute -inset-[4%]"
                    style={{ animation: "loaderSpin 4.4s linear infinite" }}
                >
                    <div
                        className="orbit-dot-dark absolute top-0 left-1/2 rounded-full"
                        style={{
                            width: "min(2vh, 12px)",
                            height: "min(2vh, 12px)",
                            marginLeft: "min(-1vh, -6px)",
                            background:
                                "linear-gradient(135deg, hsl(270 60% 65%), hsl(240 60% 65%))",
                            boxShadow: "0 0 20px hsl(270 60% 65% / 0.5)",
                        }}
                    />
                </div>

                {/* Subtle orbit path */}
                <div
                    className="orbit-path-dark absolute -inset-[4%] rounded-full"
                    style={{
                        border: "1px solid hsl(270 40% 56% / 0.08)",
                    }}
                />

                {/* Large breathing logo (8.8s cycle) */}
                <div
                    className="absolute inset-0"
                    style={{
                        backgroundImage: "url('/logos/icon-transparent-192.png')",
                        backgroundSize: "contain",
                        backgroundPosition: "center",
                        backgroundRepeat: "no-repeat",
                        animation: "loaderBreathe 8.8s ease-in-out infinite",
                    }}
                />
            </div>
        </div>
    );
}
