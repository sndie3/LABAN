// Service Worker for LABAN Offline Functionality
const CACHE_NAME = 'laban-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/src/main.jsx',
  '/src/App.jsx',
  '/src/App.css',
  '/src/index.css',
  '/assets/logo.png',
  '/assets/react.svg'
];

// Install event - cache resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - serve from cache when offline
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version or fetch from network
        if (response) {
          return response;
        }
        return fetch(event.request);
      }
    )
  );
});

// Handle background sync for offline data
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-help-requests') {
    event.waitUntil(syncHelpRequests());
  } else if (event.tag === 'sync-road-reports') {
    event.waitUntil(syncRoadReports());
  }
});

// Sync offline help requests
async function syncHelpRequests() {
  try {
    const db = await openDB();
    const offlineRequests = await db.getAll('offline-help-requests');
    
    for (const request of offlineRequests) {
      // Try to sync each request
      const response = await fetch('/api/help-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request.data)
      });
      
      if (response.ok) {
        // Remove from offline storage after successful sync
        await db.delete('offline-help-requests', request.id);
      }
    }
  } catch (error) {
    console.error('Failed to sync help requests:', error);
  }
}

// Sync offline road reports
async function syncRoadReports() {
  try {
    const db = await openDB();
    const offlineReports = await db.getAll('offline-road-reports');
    
    for (const report of offlineReports) {
      const response = await fetch('/api/road-reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(report.data)
      });
      
      if (response.ok) {
        await db.delete('offline-road-reports', report.id);
      }
    }
  } catch (error) {
    console.error('Failed to sync road reports:', error);
  }
}

// Open IndexedDB for offline storage
async function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('laban-offline', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Create object stores for offline data
      if (!db.objectStoreNames.contains('offline-help-requests')) {
        db.createObjectStore('offline-help-requests', { keyPath: 'id' });
      }
      
      if (!db.objectStoreNames.contains('offline-road-reports')) {
        db.createObjectStore('offline-road-reports', { keyPath: 'id' });
      }
      
      if (!db.objectStoreNames.contains('cached-reports')) {
        db.createObjectStore('cached-reports', { keyPath: 'id' });
      }
    };
  });
}