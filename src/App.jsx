import React, { useState, useEffect } from 'react';
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
  const [helpRequests, setHelpRequests] = useState(() => {
    const savedRequests = localStorage.getItem('helpRequests');
    return savedRequests ? JSON.parse(savedRequests) : [];
  });

  useEffect(() => {
    localStorage.setItem('helpRequests', JSON.stringify(helpRequests));
  }, [helpRequests]);

  useEffect(() => {
    if (location) {
      const detectedRegion = getRegionFromCoordinates(location.latitude);
      setRegion(detectedRegion);
    }
  }, [location]);

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

  const handleHelpRequest = (message) => {
    const newRequest = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      user,
      location,
      message,
      userRole,
    };
    setHelpRequests([...helpRequests, newRequest]);
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
