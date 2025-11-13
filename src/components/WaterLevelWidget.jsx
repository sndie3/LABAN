import React, { useEffect, useMemo, useState } from 'react';
import supabase from '../lib/supabaseClient';
import * as turf from '@turf/turf';

// Enhanced distance calculation that considers the actual location and segment proximity
const calculateDistanceToSegment = (userLocation, report) => {
  if (!userLocation) return Infinity;
  
  const startLat = Number(report.start_lat);
  const startLon = Number(report.start_lon);
  const endLat = Number(report.end_lat);
  const endLon = Number(report.end_lon);
  
  if ([startLat, startLon, endLat, endLon].some((v) => Number.isNaN(v))) return Infinity;
  
  try {
    // Create a line segment from the report
    const segment = turf.lineString([[startLon, startLat], [endLon, endLat]]);
    const userPoint = turf.point([userLocation.longitude, userLocation.latitude]);
    
    // Calculate the distance from user to the nearest point on the segment
    return turf.pointToLineDistance(userPoint, segment, { units: 'kilometers' });
  } catch {
    return Infinity;
  }
};

// Dynamic radius calculation based on location density and type
const getDynamicRadius = (location, reportCount) => {
  if (!location) return { primary: 5, secondary: 10 };
  
  // Base radius varies by location type (urban vs rural)
  // Philippines coordinates: Urban areas generally have more reports
  const isUrbanArea = location.latitude > 14.5 || (location.latitude > 10.5 && location.longitude > 122.0);
  
  // Adjust radius based on report density
  if (reportCount > 50) {
    // High density area - smaller radius for more precision
    return { primary: 2, secondary: 5 };
  } else if (reportCount > 20) {
    // Medium density
    return { primary: isUrbanArea ? 3 : 5, secondary: isUrbanArea ? 7 : 10 };
  } else {
    // Low density area - larger radius to capture more data
    return { primary: isUrbanArea ? 5 : 8, secondary: isUrbanArea ? 10 : 15 };
  }
};

// Calculate flood severity score based on multiple factors
const calculateFloodSeverity = (reports, userLocation, radius) => {
  if (!userLocation || !reports.length) return { level: 'Low', score: 0, details: {} };
  
  const nearbyReports = reports.filter(report => {
    const distance = calculateDistanceToSegment(userLocation, report);
    return distance <= radius;
  });
  
  // Weight recent reports more heavily
  const now = new Date();
  let totalScore = 0;
  let floodedSegments = 0;
  let recentReports = 0;
  let severitySum = 0;
  
  nearbyReports.forEach(report => {
    const distance = calculateDistanceToSegment(userLocation, report);
    const ageHours = report.created_at ? (now - new Date(report.created_at)) / (1000 * 60 * 60) : 24;
    
    // Weight by distance (closer = more relevant)
    const distanceWeight = Math.max(0.1, 1 - (distance / radius));
    
    // Weight by recency (more recent = more relevant)
    const recencyWeight = Math.max(0.1, 1 - (ageHours / 72)); // 72 hour decay
    
    let severity = 0;
    if (report.status === 'flooded') {
      severity = 3;
      floodedSegments++;
    } else if (report.status === 'blocked') {
      severity = 2;
    } else if (report.status === 'clear') {
      severity = -1; // Clear roads reduce flood risk
    }
    
    if (ageHours < 24) recentReports++;
    
    const weightedScore = severity * distanceWeight * recencyWeight;
    severitySum += weightedScore;
    totalScore += Math.abs(weightedScore);
  });
  
  const averageSeverity = totalScore > 0 ? severitySum / totalScore : 0;
  const floodRatio = nearbyReports.length > 0 ? floodedSegments / nearbyReports.length : 0;
  
  // Determine level based on multiple factors
  let level = 'Low';
  let color = '#34d399';
  
  if (averageSeverity > 1.5 || floodRatio > 0.4 || (floodedSegments >= 3 && recentReports >= 2)) {
    level = 'High';
    color = '#ef4444';
  } else if (averageSeverity > 0.5 || floodRatio > 0.2 || floodedSegments >= 1) {
    level = 'Moderate';
    color = '#f59e0b';
  }
  
  return {
    level,
    score: averageSeverity,
    color,
    details: {
      nearbyReports: nearbyReports.length,
      floodedSegments,
      recentReports,
      averageDistance: nearbyReports.length > 0 ? 
        nearbyReports.reduce((sum, r) => sum + calculateDistanceToSegment(userLocation, r), 0) / nearbyReports.length : 0,
      floodRatio
    }
  };
};

