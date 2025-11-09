import React, { useState, useEffect } from 'react';
import supabase from './lib/supabaseClient';
import UserConsent from './components/UserConsent';
import UserInfo from './components/UserInfo';
import RoleSelection from './components/RoleSelection';
import MapComponent from './components/Map';
import HelpRequestsList from './components/HelpRequestsList';
import NeedHelp from './components/NeedHelp';
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

  useEffect(() => {
    if (location) {
      const detectedRegion = getRegionFromCoordinates(location.latitude);
      setRegion(detectedRegion);
    }
  }, [location]);

  // Fetch existing requests and subscribe to realtime inserts
  useEffect(() => {
    if (!supabase) return;
    const load = async () => {
      const { data, error } = await supabase
        .from('help_requests')
        .select('*')
        .order('created_at', { ascending: false });
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
      }
    };
    load();

    const channel = supabase
      .channel('public:help_requests')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'help_requests' },
        (payload) =>
          setHelpRequests((prev) => {
            const lat = Number(payload.new.latitude);
            const lon = Number(payload.new.longitude);
            const hasCoords = !Number.isNaN(lat) && !Number.isNaN(lon);
            return [
              {
                ...payload.new,
                location: payload.new.location || (hasCoords ? { latitude: lat, longitude: lon } : null),
              },
              ...prev,
            ];
          })
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

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
      } catch {}
    };
  }, [consent]);

  const handleNameSubmit = (userData) => {
    setUser(userData);
  };

  const handleSelectRole = (role) => {
    setUserRole(role);
  };

  const handleHelpRequest = async (message) => {
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
    };
    if (supabase) {
      const { data, error } = await supabase
        .from('help_requests')
        .insert([payload])
        .select('*')
        .single();
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
      }
    } else {
      // Fallback to local state when Supabase isn’t configured
      const local = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        ...payload,
        location: { latitude: payload.latitude, longitude: payload.longitude },
      };
      setHelpRequests((prev) => [local, ...prev]);
    }
  };

  return (
    <div className="App">
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
          <div className="left-panel">
            <div className="welcome-panel">
              <h2>Welcome, {user.firstName}! 🎉</h2>
              <p>
                You're now connected to the LABAN network in {region}
              </p>
            </div>
            
            {userRole === 'Civilian' && (
              <NeedHelp onSubmitRequest={handleHelpRequest} />
            )}
            {userRole === 'Rescuer' && (
              <HelpRequestsList
                requests={helpRequests.filter((r) => (r.region || (r.location?.latitude != null ? getRegionFromCoordinates(Number(r.location.latitude)) : null)) === region)}
                rescuerLocation={location}
                onSelect={(req) => setSelectedRequest(req)}
              />
            )}
          </div>
          
          {userRole === 'Rescuer' && (
            <div className="right-panel">
              <div className="map-container">
                <MapComponent
                  region={region}
                  helpRequests={helpRequests.filter((r) => (r.region || (r.location?.latitude != null ? getRegionFromCoordinates(Number(r.location.latitude)) : null)) === region)}
                  rescuerLocation={location}
                  selectedRequest={selectedRequest}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
