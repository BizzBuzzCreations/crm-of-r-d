/* BBC CRM — Notification Service Worker
   Handles click-to-navigate when the OS notification is clicked.
   Notifications are created via new Notification() from the page,
   so no show-notification postMessage handling is needed here.
*/

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

// When user clicks the OS notification (handles closed-tab case)
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
            if (threadId) {
              client.postMessage({ type: 'crm:navigate-thread', threadId });
            }
            return;
          }
        }
        // No CRM tab open — open a new one at /messages
        const urlToOpen = self.location.origin + (threadId ? '/messages' : '/');
        return self.clients.openWindow(urlToOpen).then((newClient) => {
          if (newClient && threadId) {
            setTimeout(() => {
              newClient.postMessage({ type: 'crm:navigate-thread', threadId });
            }, 1500);
          }
        });
      })
  );
});