const WaterLevelWidget = ({ location, region }) => {
  const [reports, setReports] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    if (!supabase || !region) {
      setError(!supabase ? 'Supabase not configured' : 'Region unavailable');
      return;
    }
    setLoading(true);
    
    // Create AbortController for request cancellation
    const controller = new AbortController();
    
    // Use async function for better error handling
    const fetchReports = async () => {
      try {
        // Fetch more reports for better analysis
        const { data, error: supabaseError } = await supabase
          .from('road_reports')
          .select('*')
          .eq('region', region)
          .order('created_at', { ascending: false })
          .limit(150); // Increased limit for better analysis
          
        if (controller.signal.aborted) return;
        
        if (supabaseError) {
          console.error('Failed to fetch water level reports:', supabaseError);
          setError('Unable to fetch reports');
        } else {
          setReports(Array.isArray(data) ? data : []);
          setLastUpdated(new Date());
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error('Error fetching water level reports:', err);
        setError('Unable to fetch reports');
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };
    
    fetchReports();
    
    // Cleanup function to abort request on unmount or region change
    return () => {
      controller.abort();
    };
  }, [region]);

  const floodAnalysis = useMemo(() => {
    if (!location || reports.length === 0) {
      return {
        severity: { level: 'Unknown', score: 0, details: {} },
        radii: { primary: 5, secondary: 10 },
        nearbyCount: 0
      };
    }
    
    const radii = getDynamicRadius(location, reports.length);
    const severity = calculateFloodSeverity(reports, location, radii.primary);
    const nearbyCount = reports.filter(r => calculateDistanceToSegment(location, r) <= radii.secondary).length;
    
    return { severity, radii, nearbyCount };
  }, [reports, location]);

  const { severity, radii, nearbyCount } = floodAnalysis;
  const { level, score, color, details } = severity;

  return (
    <div className="widget-card">
      <h3 style={{ marginTop: 0 }}>🌊 Water Level Assessment</h3>
      {loading ? (
        <p style={{ color: 'var(--text-light)' }}>Analyzing local water conditions...</p>
      ) : error && reports.length === 0 ? (
        <p style={{ color: 'var(--text-light)' }}>{error}</p>
      ) : (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <span
              style={{
                display: 'inline-block',
                width: 12,
                height: 12,
                borderRadius: '50%',
                background: color,
                boxShadow: `0 0 8px ${color}`,
              }}
            />
            <strong style={{ fontSize: '1.1rem' }}>{level}</strong>
            {level !== 'Unknown' && (
              <span style={{ fontSize: '0.8rem', color: 'var(--text-light)' }}>
                (Score: {score.toFixed(1)})
              </span>
            )}
          </div>
          
          {level !== 'Unknown' && (
            <>
              <div style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                Flooded areas within {radii.primary}km: <strong>{details.floodedSegments || 0}</strong>
              </div>
              
              <div style={{ fontSize: '0.85rem', color: 'var(--text-light)', marginBottom: '0.5rem' }}>
                Recent reports: <strong>{details.recentReports || 0}</strong> | 
                Nearby segments: <strong>{details.nearbyReports || 0}</strong>
              </div>
              
              {details.averageDistance > 0 && (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-light)' }}>
                  Average distance: <strong>{details.averageDistance.toFixed(1)}km</strong>
                </div>
              )}
            </>
          )}
          
          <div style={{ 
            marginTop: '1rem', 
            padding: '0.75rem', 
            background: 'rgba(255,255,255,0.1)', 
            borderRadius: '6px',
            fontSize: '0.8rem'
          }}>
            <p style={{ margin: '0 0 0.5rem 0', fontWeight: '500' }}>📍 Location Analysis:</p>
            <p style={{ margin: 0, color: 'var(--text-light)' }}>
              {location ? 
                `Analyzing flood reports within ${radii.secondary}km of your location` :
                'Location required for accurate assessment'
              }
            </p>
            {nearbyCount > 0 && (
              <p style={{ margin: '0.25rem 0 0 0', color: 'var(--text-light)' }}>
                Using {nearbyCount} relevant reports from {region}
              </p>
            )}
          </div>
          
          {lastUpdated && (
            <p style={{ 
              color: 'var(--text-light)', 
              fontSize: '0.75rem', 
              marginTop: '0.75rem',
              textAlign: 'right'
            }}>
              Updated: {lastUpdated.toLocaleTimeString()}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default WaterLevelWidget;