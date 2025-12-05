// Service Worker for Inventory App
// Enables offline functionality

const CACHE_NAME = 'inventory-v1';
const GITHUB_CACHE = 'github-cache-v1';

// Files to cache for offline use
const STATIC_FILES = [
  './',
  './index.html',
  './style.css',
  './github-db.js',
  './app.js',
  './manifest.json'
];

// Install event - cache static files
self.addEventListener('install', event => {
  console.log('🛠️ Service Worker installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('📦 Caching static files');
        return cache.addAll(STATIC_FILES);
      })
      .then(() => {
        console.log('✅ Service Worker installed');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('❌ Cache failed:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('⚡ Service Worker activating...');
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          // Delete old caches
          if (cacheName !== CACHE_NAME && cacheName !== GITHUB_CACHE) {
            console.log(`🗑️ Deleting old cache: ${cacheName}`);
            return caches.delete(cacheName);
          }
        })
      );
    })
    .then(() => {
      console.log('✅ Service Worker activated');
      return self.clients.claim();
    })
  );
});

// Fetch event - handle network requests
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // Handle GitHub API requests (for reading data)
  if (url.hostname === 'api.github.com' && 
      event.request.method === 'GET' &&
      url.pathname.includes('/contents/')) {
    
    event.respondWith(
      handleGitHubRequest(event.request)
    );
    return;
  }
  
  // For all other requests, try cache first
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Return cached response if found
        if (response) {
          return response;
        }
        
        // Otherwise, fetch from network
        return fetch(event.request)
          .then(networkResponse => {
            // Don't cache non-successful responses
            if (!networkResponse || networkResponse.status !== 200) {
              return networkResponse;
            }
            
            // Clone response for caching
            const responseToCache = networkResponse.clone();
            
            // Cache successful responses for static files
            if (event.request.url.startsWith(self.location.origin)) {
              caches.open(CACHE_NAME)
                .then(cache => {
                  cache.put(event.request, responseToCache);
                });
            }
            
            return networkResponse;
          })
          .catch(() => {
            // If fetch fails and we're requesting a page, return offline page
            if (event.request.mode === 'navigate') {
              return caches.match('./index.html');
            }
            
            // For API requests, return appropriate empty response
            if (event.request.url.includes('/api/') || 
                event.request.url.includes('github.com')) {
              return new Response(JSON.stringify([]), {
                headers: { 'Content-Type': 'application/json' }
              });
            }
            
            return new Response('Offline', {
              status: 503,
              statusText: 'Service Unavailable',
              headers: { 'Content-Type': 'text/plain' }
            });
          });
      })
  );
});

// Handle GitHub API requests with caching
async function handleGitHubRequest(request) {
  const cache = await caches.open(GITHUB_CACHE);
  const cachedResponse = await cache.match(request);
  
  // If we have a cached response and we're offline, return it
  if (cachedResponse && !navigator.onLine) {
    console.log('📂 Returning cached GitHub data (offline)');
    return cachedResponse;
  }
  
  try {
    // Try to fetch from network
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Clone and cache the response
      const responseToCache = networkResponse.clone();
      cache.put(request, responseToCache);
      console.log('🌐 Fetched from GitHub and cached');
    }
    
    return networkResponse;
  } catch (error) {
    // Network request failed
    console.log('📴 GitHub fetch failed, trying cache');
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // No cache available, return empty inventory
    console.log('📭 No cache available, returning empty inventory');
    return new Response(JSON.stringify([]), {
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      }
    });
  }
}

// Handle background sync (for when device comes back online)
self.addEventListener('sync', event => {
  if (event.tag === 'sync-inventory') {
    console.log('🔄 Background sync triggered');
    event.waitUntil(syncInventoryData());
  }
});

// Post messages to clients
function sendMessageToClients(message) {
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage(message);
    });
  });
}

// Background sync function
async function syncInventoryData() {
  // This would sync any pending data
  // In a real implementation, you'd use IndexedDB
  console.log('🔄 Syncing inventory data in background');
  
  sendMessageToClients({
    type: 'SYNC_STATUS',
    message: 'Background sync in progress'
  });
  
  // Simulate sync delay
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  sendMessageToClients({
    type: 'SYNC_COMPLETE',
    message: 'Background sync complete'
  });
}

// Handle messages from the app
self.addEventListener('message', event => {
  if (event.data.type === 'CLEAR_CACHE') {
    caches.delete(CACHE_NAME);
    caches.delete(GITHUB_CACHE);
    console.log('🗑️ Cache cleared by app');
  }
  
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
