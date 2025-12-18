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
import { useEffect, useState } from "react";

import { useUserContext } from "@/lib/auth/user-context";
import { env } from "@/lib/env";

type MarkerWidget = Awaited<ReturnType<typeof markerSDK.loadWidget>>;

interface MarkerProviderProps {
    children: React.ReactNode;
}

export function MarkerProvider({ children }: MarkerProviderProps) {
    const [widget, setWidget] = useState<MarkerWidget | null>(null);
    const { user, isSignedIn } = useUserContext();

    // Initialize Marker.io widget
    useEffect(() => {
        const projectId = env.NEXT_PUBLIC_MARKER_PROJECT_ID;
        if (!projectId) return;

        let isMounted = true;

        const initMarker = async () => {
            const loadedWidget = await markerSDK.loadWidget({
                project: projectId,
            });

            if (!isMounted) {
                loadedWidget.unload();
                return;
            }

            setWidget(loadedWidget);
        };

        void initMarker();

        return () => {
            isMounted = false;
            widget?.unload();
            setWidget(null);
        };
    }, []);

    // Identify reporter when user is signed in
    useEffect(() => {
        if (!widget) return;

        if (isSignedIn && user) {
            const email =
                user.primaryEmailAddress?.emailAddress ??
                user.emailAddresses[0]?.emailAddress;
            const fullName = user.fullName ?? user.firstName ?? "Anonymous";

            if (email) {
                widget.setReporter({ email, fullName });
            } else {
                // User has no email - clear any previous reporter
                widget.clearReporter();
            }
        } else {
            // Not signed in - clear reporter
            widget.clearReporter();
        }
    }, [widget, isSignedIn, user]);

    return <>{children}</>;
}
