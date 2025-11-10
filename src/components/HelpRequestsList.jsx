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
            gap: '1rem',
            marginTop: '1rem',
            maxHeight: '60vh',
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
              style={{ justifyContent: 'space-between', padding: '1rem 1.25rem', borderRadius: 14 }}
            >
              <div style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                {it.raw?.image_url ? (
                  <span title="Includes photo" style={{ fontSize: '1.1rem' }}>📷</span>
                ) : null}
                <div style={{ fontWeight: 700, color: 'var(--primary-blue)' }}>{it.name}</div>
                <div style={{ fontSize: '0.95rem', opacity: 0.9 }}>{it.message}</div>
                {Array.isArray(it.raw?.access_vehicles) && it.raw.access_vehicles.length > 0 ? (
                  <div style={{ display: 'inline-flex', gap: '0.3rem', marginLeft: '0.5rem' }}>
                    {it.raw.access_vehicles.map((v, i) => (
                      <span key={`${v}-${i}`} style={{ fontSize: '0.75rem', background: 'rgba(59,130,246,0.12)', color: '#1d4ed8', border: '1px solid rgba(59,130,246,0.25)', borderRadius: 6, padding: '0.15rem 0.35rem' }}>
                        {v}
                      </span>
                    ))}
                  </div>
                ) : null}
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
