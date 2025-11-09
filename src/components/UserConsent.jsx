import React, { useState, useEffect } from 'react';

const UserConsent = ({ onConsent }) => {
  const [location, setLocation] = useState(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [permissionState, setPermissionState] = useState('');
  const [manualLat, setManualLat] = useState('');
  const [manualLon, setManualLon] = useState('');

  const isManualValid =
    manualLat !== '' && manualLon !== '' &&
    !Number.isNaN(Number(manualLat)) && !Number.isNaN(Number(manualLon));

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by this browser.');
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setError('');
        setIsLoading(false);
      },
      (err) => {
        const msg = err?.message || 'Unable to get your location';
        setError(msg);
        setIsLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  };

  useEffect(() => {
    requestLocation();
  }, []);

  useEffect(() => {
    if (navigator.permissions?.query) {
      navigator.permissions
        .query({ name: 'geolocation' })
        .then((p) => {
          setPermissionState(p.state);
          p.onchange = () => setPermissionState(p.state);
        })
        .catch(() => {});
    }
  }, []);

  const handleConsent = () => {
    if (location) {
      onConsent(location);
    } else if (isManualValid) {
      onConsent({ latitude: Number(manualLat), longitude: Number(manualLon) });
    } else {
      setError('Location not available. Please enable location or enter coordinates.');
    }
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
      
      {permissionState && (
        <p style={{ color: 'var(--text-light)', fontSize: '0.9rem' }}>
          Location permission: {permissionState}. If denied, enable location access in your browser settings and try again.
        </p>
      )}

      {error && <div className="error">{error}</div>}

      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', marginBottom: '1rem' }}>
        <button type="button" onClick={requestLocation} className="proceed-button" style={{ maxWidth: 240 }}>
          🔁 Try Again
        </button>
      </div>

      <div style={{ width: '100%', maxWidth: 480, margin: '0 auto 1rem', textAlign: 'left' }}>
        <p style={{ color: 'var(--text-light)', textAlign: 'center' }}>Or enter your location manually</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <input
            type="text"
            placeholder="Latitude"
            value={manualLat}
            onChange={(e) => setManualLat(e.target.value)}
            style={{ padding: '0.75rem', borderRadius: 8, border: '1px solid var(--border-light)' }}
          />
          <input
            type="text"
            placeholder="Longitude"
            value={manualLon}
            onChange={(e) => setManualLon(e.target.value)}
            style={{ padding: '0.75rem', borderRadius: 8, border: '1px solid var(--border-light)' }}
          />
        </div>
        {isManualValid ? (
          <p style={{ color: 'var(--success-green)', fontSize: '0.85rem', marginTop: '0.5rem', textAlign: 'center' }}>
            Manual coordinates look valid.
          </p>
        ) : (
          <p style={{ color: 'var(--text-light)', fontSize: '0.85rem', marginTop: '0.5rem', textAlign: 'center' }}>
            Format example: Latitude 10.3157, Longitude 123.8854
          </p>
        )}
      </div>
      
      <button
        onClick={handleConsent}
        className="proceed-button"
        disabled={isLoading || (!location && !isManualValid)}
      >
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