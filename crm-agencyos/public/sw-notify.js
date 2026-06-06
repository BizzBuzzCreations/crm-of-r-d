/* BBC CRM — Notification Service Worker */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const threadId = event.notification.data?.threadId || null;
  const link     = event.notification.data?.link || null;

  // Decide where to navigate:
  // - message notification  → /messages (with threadId)
  // - other notification    → the link path (e.g. /tasks, /meetings)
  // - fallback              → home
  const targetPath = threadId
    ? '/messages'
    : link
      ? link
      : '/';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        for (const client of windowClients) {
          if (client.url.includes(self.location.origin)) {
            client.focus();
            client.postMessage({
              type: 'crm:navigate',
              path: targetPath,
              threadId: threadId || null,
            });
            return;
          }
        }
        return self.clients.openWindow(self.location.origin + targetPath).then((newClient) => {
          if (newClient) {
            setTimeout(() => {
              newClient.postMessage({
                type: 'crm:navigate',
                path: targetPath,
                threadId: threadId || null,
              });
            }, 1500);
          }
        });
      })
  );
});
