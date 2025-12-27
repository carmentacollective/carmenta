/**
 * Carmenta Service Worker
 *
 * Handles offline support, caching, and push notifications for the PWA.
 * Implements network-first strategy for dynamic content, cache-first for static assets.
 *
 * @see knowledge/components/pwa.md for architecture decisions
 */

// Cache versioning: Update BUILD_VERSION when deploying new releases
// This ensures old caches are automatically cleaned up
const BUILD_VERSION = "2025-11-30-001";
const CACHE_NAME = `carmenta-${BUILD_VERSION}`;
const RUNTIME_CACHE = `carmenta-runtime-${BUILD_VERSION}`;

// Assets to cache on install
const PRECACHE_ASSETS = [
    "/",
    "/connection/new",
    "/offline",
    "/logos/icon-transparent-192.png",
    "/logos/icon-transparent-512.png",
];

/**
 * Install event - cache essential assets
 * Runs when service worker is first installed
 */
self.addEventListener("install", (event) => {
    event.waitUntil(
        caches
            .open(CACHE_NAME)
            .then((cache) => cache.addAll(PRECACHE_ASSETS))
            .then(() => self.skipWaiting())
    );
});

/**
 * Activate event - clean up old caches
 * Runs when service worker becomes active
 */
self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches
            .keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        .filter((name) => name !== CACHE_NAME && name !== RUNTIME_CACHE)
                        .map((name) => caches.delete(name))
                );
            })
            .then(() => self.clients.claim())
    );
});

/**
 * Fetch event - network first, fallback to cache
 * Implements network-first strategy for all requests
 */
self.addEventListener("fetch", (event) => {
    // Skip cross-origin requests
    if (!event.request.url.startsWith(self.location.origin)) {
        return;
    }

    // Skip chrome extension requests
    if (event.request.url.startsWith("chrome-extension://")) {
        return;
    }

    // Clone the request before fetching - request bodies can only be consumed once
    // Without this, if network fails, we can't use the original request for cache lookup
    const request = event.request.clone();

    event.respondWith(
        fetch(request)
            .then((response) => {
                // Don't cache non-successful responses or opaque responses
                if (
                    !response ||
                    response.status !== 200 ||
                    response.type === "opaque"
                ) {
                    return response;
                }

                // Clone the response since it can only be consumed once
                const responseToCache = response.clone();

                // Cache the response (non-blocking, errors are silently ignored)
                caches
                    .open(RUNTIME_CACHE)
                    .then((cache) => cache.put(event.request, responseToCache))
                    .catch(() => {
                        // Silently fail - caching is an enhancement, not critical
                        // Errors might occur due to quota exceeded or other storage issues
                    });

                return response;
            })
            .catch(() => {
                // Network failed, try cache
                return caches.match(event.request).then((response) => {
                    if (response) {
                        return response;
                    }

                    // For navigation requests, show offline page
                    if (event.request.mode === "navigate") {
                        return caches.match("/offline");
                    }

                    return new Response("Network error happened", {
                        status: 408,
                        headers: { "Content-Type": "text/plain" },
                    });
                });
            })
    );
});

/**
 * Push notification event
 * Handles incoming push notifications from the server
 *
 * Expected payload format:
 * {
 *   title: "Notification Title",
 *   body: "Notification body text",
 *   icon: "/logos/icon-transparent-192.png",
 *   url: "/connection/new",
 *   actions: [{ action: "view", title: "View" }]
 * }
 */
self.addEventListener("push", (event) => {
    const data = event.data?.json() ?? {};

    const options = {
        body: data.body || "New notification from Carmenta",
        icon: data.icon || "/logos/icon-transparent-192.png",
        badge: "/logos/icon-transparent-192.png",
        vibrate: [200, 100, 200],
        data: {
            url: data.url || "/",
            ...data,
        },
        actions: data.actions || [],
    };

    event.waitUntil(
        self.registration.showNotification(data.title || "Carmenta", options)
    );
});

/**
 * Notification click event
 * Handles user clicking on a notification
 *
 * Behavior:
 * - If Carmenta is already open, focus that window and navigate
 * - If Carmenta is closed, open new window at notification URL
 */
self.addEventListener("notificationclick", (event) => {
    event.notification.close();

    const url = event.notification.data?.url || "/";

    event.waitUntil(
        clients
            .matchAll({ type: "window", includeUncontrolled: true })
            .then((clientList) => {
                // Check if there's already a window open
                for (const client of clientList) {
                    if (
                        client.url.startsWith(self.location.origin) &&
                        "focus" in client
                    ) {
                        return client.focus().then((client) => client.navigate(url));
                    }
                }

                // No matching window, open a new one
                if (clients.openWindow) {
                    return clients.openWindow(url);
                }
            })
    );
});

/**
 * Message event - for communication from the app
 * Handles messages sent from the main application
 */
self.addEventListener("message", (event) => {
    if (event.data && event.data.type === "SKIP_WAITING") {
        self.skipWaiting();
    }
});
