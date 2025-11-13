// Offline-aware Supabase wrapper for LABAN
import { createClient } from '@supabase/supabase-js';
import * as offlineStorage from './offlineStorage';

// Read Vite env variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Create client only when envs are present
let supabaseClient = null;
if (supabaseUrl && supabaseAnonKey) {
  supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
}

// Enhanced offline-aware client
class OfflineAwareSupabaseClient {
  constructor(client) {
    this.client = client;
    this.isOnline = navigator.onLine;
    this.setupConnectionListener();
  }

  setupConnectionListener() {
    const updateConnectionStatus = async () => {
      const wasOnline = this.isOnline;
      this.isOnline = navigator.onLine;
      
      if (this.isOnline && !wasOnline) {
        console.log('Connection restored - attempting sync and refreshing subscriptions');
        await this.syncOfflineData();
        // Notify app to refresh subscriptions
        window.dispatchEvent(new CustomEvent('connection-restored'));
      } else if (!this.isOnline && wasOnline) {
        console.log('Connection lost - switching to offline mode');
        // Notify app of connection loss
        window.dispatchEvent(new CustomEvent('connection-lost'));
      }
    };

    window.addEventListener('online', updateConnectionStatus);
    window.addEventListener('offline', updateConnectionStatus);
  }

  async syncOfflineData() {
    try {
      const result = await offlineStorage.syncOfflineData();
      if (result.success && (result.results.helpRequests.synced > 0 || result.results.roadReports.synced > 0)) {
        console.log(`Synced ${result.results.helpRequests.synced} help requests and ${result.results.roadReports.synced} road reports`);
        
        // Trigger UI update
        window.dispatchEvent(new CustomEvent('offline-sync-complete', { detail: result }));
      }
    } catch (error) {
      console.error('Failed to sync offline data:', error);
    }
  }

  // Enhanced insert method with offline fallback
  async insert(table, data) {
    if (this.isOnline && this.client) {
      try {
        const result = await this.client.from(table).insert(data).select('*').single();
        
        // Cache successful results for offline access
        if (!result.error) {
          await this.cacheTableData(table, result.data);
        }
        
        return result;
      } catch (error) {
        console.error(`Failed to insert into ${table}:`, error);
        
        // Fallback to offline storage
        if (table === 'help_requests') {
          await offlineStorage.storeHelpRequestOffline(data);
          return {
            data: { ...data, id: `offline-${Date.now()}`, offline: true },
            error: null
          };
        }
        
        return { data: null, error };
      }
    } else {
      // Offline mode - store locally
      if (table === 'help_requests') {
        await offlineStorage.storeHelpRequestOffline(data);
        return {
          data: { ...data, id: `offline-${Date.now()}`, offline: true },
          error: null
        };
      } else if (table === 'road_reports') {
        await offlineStorage.storeRoadReportOffline(data);
        return {
          data: { ...data, id: `offline-${Date.now()}`, offline: true },
          error: null
        };
      }
      
      return {
        data: null,
        error: { message: 'Offline mode - data stored locally' }
      };
    }
  }

  // Enhanced select method with offline caching
  async select(table, options = {}) {
    const cacheKey = `${table}-${JSON.stringify(options)}`;
    
    if (this.isOnline && this.client) {
      try {
        let query = this.client.from(table).select(options.select || '*');
        
        if (options.eq) {
          Object.entries(options.eq).forEach(([key, value]) => {
            query = query.eq(key, value);
          });
        }
        
        if (options.order) {
          const [column, ascending = true] = options.order;
          query = query.order(column, { ascending });
        }
        
        if (options.limit) {
          query = query.limit(options.limit);
        }
        
        const result = await query;
        
        // Cache successful results
        if (!result.error && result.data) {
          await offlineStorage.cacheData(cacheKey, result.data, options.ttl || 24 * 60 * 60 * 1000);
        }
        
        return result;
      } catch (error) {
        console.error(`Failed to select from ${table}:`, error);
        
        // Try to return cached data
        const cachedData = await offlineStorage.getCachedData(cacheKey);
        if (cachedData) {
          console.log(`Returning cached data for ${table}`);
          return { data: cachedData, error: null };
        }
        
        return { data: [], error };
      }
    } else {
      // Offline mode - try to return cached data
      const cachedData = await offlineStorage.getCachedData(cacheKey);
      if (cachedData) {
        console.log(`Returning cached data for ${table} (offline mode)`);
        return { data: cachedData, error: null };
      }
      
      // Return empty data with offline message
      return {
        data: [],
        error: { message: 'Offline mode - no cached data available' }
      };
    }
  }

  // Cache table data for offline access
  async cacheTableData(table, data) {
    const cacheKey = `${table}-all`;
    await offlineStorage.cacheData(cacheKey, data, 24 * 60 * 60 * 1000); // 24 hour TTL
  }

  // Get cached table data
  async getCachedTableData(table) {
    const cacheKey = `${table}-all`;
    return await offlineStorage.getCachedData(cacheKey);
  }

  // Enhanced channel subscription with offline handling
  channel(name) {
    if (this.client && this.isOnline) {
      return this.client.channel(name);
    } else {
      // Return a mock channel for offline mode
      return {
        on: (event) => {
          console.log(`Offline mode - skipping subscription for ${event}`);
          return {
            subscribe: () => ({ unsubscribe: () => {} })
          };
        },
        subscribe: () => ({ unsubscribe: () => {} })
      };
    }
  }

  // Remove channel subscription
  removeChannel(subscription) {
    if (subscription && typeof subscription.unsubscribe === 'function') {
      subscription.unsubscribe();
    }
  }

  // Get current connection status
  getConnectionStatus() {
    return {
      online: this.isOnline,
      clientAvailable: !!this.client
    };
  }

  // Force sync offline data
  async forceSync() {
    if (this.isOnline) {
      return await this.syncOfflineData();
    } else {
      return { success: false, reason: 'offline' };
    }
  }
}

// Create enhanced client
const enhancedClient = supabaseClient ? new OfflineAwareSupabaseClient(supabaseClient) : null;

export default enhancedClient;