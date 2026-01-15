"use client";

import * as Sentry from "@sentry/nextjs";
import * as React from "react";
import { logger } from "@/lib/client-logger";

export interface ToolUIErrorBoundaryProps {
    componentName: string;
    children: React.ReactNode;
    fallback?: React.ReactNode;
    onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ToolUIErrorBoundaryState {
    hasError: boolean;
    error?: Error;
}

export class ToolUIErrorBoundary extends React.Component<
    ToolUIErrorBoundaryProps,
    ToolUIErrorBoundaryState
> {
    constructor(props: ToolUIErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: Error): ToolUIErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        logger.error(
            {
                error,
                componentStack: errorInfo.componentStack,
                componentName: this.props.componentName,
            },
            "Tool UI component failed to render"
        );

        Sentry.captureException(error, {
            tags: { component: "ToolUI", name: this.props.componentName },
            extra: { componentStack: errorInfo.componentStack },
        });

        this.props.onError?.(error, errorInfo);
    }

    handleRetry = () => {
        this.setState({ hasError: false, error: undefined });
    };

    render() {
        if (this.state.hasError) {
            return (
                this.props.fallback ?? (
                    <div className="border-destructive text-destructive rounded-lg border p-4">
                        <p className="font-semibold">
                            {this.props.componentName} failed to render
                        </p>
                        <p className="text-sm">{this.state.error?.message}</p>
                        <button
                            onClick={this.handleRetry}
                            className="mt-3 rounded-md bg-red-500/10 px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-500/20 dark:text-red-400"
                        >
                            Try Again
                        </button>
                    </div>
                )
            );
        }
        return this.props.children;
    }
}
