import React, { useMemo } from 'react';

function haversineDistance(a, b) {
  if (!a || !b) return null;
  const R = 6371e3;
  const φ1 = (a.latitude * Math.PI) / 180;
  const φ2 = (b.latitude * Math.PI) / 180;
  const Δφ = ((b.latitude - a.latitude) * Math.PI) / 180;
  const Δλ = ((b.longitude - a.longitude) * Math.PI) / 180;

  const sinΔφ = Math.sin(Δφ / 2);
  const sinΔλ = Math.sin(Δλ / 2);
  const x = sinΔφ * sinΔφ + Math.cos(φ1) * Math.cos(φ2) * sinΔλ * sinΔλ;
  const y = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return R * y; // meters
}

const HelpRequestsList = ({ requests, rescuerLocation, onSelect }) => {
  const items = useMemo(() => {
    const arr = (requests || []).map((req, idx) => {
      // Support both local shape { location: { latitude, longitude } }
      // and Supabase shape { latitude, longitude }
      const loc = req.location || {
        latitude: req.latitude,
        longitude: req.longitude,
      };
      const distance = haversineDistance(rescuerLocation, loc);
      return {
        key: req.id || idx,
        name:
          req.user?.firstName
            ? `${req.user.firstName} ${req.user.lastName || ''}`.trim()
            : req.user_name || 'Civilian',
        message: req.message,
        distance,
        timestamp: req.timestamp || req.created_at,
        raw: req,
      };
    });
    // Sort by newest first when timestamp exists
    return arr.sort((a, b) => {
      const ta = a.timestamp ? Date.parse(a.timestamp) : 0;
      const tb = b.timestamp ? Date.parse(b.timestamp) : 0;
      return tb - ta;
    });
  }, [requests, rescuerLocation]);

  return (
    <div
      className="need-help-container"
      style={{ padding: '1rem', width: '100%', maxWidth: '100%', margin: 0, minHeight: 'auto' }}
    >
      <h2>Rescue Requests ({items.length})</h2>
      {items.length === 0 ? (
        <p style={{ color: 'var(--text-light)' }}>No active requests yet.</p>
      ) : (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            marginTop: '1rem',
            maxHeight: '420px',
            overflowY: 'auto',
            paddingRight: '0.25rem',
          }}
        >
          {items.map((it) => (
            <button
              key={it.key}
              type="button"
              onClick={() => {
                if (!onSelect) return;
                const lat = Number(it.raw.latitude);
                const lon = Number(it.raw.longitude);
                const hasCoords = !Number.isNaN(lat) && !Number.isNaN(lon);
                onSelect({
                  ...it.raw,
                  location: it.raw.location || (hasCoords ? { latitude: lat, longitude: lon } : null),
                });
              }}
              className="quick-message-btn"
              style={{ justifyContent: 'space-between', padding: '0.75rem 1rem' }}
            >
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 700, color: 'var(--primary-blue)' }}>{it.name}</div>
                <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>{it.message}</div>
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-light)' }}>
                {it.distance != null ? `${(it.distance / 1000).toFixed(1)} km` : '—'}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default HelpRequestsList;
