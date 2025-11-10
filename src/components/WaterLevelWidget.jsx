import React, { useEffect, useMemo, useState } from 'react';
import supabase from '../lib/supabaseClient';
import * as turf from '@turf/turf';

const kmDistanceToSegmentMid = (loc, rep) => {
  if (!loc) return Infinity;
  const midLat = (Number(rep.start_lat) + Number(rep.end_lat)) / 2;
  const midLon = (Number(rep.start_lon) + Number(rep.end_lon)) / 2;
  if ([midLat, midLon].some((v) => Number.isNaN(v))) return Infinity;
  try {
    const a = turf.point([loc.longitude, loc.latitude]);
    const b = turf.point([midLon, midLat]);
    return turf.distance(a, b, { units: 'kilometers' });
  } catch {
    return Infinity;
  }
};

const WaterLevelWidget = ({ location, region }) => {
  const [reports, setReports] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!supabase || !region) {
      setError(!supabase ? 'Supabase not configured' : 'Region unavailable');
      return;
    }
    setLoading(true);
    supabase
      .from('road_reports')
      .select('*')
      .eq('region', region)
      .order('created_at', { ascending: false })
      .limit(80)
      .then(({ data, error }) => {
        if (error) setError('Unable to fetch reports');
        else setReports(Array.isArray(data) ? data : []);
      })
      .finally(() => setLoading(false));
  }, [region]);

  const stats = useMemo(() => {
    const within5km = reports.filter((r) => kmDistanceToSegmentMid(location, r) <= 5);
    const within2km = reports.filter((r) => kmDistanceToSegmentMid(location, r) <= 2);
    const flooded5 = within5km.filter((r) => r.status === 'flooded').length;
    const flooded2 = within2km.filter((r) => r.status === 'flooded').length;
    let level = 'Low';
    let color = '#34d399';
    if (flooded2 >= 3 || flooded5 >= 5) {
      level = 'High';
      color = '#ef4444';
    } else if (flooded2 >= 1 || flooded5 >= 3) {
      level = 'Moderate';
      color = '#f59e0b';
    }
    return { within5km: within5km.length, flooded5, within2km: within2km.length, flooded2, level, color };
  }, [reports, location]);

  return (
    <div className="widget-card">
      <h3 style={{ marginTop: 0 }}>Water Level (Nearby)</h3>
      {loading ? (
        <p style={{ color: 'var(--text-light)' }}>Loading water data…</p>
      ) : error && reports.length === 0 ? (
        <p style={{ color: 'var(--text-light)' }}>{error}</p>
      ) : (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <span
              style={{
                display: 'inline-block',
                width: 10,
                height: 10,
                borderRadius: 999,
                background: stats.color,
              }}
            />
            <strong>{stats.level}</strong>
          </div>
          <div style={{ fontSize: '0.95rem' }}>
            Flooded segments ≤2km: <strong>{stats.flooded2}</strong>
          </div>
          <div style={{ fontSize: '0.95rem' }}>
            Flooded segments ≤5km: <strong>{stats.flooded5}</strong>
          </div>
          <p style={{ color: 'var(--text-light)', marginTop: '0.5rem' }}>
            Based on recent road reports in {region}. Crowdsourced — may be incomplete.
          </p>
        </div>
      )}
    </div>
  );
};

export default WaterLevelWidget;