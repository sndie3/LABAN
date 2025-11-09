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
      if (!error && data) setHelpRequests(data);
    };
    load();

    const channel = supabase
      .channel('public:help_requests')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'help_requests' },
        (payload) => setHelpRequests((prev) => [payload.new, ...prev])
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
        setHelpRequests((prev) => [data, ...prev]);
      }
    } else {
      // Fallback to local state when Supabase isn’t configured
      const local = { id: Date.now(), timestamp: new Date().toISOString(), ...payload };
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
                requests={helpRequests}
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
                  helpRequests={helpRequests}
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
