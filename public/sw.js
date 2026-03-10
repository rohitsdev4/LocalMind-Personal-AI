// ============================================================
// LocalMind — Manual Service Worker
// Handles caching for offline support and model weight caching
// ============================================================

const CACHE_NAME = "localmind-v1";
const MODEL_CACHE = "webllm-model-cache";

// App shell files to cache
const APP_SHELL = [
    "/",
    "/manifest.json",
    "/icons/icon-192.png",
    "/icons/icon-512.png",
];

// Install: cache the app shell
self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(APP_SHELL);
        })
    );
    self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys
                    .filter((key) => key !== CACHE_NAME && key !== MODEL_CACHE)
                    .map((key) => caches.delete(key))
            );
        })
    );
    self.clients.claim();
});

// Fetch: network-first for app, cache-first for models
self.addEventListener("fetch", (event) => {
    const url = new URL(event.request.url);

    // Cache-first for HuggingFace model weights (large, rarely change)
    if (
        url.hostname.includes("huggingface.co") ||
        url.hostname.includes("cdn-lfs") ||
        url.pathname.endsWith(".wasm") ||
        url.pathname.endsWith(".bin")
    ) {
        event.respondWith(
            caches.open(MODEL_CACHE).then((cache) => {
                return cache.match(event.request).then((cached) => {
                    if (cached) return cached;
                    return fetch(event.request).then((response) => {
                        if (response.ok) {
                            cache.put(event.request, response.clone());
                        }
                        return response;
                    });
                });
            })
        );
        return;
    }

    // Network-first for app shell (get latest, fallback to cache)
    if (url.origin === self.location.origin) {
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    // Cache successful responses
                    if (response.ok) {
                        const responseClone = response.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(event.request, responseClone);
                        });
                    }
                    return response;
                })
                .catch(() => {
                    // Fallback to cache if offline
                    return caches.match(event.request).then((cached) => {
                        return cached || caches.match("/");
                    });
                })
        );
        return;
    }
});

// Handle notification actions (e.g. Snooze, Dismiss)
self.addEventListener('notificationclick', function(event) {
    const notification = event.notification;
    const action = event.action;
    const data = notification.data || {};

    // Close the notification
    notification.close();

    // Send message to open clients
    event.waitUntil(
        clients.matchAll({ type: 'window' }).then(windowClients => {
            for (let i = 0; i < windowClients.length; i++) {
                const client = windowClients[i];
                client.postMessage({
                    type: 'NOTIFICATION_CLICK',
                    action: action,
                    reminderId: data.reminderId
                });
            }

            // If the user clicked the notification itself (not an action button)
            // and there's a window client, focus it.
            if (!action && windowClients.length > 0) {
                windowClients[0].focus();
            } else if (!action) {
                // If there's no open client, open a new one
                clients.openWindow('/');
            }
        })
    );
});
