"use client";

import { useState, useCallback, useRef, useEffect } from "react";

import { logger } from "@/lib/client-logger";

/**
 * File info returned when user selects a file from Google Picker
 */
export interface GooglePickerFile {
    id: string;
    name: string;
    mimeType: string;
    url: string;
}

/**
 * Options for opening the picker
 */
export interface GooglePickerOptions {
    /** OAuth access token for the user's Google account */
    accessToken: string;
    /** MIME types to filter by */
    mimeTypes?: string[];
    /** Whether to allow multiple file selection */
    multiSelect?: boolean;
    /** Title for the picker dialog */
    title?: string;
}

/**
 * Return type for the useGooglePicker hook
 */
export interface UseGooglePickerReturn {
    /** Whether the Google Picker API is loaded and ready */
    isReady: boolean;
    /** Whether the picker is currently loading */
    isLoading: boolean;
    /** Open the picker with the given options */
    openPicker: (options: GooglePickerOptions) => Promise<GooglePickerFile[] | null>;
    /** Any error that occurred */
    error: string | null;
}

// Script loading state - shared across all hook instances
let scriptLoadPromise: Promise<void> | null = null;
let pickerApiLoaded = false;

/**
 * Load the Google API script and Picker API
 */
function loadGooglePickerApi(): Promise<void> {
    // Return existing promise if already loading/loaded
    if (scriptLoadPromise) {
        return scriptLoadPromise;
    }

    scriptLoadPromise = new Promise((resolve, reject) => {
        // Check if already loaded
        if (typeof gapi !== "undefined" && pickerApiLoaded) {
            resolve();
            return;
        }

        // Check if script is already in DOM
        const existingScript = document.querySelector(
            'script[src="https://apis.google.com/js/api.js"]'
        );

        if (existingScript) {
            // Script exists, wait for gapi to be available (max 5 seconds)
            let attempts = 0;
            const maxAttempts = 50;
            const checkGapi = () => {
                if (typeof gapi !== "undefined") {
                    gapi.load("picker", {
                        callback: () => {
                            pickerApiLoaded = true;
                            resolve();
                        },
                        onerror: () => {
                            scriptLoadPromise = null;
                            reject(new Error("Failed to load Google Picker module"));
                        },
                    });
                } else if (attempts++ < maxAttempts) {
                    setTimeout(checkGapi, 100);
                } else {
                    scriptLoadPromise = null;
                    reject(new Error("Timeout waiting for Google API"));
                }
            };
            checkGapi();
            return;
        }

        // Create and load script
        const script = document.createElement("script");
        script.src = "https://apis.google.com/js/api.js";
        script.async = true;
        script.defer = true;

        script.onload = () => {
            gapi.load("picker", {
                callback: () => {
                    pickerApiLoaded = true;
                    resolve();
                },
                onerror: () => {
                    scriptLoadPromise = null;
                    reject(new Error("Failed to load Google Picker module"));
                },
            });
        };

        script.onerror = () => {
            scriptLoadPromise = null;
            reject(new Error("Failed to load Google API script"));
        };

        document.head.appendChild(script);
    });

    return scriptLoadPromise;
}

/**
 * Hook to manage Google Picker functionality
 *
 * Handles loading the Google Picker API and providing a function to open the picker.
 *
 * @example
 * ```tsx
 * const { isReady, openPicker, error } = useGooglePicker();
 *
 * const handleOpenPicker = async () => {
 *   const files = await openPicker({
 *     accessToken: userAccessToken,
 *     mimeTypes: ['application/vnd.google-apps.spreadsheet'],
 *   });
 *   if (files) {
 *     console.log('Selected:', files);
 *   }
 * };
 * ```
 */
