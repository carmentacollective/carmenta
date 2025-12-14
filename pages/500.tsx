/**
 * Static 500 Error Page
 *
 * This page is statically generated at build time and served for server-side
 * errors that occur before React rendering starts. This is an escape hatch
 * for catastrophic errors that the App Router's error.tsx can't catch.
 *
 * When this page renders:
 * - The error happened during SSR before streaming started
 * - The App Router's global-error.tsx couldn't catch it
 * - This is typically deployment-related (e.g., Turbopack cache issues)
 *
 * The page auto-refreshes once after 2 seconds to recover from deployment
 * timing issues, then shows static error UI if that fails.
 *
 * @see https://nextjs.org/docs/pages/building-your-application/routing/custom-error
 */

import Head from "next/head";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export default function Custom500() {
    const [isAutoRefreshing, setIsAutoRefreshing] = useState(false);
    const hasCheckedRef = useRef(false);

    useEffect(() => {
        // Only run once
        if (hasCheckedRef.current) return;
        hasCheckedRef.current = true;

        // Check if we've already tried a refresh
        const lastRefresh = sessionStorage.getItem("carmenta_500_refresh");
        const now = Date.now();

        // If we haven't tried a refresh in the last 30 seconds, try once
        if (!lastRefresh || now - parseInt(lastRefresh) > 30000) {
            sessionStorage.setItem("carmenta_500_refresh", now.toString());

            // Use setTimeout to avoid synchronous setState in effect
            const stateTimer = setTimeout(() => {
                setIsAutoRefreshing(true);
            }, 0);

            // Wait a moment then refresh
            const refreshTimer = setTimeout(() => {
                window.location.reload();
            }, 2000);

            return () => {
                clearTimeout(stateTimer);
                clearTimeout(refreshTimer);
            };
        }
    }, []);

    return (
        <>
            <Head>
                <title>We hit a snag - Carmenta</title>
                <link rel="icon" href="/favicon.ico" />
            </Head>
            <div
                style={{
                    fontFamily:
                        'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
                    minHeight: "100vh",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "1rem",
                    background: "#0a0a0a",
                    color: "#fafafa",
                }}
            >
                <div style={{ maxWidth: "28rem", textAlign: "center" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src="/logos/icon-transparent.png"
                        alt="Carmenta"
                        style={{
                            width: "48px",
                            height: "48px",
                            marginBottom: "1.5rem",
                        }}
                        onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                        }}
                    />

                    {isAutoRefreshing && (
                        <div
                            style={{
                                width: "2rem",
                                height: "2rem",
                                border: "4px solid #7c3aed",
                                borderRightColor: "transparent",
                                borderRadius: "50%",
                                animation: "spin 1s linear infinite",
                                margin: "0 auto 1rem",
                            }}
                        />
                    )}

                    <h1
                        style={{
                            fontSize: "1.5rem",
                            fontWeight: 700,
                            marginBottom: "1rem",
                            color: "#fafafa",
                        }}
                    >
                        {isAutoRefreshing ? "Updating..." : "We hit a snag"}
                    </h1>

                    <p
                        style={{
                            color: "#a1a1aa",
                            marginBottom: "1.5rem",
                            lineHeight: 1.5,
                        }}
                    >
                        {isAutoRefreshing
                            ? "We just deployed a new version. Refreshing to get the latest."
                            : "Something unexpected happened. We've been notified and we're on it."}
                    </p>

                    {!isAutoRefreshing && (
                        <div
                            style={{
                                display: "flex",
                                justifyContent: "center",
                                gap: "1rem",
                                flexWrap: "wrap",
                            }}
                        >
                            <button
                                onClick={() => window.location.reload()}
                                style={{
                                    display: "inline-block",
                                    padding: "0.5rem 1rem",
                                    fontSize: "0.875rem",
                                    fontFamily: "inherit",
                                    borderRadius: "0.375rem",
                                    background: "#7c3aed",
                                    color: "white",
                                    border: "none",
                                    cursor: "pointer",
                                }}
                            >
                                Refresh
                            </button>
                            <Link
                                href="/"
                                style={{
                                    display: "inline-block",
                                    padding: "0.5rem 1rem",
                                    fontSize: "0.875rem",
                                    fontFamily: "inherit",
                                    borderRadius: "0.375rem",
                                    background: "transparent",
                                    color: "#fafafa",
                                    border: "1px solid #27272a",
                                    textDecoration: "none",
                                }}
                            >
                                Go home
                            </Link>
                        </div>
                    )}
                </div>
            </div>

            <style
                dangerouslySetInnerHTML={{
                    __html: `
                        @keyframes spin {
                            to {
                                transform: rotate(360deg);
                            }
                        }
                    `,
                }}
            />
        </>
    );
}
