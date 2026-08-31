/* public/firebase-messaging-sw.js
 *
 * Service worker for Chrome / Edge / Firefox push notifications.
 *
 * MUST live at the site root (/firebase-messaging-sw.js) — the browser only
 * looks there. It runs outside the app bundle, so it can't read process.env;
 * the config below is public Firebase web config (safe to expose) and is
 * overwritten at registration time via the ?config= query string, so you only
 * have to set it in .env.
 */
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

// The app passes its config when registering the worker, so this file never
// needs editing per-environment.
const params = new URLSearchParams(self.location.search);
const config = {
  apiKey: params.get('apiKey'),
  authDomain: params.get('authDomain'),
  projectId: params.get('projectId'),
  storageBucket: params.get('storageBucket'),
  messagingSenderId: params.get('messagingSenderId'),
  appId: params.get('appId'),
};

if (config.projectId) {
  firebase.initializeApp(config);
  const messaging = firebase.messaging();

  // Fires when a push arrives and the tab is closed or in the background.
  messaging.onBackgroundMessage((payload) => {
    const n = payload.notification || {};
    const d = payload.data || {};
    self.registration.showNotification(n.title || 'Hover CRM', {
      body: n.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-72.png',
      tag: d.type || 'general',
      data: { link: d.link || '/dashboard' },
    });
  });
}

// Clicking the notification focuses an existing tab if one is open, otherwise
// opens a new one — instead of piling up duplicate windows.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = (event.notification.data && event.notification.data.link) || '/dashboard';
  const url = new URL(link, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