export function useGooglePicker(): UseGooglePickerReturn {
    const [isReady, setIsReady] = useState(pickerApiLoaded);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Track current picker instance for cleanup
    const pickerRef = useRef<google.picker.Picker | null>(null);
    // Track pending promise resolve function for cleanup
    const resolveRef = useRef<((files: GooglePickerFile[] | null) => void) | null>(
        null
    );

    // Load the API on mount (only if not already loaded)
    useEffect(() => {
        // Already loaded - state is initialized correctly via useState(pickerApiLoaded)
        if (pickerApiLoaded) {
            return;
        }

        // Load asynchronously
        let cancelled = false;
        loadGooglePickerApi()
            .then(() => {
                if (!cancelled) {
                    setIsReady(true);
                }
            })
            .catch((err) => {
                if (!cancelled) {
                    logger.error({ error: err }, "Failed to load Google Picker API");
                    setError("Failed to load Google Picker API");
                }
            });

        return () => {
            cancelled = true;
        };
    }, []);

    // Cleanup picker on unmount
    useEffect(() => {
        return () => {
            // Resolve any pending promise to prevent memory leak
            if (resolveRef.current) {
                resolveRef.current(null);
                resolveRef.current = null;
            }
            // Dispose picker
            if (pickerRef.current) {
                pickerRef.current.dispose();
                pickerRef.current = null;
            }
        };
    }, []);

    const openPicker = useCallback(
        (options: GooglePickerOptions): Promise<GooglePickerFile[] | null> => {
            return new Promise((resolve) => {
                // Store resolve function for cleanup
                resolveRef.current = resolve;

                if (!isReady) {
                    setError("Google Picker API not loaded");
                    resolveRef.current = null;
                    resolve(null);
                    return;
                }

                const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
                if (!apiKey) {
                    setError("Google API key not configured");
                    logger.error({}, "NEXT_PUBLIC_GOOGLE_API_KEY is not set");
                    resolveRef.current = null;
                    resolve(null);
                    return;
                }

                setIsLoading(true);
                setError(null);

                // Clean up any existing picker
                if (pickerRef.current) {
                    pickerRef.current.dispose();
                    pickerRef.current = null;
                }

                try {
                    // Default MIME types for Google Workspace files
                    const mimeTypes = options.mimeTypes || [
                        "application/vnd.google-apps.spreadsheet",
                        "application/vnd.google-apps.document",
                        "application/vnd.google-apps.presentation",
                    ];

                    // Build the docs view
                    const docsView = new google.picker.DocsView()
                        .setIncludeFolders(true)
                        .setMimeTypes(mimeTypes.join(","));

                    // Build the picker
                    const builder = new google.picker.PickerBuilder()
                        .setOAuthToken(options.accessToken)
                        .setDeveloperKey(apiKey)
                        .addView(docsView)
                        .setCallback((data: google.picker.ResponseObject) => {
                            // Only handle terminal actions (PICKED, CANCEL)
                            // Ignore non-terminal actions like LOADED
                            if (data.action === google.picker.Action.PICKED) {
                                setIsLoading(false);
                                const files: GooglePickerFile[] = data.docs.map(
                                    (doc) => ({
                                        id: doc.id,
                                        name: doc.name,
                                        mimeType: doc.mimeType,
                                        url: doc.url,
                                    })
                                );
                                logger.info(
                                    { fileCount: files.length },
                                    "Google Picker files selected"
                                );
                                // Clean up picker
                                if (pickerRef.current) {
                                    pickerRef.current.dispose();
                                    pickerRef.current = null;
                                }
                                resolveRef.current = null;
                                resolve(files);
                            } else if (data.action === google.picker.Action.CANCEL) {
                                setIsLoading(false);
                                logger.info({}, "Google Picker cancelled");
                                // Clean up picker
                                if (pickerRef.current) {
                                    pickerRef.current.dispose();
                                    pickerRef.current = null;
                                }
                                resolveRef.current = null;
                                resolve(null);
                            }
                            // Non-terminal actions (LOADED, etc.) are ignored
                        });

                    // Set title if provided
                    if (options.title) {
                        builder.setTitle(options.title);
                    }

                    // Enable multi-select if requested
                    if (options.multiSelect) {
                        builder.enableFeature(
                            google.picker.Feature.MULTISELECT_ENABLED
                        );
                    }

                    // Build and show the picker
                    const picker = builder.build();
                    pickerRef.current = picker;
                    picker.setVisible(true);
                } catch (err) {
                    setIsLoading(false);
                    const message =
                        err instanceof Error
                            ? err.message
                            : "Failed to open Google Picker";
                    setError(message);
                    logger.error({ error: err }, "Failed to open Google Picker");
                    resolveRef.current = null;
                    resolve(null);
                }
            });
        },
        [isReady]
    );

    return {
        isReady,
        isLoading,
        openPicker,
        error,
    };
}
