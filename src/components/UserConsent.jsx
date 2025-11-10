import React, { useState, useEffect, useRef } from 'react';
import 'ol/ol.css';
import OLMap from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import { toLonLat, fromLonLat } from 'ol/proj';
import Overlay from 'ol/Overlay';

const UserConsent = ({ onConsent }) => {
  const [location, setLocation] = useState(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [permissionState, setPermissionState] = useState('');
  const [manualLat, setManualLat] = useState('');
  const [manualLon, setManualLon] = useState('');
  const pickMapRef = useRef(null);
  const pickMap = useRef(null);
  const markerElRef = useRef(null);
  const markerOverlayRef = useRef(null);
  const [selectedPlace, setSelectedPlace] = useState('');

  const safeUpdateSize = () => {
    try {
      if (pickMap.current && typeof pickMap.current.updateSize === 'function') {
        pickMap.current.updateSize();
      }
    } catch (err) {
      // ignore sizing errors
      void err;
    }
  };

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
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        setLocation({ latitude: lat, longitude: lon });
        setManualLat(String(lat));
        setManualLon(String(lon));
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

  // Removed IP-based approximate location due to accuracy concerns

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
        .catch(() => null);
    }
  }, []);

  // Initialize a lightweight map for manual location selection
  useEffect(() => {
    if (!pickMapRef.current || pickMap.current) return;
    pickMap.current = new OLMap({
      target: pickMapRef.current,
      layers: [new TileLayer({ source: new OSM({ crossOrigin: 'anonymous' }) })],
      view: new View({ center: fromLonLat([121.0, 12.0]), zoom: 5 })
    });

    // Ensure size is calculated after render
    setTimeout(() => { safeUpdateSize(); }, 0);

    // Create a simple marker overlay
    markerElRef.current = document.createElement('div');
    markerElRef.current.className = 'marker-pin';
    markerElRef.current.textContent = '📍';
    markerOverlayRef.current = new Overlay({
      element: markerElRef.current,
      positioning: 'bottom-center',
      stopEvent: false,
    });
    pickMap.current.addOverlay(markerOverlayRef.current);

    pickMap.current.on('click', (evt) => {
      const [lon, lat] = toLonLat(evt.coordinate);
      setManualLat(String(lat.toFixed(6)));
      setManualLon(String(lon.toFixed(6)));
      setLocation({ latitude: Number(lat), longitude: Number(lon) });
      setError('');
      if (markerOverlayRef.current) {
        markerOverlayRef.current.setPosition(evt.coordinate);
      }
      // Fetch a human-readable place name
      reverseGeocode(lat, lon);
    });

    return () => {
      if (pickMap.current) {
        try { pickMap.current.setTarget(null); } catch (err) { void err; }
        // Reset ref so React StrictMode re-mount can re-initialize the map
        pickMap.current = null;
      }
    };
  }, []);

  // Keep map sized on window resize
  useEffect(() => {
    const onResize = () => { safeUpdateSize(); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Aggressively ensure OpenLayers computes size after initial render cycles
  useEffect(() => {
    let frames = [];
    for (let i = 0; i < 5; i++) {
      const id = requestAnimationFrame(() => { safeUpdateSize(); });
      frames.push(id);
    }
    const onLoad = () => { safeUpdateSize(); };
    window.addEventListener('load', onLoad);
    return () => {
      frames.forEach((id) => cancelAnimationFrame(id));
      window.removeEventListener('load', onLoad);
    };
  }, []);

  // Observe container size changes to trigger OpenLayers updateSize
  useEffect(() => {
    if (!pickMapRef.current) return;
    let ro;
    try {
      ro = new ResizeObserver(() => { safeUpdateSize(); });
      ro.observe(pickMapRef.current);
    } catch (err) { void err; }
    return () => {
      try { ro && ro.disconnect(); } catch (err) { void err; }
    };
  }, []);

  // Reflect location changes on the map in real time
  useEffect(() => {
    if (!pickMap.current || !location) return;
    const center = fromLonLat([location.longitude, location.latitude]);
    markerOverlayRef.current?.setPosition(center);
    try { pickMap.current.getView().animate({ center, zoom: 15, duration: 500 }); } catch (err) { void err; }
    // keep manual fields in sync
    setManualLat(String(location.latitude.toFixed(6)));
    setManualLon(String(location.longitude.toFixed(6)));
    // update display name
    reverseGeocode(location.latitude, location.longitude);
  }, [location]);

  // When manual coordinates are valid, reflect them to location (and map)
  useEffect(() => {
    if (!isManualValid) return;
    const lat = Number(manualLat);
    const lon = Number(manualLon);
    if (
      location &&
      Math.abs(location.latitude - lat) < 1e-6 &&
      Math.abs(location.longitude - lon) < 1e-6
    ) {
      return;
    }
    setLocation({ latitude: lat, longitude: lon });
  }, [manualLat, manualLon, isManualValid, location]);

  const reverseGeocode = async (lat, lon) => {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`;
      const res = await fetch(url, { headers: { 'Accept-Language': 'en' }, mode: 'cors' });
      if (!res.ok) return;
      const data = await res.json();
      if (data && data.display_name) {
        setSelectedPlace(data.display_name);
      }
    } catch (err) { void err; }
  };


  // Place search removed per request

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

      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
        <button type="button" onClick={requestLocation} className="proceed-button" style={{ maxWidth: 240 }}>
          🔁 Try Again
        </button>
      </div>

      {/* Overlays for stores and house names removed per request */}

      {/* Place search removed per request */}

      <div style={{ width: '100%', maxWidth: 600, margin: '0 auto 1rem', textAlign: 'left' }}>
        <p style={{ color: 'var(--text-light)', textAlign: 'center' }}>Or tap the map to set your location</p>
        <div ref={pickMapRef} className="map-picker"></div>
        {selectedPlace && (
          <p className="selected-place" style={{ marginTop: '0.5rem', textAlign: 'center' }}>
            Selected: {selectedPlace}
          </p>
        )}
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