// Offline Storage and Sync Utilities for LABAN

// Check if we're online
export const isOnline = () => {
  return navigator.onLine;
};

// Listen for connection changes
export const setupConnectionListener = (callback) => {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
};

// Open IndexedDB for offline storage
export const openOfflineDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('laban-offline', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Create object stores
      if (!db.objectStoreNames.contains('help-requests')) {
        const helpStore = db.createObjectStore('help-requests', { keyPath: 'id', autoIncrement: true });
        helpStore.createIndex('timestamp', 'timestamp');
        helpStore.createIndex('synced', 'synced');
      }
      
      if (!db.objectStoreNames.contains('road-reports')) {
        const reportStore = db.createObjectStore('road-reports', { keyPath: 'id', autoIncrement: true });
        reportStore.createIndex('timestamp', 'timestamp');
        reportStore.createIndex('synced', 'synced');
      }
      
      if (!db.objectStoreNames.contains('cached-data')) {
        const cacheStore = db.createObjectStore('cached-data', { keyPath: 'key' });
        cacheStore.createIndex('timestamp', 'timestamp');
      }
      
      if (!db.objectStoreNames.contains('user-data')) {
        db.createObjectStore('user-data', { keyPath: 'key' });
      }
    };
  });
};

// Store help request offline
export const storeHelpRequestOffline = async (requestData) => {
  try {
    const db = await openOfflineDB();
    const transaction = db.transaction(['help-requests'], 'readwrite');
    const store = transaction.objectStore('help-requests');
    
    const offlineRequest = {
      ...requestData,
      timestamp: new Date().toISOString(),
      synced: false,
      offlineId: `offline-${Date.now()}-${Math.random().toString(36).slice(2)}`
    };
    
    return store.add(offlineRequest);
  } catch (error) {
    console.error('Failed to store help request offline:', error);
    throw error;
  }
};

// Store road report offline
export const storeRoadReportOffline = async (reportData) => {
  try {
    const db = await openOfflineDB();
    const transaction = db.transaction(['road-reports'], 'readwrite');
    const store = transaction.objectStore('road-reports');
    
    const offlineReport = {
      ...reportData,
      timestamp: new Date().toISOString(),
      synced: false,
      offlineId: `offline-${Date.now()}-${Math.random().toString(36).slice(2)}`
    };
    
    return store.add(offlineReport);
  } catch (error) {
    console.error('Failed to store road report offline:', error);
    throw error;
  }
};

// Get unsynced help requests
export const getUnsyncedHelpRequests = async () => {
  try {
    const db = await openOfflineDB();
    const transaction = db.transaction(['help-requests'], 'readonly');
    const store = transaction.objectStore('help-requests');
    const index = store.index('synced');
    
    return index.getAll(false);
  } catch (error) {
    console.error('Failed to get unsynced help requests:', error);
    return [];
  }
};

// Get unsynced road reports
export const getUnsyncedRoadReports = async () => {
  try {
    const db = await openOfflineDB();
    const transaction = db.transaction(['road-reports'], 'readonly');
    const store = transaction.objectStore('road-reports');
    const index = store.index('synced');
    
    return index.getAll(false);
  } catch (error) {
    console.error('Failed to get unsynced road reports:', error);
    return [];
  }
};

// Mark item as synced
export const markAsSynced = async (storeName, offlineId) => {
  try {
    const db = await openOfflineDB();
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    
    const request = store.get(offlineId);
    
    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const item = request.result;
        if (item) {
          item.synced = true;
          const updateRequest = store.put(item);
          updateRequest.onsuccess = () => resolve();
          updateRequest.onerror = () => reject(updateRequest.error);
        } else {
          resolve();
        }
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Failed to mark as synced:', error);
  }
};

// Cache data for offline use
export const cacheData = async (key, data, ttl = 24 * 60 * 60 * 1000) => { // 24 hour default TTL
  try {
    const db = await openOfflineDB();
    const transaction = db.transaction(['cached-data'], 'readwrite');
    const store = transaction.objectStore('cached-data');
    
    const cacheItem = {
      key,
      data,
      timestamp: new Date().toISOString(),
      expires: new Date(Date.now() + ttl).toISOString()
    };
    
    return store.put(cacheItem);
  } catch (error) {
    console.error('Failed to cache data:', error);
  }
};

