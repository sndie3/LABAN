import React, { useState, useEffect, useRef } from 'react';
import 'ol/ol.css';
import { Map as OLMap, View } from 'ol';
import TileLayer from 'ol/layer/Tile';
import { OSM } from 'ol/source';
import { toLonLat, fromLonLat } from 'ol/proj';

const UserConsent = ({ onConsent }) => {
  const [location, setLocation] = useState(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [permissionState, setPermissionState] = useState('');
  const [manualLat, setManualLat] = useState('');
  const [manualLon, setManualLon] = useState('');
  const pickMapRef = useRef(null);
  const pickMap = useRef(null);

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

  const requestIPLocation = async () => {
    try {
      setIsLoading(true);
      setError('');

      const fetchWithTimeout = (url, ms = 5000) => {
        const ctrl = new AbortController();
        const id = setTimeout(() => ctrl.abort(), ms);
        return fetch(url, { signal: ctrl.signal, mode: 'cors' })
          .finally(() => clearTimeout(id));
      };

      const tryIpinfo = async () => {
        const res = await fetchWithTimeout('https://ipinfo.io/json');
        if (!res.ok) throw new Error('ipinfo failed');
        const data = await res.json();
        if (data && data.loc) {
          const [latStr, lonStr] = String(data.loc).split(',');
          const lat = Number(latStr);
          const lon = Number(lonStr);
          if (!Number.isNaN(lat) && !Number.isNaN(lon)) return { lat, lon };
        }
        throw new Error('ipinfo no coords');
      };

      const tryIpwho = async () => {
        const res = await fetchWithTimeout('https://ipwho.is/');
        if (!res.ok) throw new Error('ipwho.is failed');
        const data = await res.json();
        if (data && data.success && typeof data.latitude === 'number' && typeof data.longitude === 'number') {
          return { lat: data.latitude, lon: data.longitude };
        }
        throw new Error('ipwho.is no coords');
      };

      const tryIpapi = async () => {
        const res = await fetchWithTimeout('https://ipapi.co/json/');
        if (!res.ok) throw new Error('ipapi.co failed');
        const data = await res.json();
        if (typeof data.latitude === 'number' && typeof data.longitude === 'number') {
          return { lat: data.latitude, lon: data.longitude };
        }
        if (data && data.loc) {
          const [latStr, lonStr] = String(data.loc).split(',');
          const lat = Number(latStr);
          const lon = Number(lonStr);
          if (!Number.isNaN(lat) && !Number.isNaN(lon)) return { lat, lon };
        }
        throw new Error('ipapi.co no coords');
      };

      let coords = null;
      const providers = [tryIpinfo, tryIpwho, tryIpapi];
      for (const p of providers) {
        try {
          coords = await p();
          if (coords) break;
        } catch (_) {
          // continue to next provider
        }
      }

      if (!coords) throw new Error('All IP providers failed or blocked by CORS');

      setLocation({ latitude: coords.lat, longitude: coords.lon });
      setManualLat(String(coords.lat));
      setManualLon(String(coords.lon));
    } catch (e) {
      setError('Unable to retrieve approximate location (CORS or network). Please use the map picker below.');
    } finally {
      setIsLoading(false);
    }
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

  // Initialize a lightweight map for manual location selection
  useEffect(() => {
    if (!pickMapRef.current || pickMap.current) return;
    pickMap.current = new OLMap({
      target: pickMapRef.current,
      layers: [new TileLayer({ source: new OSM() })],
      view: new View({ center: fromLonLat([121.0, 12.0]), zoom: 5 })
    });

    pickMap.current.on('click', (evt) => {
      const [lon, lat] = toLonLat(evt.coordinate);
      setManualLat(String(lat.toFixed(6)));
      setManualLon(String(lon.toFixed(6)));
      setLocation({ latitude: Number(lat), longitude: Number(lon) });
      setError('');
    });

    return () => {
      if (pickMap.current) pickMap.current.setTarget(null);
    };
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
        <button type="button" onClick={requestIPLocation} className="proceed-button" style={{ maxWidth: 280 }}>
          🌐 Use Approximate Location (IP)
        </button>
      </div>

      <div style={{ width: '100%', maxWidth: 600, margin: '0 auto 1rem', textAlign: 'left' }}>
        <p style={{ color: 'var(--text-light)', textAlign: 'center' }}>Or tap the map to set your location</p>
        <div ref={pickMapRef} className="map-picker"></div>
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