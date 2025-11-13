// Service Worker Registration for LABAN Offline Support

export const registerServiceWorker = async () => {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('Service Worker registered successfully:', registration);
      
      // Handle updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New content available, show update notification
            console.log('New content available, please refresh');
            window.dispatchEvent(new CustomEvent('sw-update-available'));
          }
        });
      });
      
      return registration;
    } catch (error) {
      console.error('Service Worker registration failed:', error);
      return null;
    }
  } else {
    console.warn('Service Workers not supported');
    return null;
  }
};

// Unregister service worker (for development/debugging)
export const unregisterServiceWorker = async () => {
  if ('serviceWorker' in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        await registration.unregister();
      }
      console.log('Service Workers unregistered');
    } catch (error) {
      console.error('Failed to unregister Service Workers:', error);
    }
  }
};

// Check if service worker is controlling the page
export const isServiceWorkerActive = () => {
  return navigator.serviceWorker && navigator.serviceWorker.controller;
};

// Get service worker registration
export const getServiceWorkerRegistration = async () => {
  if ('serviceWorker' in navigator) {
    try {
      return await navigator.serviceWorker.getRegistration();
    } catch (error) {
      console.error('Failed to get Service Worker registration:', error);
      return null;
    }
  }
  return null;
};

// Send message to service worker
export const sendMessageToSW = (message) => {
  return new Promise((resolve, reject) => {
    if (!navigator.serviceWorker || !navigator.serviceWorker.controller) {
      reject(new Error('No active Service Worker'));
      return;
    }
    
    const messageChannel = new MessageChannel();
    
    messageChannel.port1.onmessage = (event) => {
      if (event.data.error) {
        reject(new Error(event.data.error));
      } else {
        resolve(event.data);
      }
    };
    
    navigator.serviceWorker.controller.postMessage(message, [messageChannel.port2]);
  });
};

// Setup background sync
export const setupBackgroundSync = async () => {
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    try {
      const registration = await navigator.serviceWorker.ready;
      if (registration.sync) {
        await registration.sync.register('sync-help-requests');
        await registration.sync.register('sync-road-reports');
        console.log('Background sync registered');
        return true;
      } else {
        console.warn('Background sync not available in service worker');
        return false;
      }
    } catch (error) {
      console.error('Background sync registration failed:', error);
      return false;
    }
  } else {
    console.warn('Background sync not supported');
    return false;
  }
};

// Check if app is running in standalone mode (PWA)
export const isStandaloneMode = () => {
  return window.matchMedia('(display-mode: standalone)').matches || 
         window.navigator.standalone ||
         document.referrer.includes('android-app://');
};