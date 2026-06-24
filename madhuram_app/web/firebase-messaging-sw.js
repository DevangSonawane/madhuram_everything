/* eslint-disable no-undef */
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyAlbqmxQURudeUXhOQB0AtB2EWUcFzX_uY',
  authDomain: 'madhuram-1f7aa.firebaseapp.com',
  projectId: 'madhuram-1f7aa',
  storageBucket: 'madhuram-1f7aa.firebasestorage.app',
  messagingSenderId: '611582097916',
  appId: '1:611582097916:web:973c2f41aded2f10a2da79',
  measurementId: 'G-2LKS963MSZ',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const notification = payload.notification || {};
  const title = notification.title || payload.data?.title || 'Madhuram';
  const options = {
    body: notification.body || payload.data?.body || '',
    icon: '/icons/Icon-192.png',
    badge: '/icons/Icon-192.png',
    data: payload.data || {},
  };

  self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow('/'));
});
