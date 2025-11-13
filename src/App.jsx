import React, { useState, useEffect, useMemo } from 'react';
import offlineSupabase from './lib/offlineSupabaseClient';
import { registerServiceWorker, setupBackgroundSync } from './lib/serviceWorker';
import localMeshNetwork from './lib/localMeshNetwork';
import OfflineIndicator from './components/OfflineIndicator';
import UserConsent from './components/UserConsent';
import UserInfo from './components/UserInfo';
import RoleSelection from './components/RoleSelection';
import MapComponent from './components/Map';
import HelpRequestsList from './components/HelpRequestsList';
import NeedHelp from './components/NeedHelp';
import WaterLevelWidget from './components/WaterLevelWidget';
import LocalMeshIndicator from './components/LocalMeshIndicator';
import './App.css';

// Helper function to determine region from coordinates
const getRegionFromCoordinates = (latitude) => {
  if (latitude > 12) return 'Luzon';
  if (latitude > 9) return 'Visayas';
  return 'Mindanao';
};

function App() {
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [location, setLocation] = useState(null);
  const [consent, setConsent] = useState(false);
  const [region, setRegion] = useState(null);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [helpRequests, setHelpRequests] = useState([]);
  const [vehicleType, setVehicleType] = useState('car');

  // Memoize region-filtered requests to avoid duplicate filtering
  const regionHelpRequests = useMemo(() => {
    return helpRequests.filter((r) => {
      const requestRegion = r.region || (r.location?.latitude != null ? getRegionFromCoordinates(Number(r.location.latitude)) : null);
      return requestRegion === region;
    });
  }, [helpRequests, region]);

  // When a request is selected, auto-select vehicle type if there is exactly one recommendation
  useEffect(() => {
    if (!selectedRequest) return;
    const recs = Array.isArray(selectedRequest.access_vehicles) ? selectedRequest.access_vehicles : [];
    if (recs.length === 1) {
      setVehicleType(recs[0]);
    }
  }, [selectedRequest]);

  useEffect(() => {
    if (location) {
      const detectedRegion = getRegionFromCoordinates(location.latitude);
      setRegion(detectedRegion);
    }
  }, [location]);

  // Initialize service worker and offline sync
  useEffect(() => {
    registerServiceWorker();
    setupBackgroundSync();
  }, []);

  // Fetch existing requests and subscribe to realtime inserts
  useEffect(() => {
    let subscription = null;
    let interval = null;

    const load = async () => {
      if (!offlineSupabase) {
        console.warn('Supabase client not available - using offline mode');
        return;
      }
      
      const { data, error } = await offlineSupabase
        .select('help_requests', { 
          select: '*',
          order: ['created_at', false] // false for descending
        });
        
      if (!error && data) {
        // Normalize: coerce latitude/longitude (which may be strings) to numbers
        const normalized = data.map((row) => {
          const lat = Number(row.latitude);
          const lon = Number(row.longitude);
          const hasCoords = !Number.isNaN(lat) && !Number.isNaN(lon);
          const rowRegion = row.region || (hasCoords ? getRegionFromCoordinates(lat) : null);
          return {
            ...row,
            location: row.location || (hasCoords ? { latitude: lat, longitude: lon } : null),
            region: rowRegion,
          };
        });
        setHelpRequests(normalized);
      } else if (error) {
        console.error('Failed to fetch help requests:', error);
      }
    };

    const setupRealtimeSubscription = () => {
      if (subscription) {
        offlineSupabase.removeChannel?.(subscription);
        subscription = null;
      }

      if (offlineSupabase?.getConnectionStatus()?.online) {
        subscription = offlineSupabase
          .channel('public:help_requests')
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'help_requests' },
            (payload) => {
              const lat = Number(payload.new.latitude);
              const lon = Number(payload.new.longitude);
              const hasCoords = !Number.isNaN(lat) && !Number.isNaN(lon);
              setHelpRequests((prev) => [
                {
                  ...payload.new,
                  location: payload.new.location || (hasCoords ? { latitude: lat, longitude: lon } : null),
                },
                ...prev,
              ]);
            }
          )
          .subscribe();
        console.log('Real-time subscription established');
      }
    };

    // Handle incoming local mesh requests
    const handleLocalMeshRequest = (localRequests) => {
      console.log(`[App] Received ${localRequests.length} local mesh requests`);
      
      // Filter requests that are nearby and relevant
      const relevantRequests = localRequests.filter(req => {
        if (!req.latitude || !req.longitude || !location) return false;
        
        // Calculate distance (simplified)
        const distance = Math.sqrt(
          Math.pow(req.latitude - location.latitude, 2) + 
          Math.pow(req.longitude - location.longitude, 2)
        ) * 111000; // Convert to meters (approximate)
        
        return distance <= 1000; // Within 1km
      });

      if (relevantRequests.length > 0) {
        setHelpRequests(prev => {
          // Merge with existing requests, avoiding duplicates
          const existingIds = new Set(prev.map(r => r.id));
          const newRequests = relevantRequests.filter(r => !existingIds.has(r.id));
          
          if (newRequests.length > 0) {
            return [...newRequests, ...prev];
          }
          return prev;
        });
      }
    };

    // Initial load and subscription setup
    load();
    setupRealtimeSubscription();

    // Start local mesh network for offline sharing
    if (location && userRole === 'Rescuer') {
      localMeshNetwork.updateLocation(location);
      localMeshNetwork.addListener(handleLocalMeshRequest);
      localMeshNetwork.start(location);
      localMeshNetwork.listenForIncomingData();
    }

    // Handle connection changes
    const handleConnectionRestored = () => {
      console.log('Connection restored - refreshing data and subscriptions');
      load();
      setupRealtimeSubscription();
    };

    const handleConnectionLost = () => {
      console.log('Connection lost - cleaning up subscriptions, switching to local mesh');
      if (subscription) {
        offlineSupabase.removeChannel?.(subscription);
        subscription = null;
      }
    };

    window.addEventListener('connection-restored', handleConnectionRestored);
    window.addEventListener('connection-lost', handleConnectionLost);

    // Fallback: periodic polling when offline
    interval = setInterval(() => {
      if (!offlineSupabase?.getConnectionStatus()?.online) {
        load(); // Refresh from local cache when offline
      }
    }, 30000); // Poll every 30 seconds

    return () => {
      if (subscription) {
        offlineSupabase.removeChannel?.(subscription);
      }
      if (interval) {
        clearInterval(interval);
      }
      localMeshNetwork.removeListener(handleLocalMeshRequest);
      localMeshNetwork.stop();
      window.removeEventListener('connection-restored', handleConnectionRestored);
      window.removeEventListener('connection-lost', handleConnectionLost);
    };
  }, [location, userRole]);

  const handleConsent = (userLocation) => {
    setLocation(userLocation);
    setConsent(true);
  };

  // Start live tracking after consent: updates location continuously
  useEffect(() => {
    if (!consent || !navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setLocation({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
      },
      (err) => {
        console.warn('Geolocation watch error:', err?.message || err);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
    return () => {
      try {
        navigator.geolocation.clearWatch(watchId);
      } catch (error) {
        console.warn('Error clearing geolocation watch:', error);
      }
    };
  }, [consent]);

  const handleNameSubmit = (userData) => {
    setUser(userData);
  };

  const handleSelectRole = (role) => {
    setUserRole(role);
  };

  // Removed auto-open image modal overlay; Map component shows an anchored card instead

  const handleHelpRequest = async (input) => {
    const message = typeof input === 'string' ? input : input?.message;
    const imageUrl = typeof input === 'object' && input ? input.imageUrl || null : null;
    const accessVehicles = typeof input === 'object' && input ? input.accessVehicles || [] : [];
    const fullName = user?.firstName
      ? `${user.firstName} ${user.lastName || ''}`.trim()
      : 'Civilian';
    const payload = {
      user_name: fullName,
      message,
      role: userRole,
      latitude: location?.latitude,
      longitude: location?.longitude,
      region,
      status: 'open',
      image_url: imageUrl,
      access_vehicles: accessVehicles,
    };
    
    if (!offlineSupabase) {
      console.warn('Supabase client not available - storing locally only');
      // Fallback to local state when Supabase isn't configured
      const local = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        ...payload,
        location: { latitude: payload.latitude, longitude: payload.longitude },
      };
      setHelpRequests((prev) => [local, ...prev]);
      
      // Share through local mesh network
      localMeshNetwork.storeLocalRequest(local);
      
      alert('Help request saved locally and shared with nearby devices. (Note: Cloud sync not available)');
      return;
    }
    
    const { data, error } = await offlineSupabase
      .insert('help_requests', [payload]);
      
    if (!error && data) {
      const lat = Number(data.latitude);
      const lon = Number(data.longitude);
      const hasCoords = !Number.isNaN(lat) && !Number.isNaN(lon);
      const normalized = {
        ...data,
        location: data.location || (hasCoords ? { latitude: lat, longitude: lon } : null),
        region: data.region || (hasCoords ? getRegionFromCoordinates(lat) : region),
      };
      setHelpRequests((prev) => [normalized, ...prev]);
      
      // Share through local mesh network
      localMeshNetwork.storeLocalRequest(normalized);
      
      // Show success feedback
      alert('Help request sent successfully! Rescuers in your area have been notified.');
    } else {
      // Handle errors - offlineSupabase will automatically store locally if offline
      console.error('Failed to submit help request:', error);
      
      // Still add to local state for immediate visibility
      const local = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        ...payload,
        location: { latitude: payload.latitude, longitude: payload.longitude },
      };
      setHelpRequests((prev) => [local, ...prev]);
      
      // Share through local mesh network
      localMeshNetwork.storeLocalRequest(local);
      
      alert('Unable to send help request. It has been saved locally and shared with nearby devices. It will sync when connection returns.');
    }
  };

  return (
    <div className="App">
      <LocalMeshIndicator />
      <OfflineIndicator />
      <header className="app-header">
        <h1 className="app-title">🌊 LABAN</h1>
        <p className="app-subtitle">Disaster Response & Rescue Coordination Platform</p>
        <p className="app-description">
          Connecting civilians and rescuers during emergencies for faster, safer disaster response
        </p>
      </header>
      
      {!consent ? (
        <UserConsent onConsent={handleConsent} />
      ) : !user ? (
        <UserInfo onNameSubmit={handleNameSubmit} />
      ) : !userRole ? (
        <RoleSelection onRoleSelect={handleSelectRole} />
      ) : (
        <div className="main-content">
          {userRole === 'Civilian' ? (
            <div style={{ width: '100%' }}>
              <div className="welcome-panel">
                <h2>Welcome, {user.firstName}! 🎉</h2>
                <p>
                  You're now connected to the LABAN network in {region}
                </p>
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <WaterLevelWidget location={location} region={region} />
              </div>
              <NeedHelp onSubmitRequest={handleHelpRequest} />
            </div>
          ) : (
            <>
              <div className="left-panel">
                <div className="welcome-panel">
                  <h2>Welcome, {user.firstName}! 🎉</h2>
                  <p>
                    You're now connected to the LABAN network in {region}
                  </p>
                </div>
                <WaterLevelWidget location={location} region={region} />
              <HelpRequestsList
                requests={regionHelpRequests}
                rescuerLocation={location}
                onSelect={(req) => setSelectedRequest(req)}
              />
              </div>
              <div className="right-panel">
                <div className="map-container">
                  <MapComponent
                    region={region}
                    helpRequests={regionHelpRequests}
                    rescuerLocation={location}
                    selectedRequest={selectedRequest}
                    vehicleType={vehicleType}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default App;