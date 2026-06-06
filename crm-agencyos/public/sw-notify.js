/* BBC CRM — Notification Service Worker
   Scope: /
   Handles OS-level notification display and click-to-navigate.
*/

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

// Show notification (called via postMessage from the app)
self.addEventListener('message', (event) => {
  if (event.data?.type === 'show-notification') {
    const { title, body, icon, threadId, tag } = event.data;
    event.waitUntil(
      self.registration.showNotification(title, {
        body,
        icon: icon || '/favicon.ico',
        badge: '/favicon.ico',
        tag: tag || threadId,
        data: { threadId },
        renotify: true,
        requireInteraction: false,
      })
    );
  }
});

// When user clicks the OS notification
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const threadId = event.notification.data?.threadId;

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // Find an existing CRM tab and focus it
        for (const client of windowClients) {
          if (client.url.includes(self.location.origin)) {
            client.focus();
            client.postMessage({ type: 'crm:navigate-thread', threadId });
            return;
          }
        }
        // No tab open — open a new one
        const urlToOpen = threadId ? (self.location.origin + '/messages') : self.location.origin;
        return self.clients
          .openWindow(urlToOpen)
          .then((newClient) => {
            if (newClient && threadId) {
              // small delay so the page has time to mount
              setTimeout(() => {
                newClient.postMessage({ type: 'crm:navigate-thread', threadId });
              }, 1500);
            }
          });
      })
  );
});
