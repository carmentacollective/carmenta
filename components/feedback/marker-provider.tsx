"use client";

/**
 * Marker.io Feedback Widget
 *
 * Visual bug reporting with screenshot capture, console logs, and annotations.
 * Auto-identifies authenticated users so they don't need to enter email.
 *
 * @see https://github.com/marker-io/browser-sdk
 */
import markerSDK from "@marker.io/browser";
import { useEffect, useRef } from "react";

import { useUserContext } from "@/lib/auth/user-context";
import { env } from "@/lib/env";

type MarkerWidget = Awaited<ReturnType<typeof markerSDK.loadWidget>>;

interface MarkerProviderProps {
    children: React.ReactNode;
}

export function MarkerProvider({ children }: MarkerProviderProps) {
    const widgetRef = useRef<MarkerWidget | null>(null);
    const { user, isSignedIn } = useUserContext();

    // Initialize Marker.io widget
    useEffect(() => {
        const projectId = env.NEXT_PUBLIC_MARKER_PROJECT_ID;
        if (!projectId) return;

        let isMounted = true;

        const initMarker = async () => {
            const widget = await markerSDK.loadWidget({
                project: projectId,
            });

            if (!isMounted) {
                widget.unload();
                return;
            }

            widgetRef.current = widget;
        };

        void initMarker();

        return () => {
            isMounted = false;
            widgetRef.current?.unload();
            widgetRef.current = null;
        };
    }, []);

    // Identify reporter when user is signed in
    useEffect(() => {
        const widget = widgetRef.current;
        if (!widget) return;

        if (isSignedIn && user) {
            const email =
                user.primaryEmailAddress?.emailAddress ??
                user.emailAddresses[0]?.emailAddress;
            const fullName = user.fullName ?? user.firstName ?? "Anonymous";

            if (email) {
                widget.setReporter({ email, fullName });
            }
        }
    }, [isSignedIn, user]);

    return <>{children}</>;
}
