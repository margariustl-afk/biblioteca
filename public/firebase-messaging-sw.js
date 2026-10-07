importScripts('https://www.gstatic.com/firebasejs/12.4.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.4.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyC9z31jiX-dW-VPFAYt4Fqjkx2KYmG4kGA',
  authDomain: 'biblioteca-623e5.firebaseapp.com',
  projectId: 'biblioteca-623e5',
  storageBucket: 'biblioteca-623e5.firebasestorage.app',
  messagingSenderId: '361638988',
  appId: '1:361638988:web:99fda33b999670765798e9'
});

const messaging = firebase.messaging();
messaging.onBackgroundMessage(payload => {
  const title = payload.data?.title || 'Biblioteca';
  const body = payload.data?.body || 'Tienes una alerta de la biblioteca.';
  return self.registration.showNotification(title, {
    body, icon: '/icons/icon-192.png', badge: '/icons/icon-192.png',
    tag: payload.data?.tag || 'biblioteca-alerta', data: { url: '/' }
  });
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async clients => {
    const match = clients.find(client => new URL(client.url).origin === self.location.origin);
    if (match) return match.focus();
    return self.clients.openWindow('/');
  }));
});