// Get cached data
export const getCachedData = async (key) => {
  try {
    const db = await openOfflineDB();
    const transaction = db.transaction(['cached-data'], 'readonly');
    const store = transaction.objectStore('cached-data');
    
    return new Promise((resolve, reject) => {
      const request = store.get(key);
      
      request.onsuccess = () => {
        const item = request.result;
        if (item && new Date(item.expires) > new Date()) {
          resolve(item.data);
        } else {
          resolve(null);
        }
      };
      
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Failed to get cached data:', error);
    return null;
  }
};

// Clear old cached data
export const clearExpiredCache = async () => {
  try {
    const db = await openOfflineDB();
    const transaction = db.transaction(['cached-data'], 'readwrite');
    const store = transaction.objectStore('cached-data');
    
    const now = new Date();
    const request = store.getAll();
    
    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const items = request.result;
        const deletePromises = items
          .filter(item => new Date(item.expires) <= now)
          .map(item => store.delete(item.key));
        
        Promise.all(deletePromises).then(() => resolve());
      };
      
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Failed to clear expired cache:', error);
  }
};

// Store user data offline
export const storeUserData = async (key, data) => {
  try {
    const db = await openOfflineDB();
    const transaction = db.transaction(['user-data'], 'readwrite');
    const store = transaction.objectStore('user-data');
    
    const userItem = {
      key,
      data,
      timestamp: new Date().toISOString()
    };
    
    return store.put(userItem);
  } catch (error) {
    console.error('Failed to store user data:', error);
  }
};

// Get user data
export const getUserData = async (key) => {
  try {
    const db = await openOfflineDB();
    const transaction = db.transaction(['user-data'], 'readonly');
    const store = transaction.objectStore('user-data');
    
    return new Promise((resolve, reject) => {
      const request = store.get(key);
      
      request.onsuccess = () => {
        resolve(request.result?.data || null);
      };
      
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Failed to get user data:', error);
    return null;
  }
};

// Sync all offline data
export const syncOfflineData = async () => {
  if (!isOnline()) {
    console.log('Cannot sync: offline');
    return { success: false, reason: 'offline' };
  }
  
  const results = {
    helpRequests: { synced: 0, failed: 0 },
    roadReports: { synced: 0, failed: 0 }
  };
  
  try {
    // Sync help requests
    const unsyncedRequests = await getUnsyncedHelpRequests();
    for (const request of unsyncedRequests) {
      try {
        // This would call your actual API endpoint
        console.log('Syncing help request:', request.offlineId);
        // await syncHelpRequestToServer(request);
        await markAsSynced('help-requests', request.id);
        results.helpRequests.synced++;
      } catch (error) {
        console.error('Failed to sync help request:', request.offlineId, error);
        results.helpRequests.failed++;
      }
    }
    
    // Sync road reports
    const unsyncedReports = await getUnsyncedRoadReports();
    for (const report of unsyncedReports) {
      try {
        console.log('Syncing road report:', report.offlineId);
        // await syncRoadReportToServer(report);
        await markAsSynced('road-reports', report.id);
        results.roadReports.synced++;
      } catch (error) {
        console.error('Failed to sync road report:', report.offlineId, error);
        results.roadReports.failed++;
      }
    }
    
    return { success: true, results };
  } catch (error) {
    console.error('Sync failed:', error);
    return { success: false, error: error.message };
  }
};

// Clear all offline data (for testing/debugging)
export const clearAllOfflineData = async () => {
  try {
    const db = await openOfflineDB();
    const stores = ['help-requests', 'road-reports', 'cached-data', 'user-data'];
    
    for (const storeName of stores) {
      const transaction = db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      store.clear();
    }
    
    console.log('All offline data cleared');
  } catch (error) {
    console.error('Failed to clear offline data:', error);
  }
};