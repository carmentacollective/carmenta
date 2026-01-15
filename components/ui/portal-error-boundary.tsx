"use client";

/**
 * Portal Error Boundary
 *
 * Error boundary designed for content rendered through Radix portals
 * (Sheet, Dialog, etc.). Portals mount outside the main React tree,
 * so errors in portaled content don't bubble to the app-level error boundary.
 *
 * This component ensures:
 * - Errors are captured and reported to Sentry
 * - A graceful fallback UI is shown
 * - Users can dismiss the error and try again
 */

import * as Sentry from "@sentry/nextjs";
import * as React from "react";
import { XIcon, ArrowCounterClockwiseIcon, HouseIcon } from "@phosphor-icons/react";
import Link from "next/link";
import { logger } from "@/lib/client-logger";

export interface PortalErrorBoundaryProps {
    /** Name of the portal for error context */
    portalName: string;
    children: React.ReactNode;
    /** Optional callback when error occurs */
    onError?: (error: Error) => void;
    /** Optional callback to close/dismiss the portal */
    onDismiss?: () => void;
}

interface PortalErrorBoundaryState {
    hasError: boolean;
    error?: Error;
}

export class PortalErrorBoundary extends React.Component<
    PortalErrorBoundaryProps,
    PortalErrorBoundaryState
> {
    constructor(props: PortalErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: Error): PortalErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        logger.error(
            {
                error,
                componentStack: errorInfo.componentStack,
                portalName: this.props.portalName,
            },
            `Portal "${this.props.portalName}" failed to render`
        );

        // Breadcrumb for richer Sentry context
        Sentry.addBreadcrumb({
            category: "ui.error-boundary",
            message: `Portal "${this.props.portalName}" caught error`,
            level: "error",
            data: { portalName: this.props.portalName },
        });

        Sentry.captureException(error, {
            tags: {
                component: "Portal",
                portalName: this.props.portalName,
            },
            extra: {
                componentStack: errorInfo.componentStack,
            },
        });

        this.props.onError?.(error);
    }

    handleRetry = () => {
        Sentry.addBreadcrumb({
            category: "ui.action",
            message: `User retried "${this.props.portalName}" after error`,
            level: "info",
            data: {
                portalName: this.props.portalName,
                errorMessage: this.state.error?.message,
            },
        });
        this.setState({ hasError: false, error: undefined });
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex h-full flex-col items-center justify-center p-6 text-center">
                    <div className="max-w-xs space-y-4">
                        <div className="text-foreground/60 mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
                            <XIcon className="h-6 w-6 text-red-500" weight="bold" />
                        </div>
                        <div>
                            <h3 className="text-foreground font-medium">
                                Something went wrong
                            </h3>
                            <p className="text-muted-foreground mt-1 text-sm">
                                We hit a bump loading this panel. The issue has been
                                reported.
                            </p>
                        </div>
                        <div className="flex justify-center gap-2">
                            <button
                                onClick={this.handleRetry}
                                className="hover:bg-foreground/10 inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm transition-colors"
                            >
                                <ArrowCounterClockwiseIcon className="h-4 w-4" />
                                Try again
                            </button>
                            {this.props.onDismiss ? (
                                <button
                                    onClick={this.props.onDismiss}
                                    className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                                >
                                    Close
                                </button>
                            ) : (
                                <Link
                                    href="/"
                                    className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors"
                                >
                                    <HouseIcon className="h-4 w-4" />
                                    Go Home
                                </Link>
                            )}
                        </div>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}
