importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

const params = new URLSearchParams(self.location.search);
const config = params.get('config');

if (!config) {
  console.error('[FCM] firebaseConfig ausente. Abortando inicialização do service worker');
} else {
  const firebaseConfig = JSON.parse(atob(config));

  if (!firebaseConfig || Object.keys(firebaseConfig).length === 0) {
    console.error('[FCM] firebaseConfig vazio. Abortando inicialização do service worker');
  } else {
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }

    const messaging = firebase.messaging();

    messaging.onBackgroundMessage(async payload => {
      if (!payload?.notification) return;

      const { title, body } = payload.notification;
      const tag = payload.messageId || `${title}-${body}`;
      const data = payload.data || {};

      const existing = await self.registration.getNotifications({ tag });
      if (existing.length === 0) {
        self.registration.showNotification(title, {
          body,
          icon: '/icon-192.png',
          tag,
          data,
        });
      }
    });
  }
}

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data && event.notification.data.url;
  if (!url) return;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientsArr => {
      for (const client of clientsArr) {
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    })
  );
});
