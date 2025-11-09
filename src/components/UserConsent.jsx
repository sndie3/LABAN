import React, { useState, useEffect } from 'react';

const UserConsent = ({ onConsent }) => {
  const [location, setLocation] = useState(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
          setIsLoading(false);
        },
        () => {
          setError('Unable to get your location');
          setIsLoading(false);
        }
      );
    } else {
      setError('Geolocation is not supported by this browser.');
      setIsLoading(false);
    }
  }, []);

  const handleConsent = () => {
    onConsent(location);
  };

  return (
    <div className="user-consent-container">
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <div style={{ 
          fontSize: '3rem', 
          marginBottom: '1rem',
          animation: 'pulse 2s infinite'
        }}>
          📍
        </div>
        <h2>Location Access Required</h2>
        <p>LABAN needs your location to provide emergency services and connect you with rescuers during disasters.</p>
      </div>
      
      {isLoading && (
        <div style={{ textAlign: 'center', margin: '2rem 0' }}>
          <div className="loading"></div>
          <p style={{ marginTop: '1rem', color: 'var(--text-light)' }}>
            Getting your location...
          </p>
        </div>
      )}
      
      {location && (
        <div className="location-info">
          <h3>📍 Location Detected</h3>
          <p><strong>Latitude:</strong> {location.latitude.toFixed(6)}</p>
          <p><strong>Longitude:</strong> {location.longitude.toFixed(6)}</p>
          <p style={{ fontSize: '0.8rem', marginTop: '0.5rem', opacity: 0.8 }}>
            Your location will help rescuers find you faster
          </p>
        </div>
      )}
      
      {error && <div className="error">{error}</div>}
      
      <button onClick={handleConsent} className="proceed-button" disabled={isLoading}>
        {isLoading ? 'Getting Location...' : '✅ Continue to Safety'}
      </button>
      
      <div style={{ 
        textAlign: 'center', 
        marginTop: '1rem', 
        fontSize: '0.8rem', 
        color: 'var(--text-light)',
        opacity: 0.8
      }}>
        <p>🔒 Your location data is encrypted and only shared during emergencies</p>
      </div>
    </div>
  );
};

export default UserConsent;