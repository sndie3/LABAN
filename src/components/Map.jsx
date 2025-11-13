import React, { useRef, useEffect } from 'react';
import 'ol/ol.css';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import LineString from 'ol/geom/LineString';
import { fromLonLat } from 'ol/proj';
import { Icon, Style, Stroke, Circle as CircleStyle, Fill } from 'ol/style';
import Text from 'ol/style/Text';
import OSM from 'ol/source/OSM';
import Overlay from 'ol/Overlay';
import supabase from '../lib/supabaseClient';
import * as turf from '@turf/turf';

const regionCoordinates = {
  Luzon: fromLonLat([121.7740, 16.2995]),
  Visayas: fromLonLat([124.6088, 10.4128]),
  Mindanao: fromLonLat([125.4553, 7.9224]),
};

const MapComponent = ({ region, helpRequests, rescuerLocation, selectedRequest, vehicleType = 'car' }) => {
  const mapRef = useRef();
  const map = useRef(null);
  const vectorSource = useRef(new VectorSource());
  const routeSource = useRef(new VectorSource());
  const rescuerSource = useRef(new VectorSource());
  const photoOverlayRef = useRef(null);
  const photoElRef = useRef(null);
  const roadStatusElRef = useRef(null);
  const routeStatusRef = useRef('unknown');

  useEffect(() => {
    map.current = new Map({
      target: mapRef.current,
      layers: [
        new TileLayer({
          source: new OSM(),
        }),
        new VectorLayer({
          source: vectorSource.current,
        }),
        new VectorLayer({
          source: routeSource.current,
        }),
        new VectorLayer({
          source: rescuerSource.current,
        }),
      ],
      view: new View({
        center: regionCoordinates['Luzon'],
        zoom: 6,
      }),
    });

    return () => {
      try { map.current && map.current.setTarget(null); } catch (error) {
        console.warn('Error cleaning up map target:', error);
      }
      if (photoOverlayRef.current && map.current) {
        try { map.current.removeOverlay(photoOverlayRef.current); } catch (error) {
          console.warn('Error removing photo overlay:', error);
        }
      }
      photoOverlayRef.current = null;
      photoElRef.current = null;
      roadStatusElRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (map.current) {
      map.current.getView().setCenter(regionCoordinates[region]);
    }
  }, [region]);

  useEffect(() => {
    vectorSource.current.clear();
    rescuerSource.current.clear();
    // Add rescuer marker when location is known
    if (
      rescuerLocation &&
      typeof rescuerLocation.latitude === 'number' &&
      typeof rescuerLocation.longitude === 'number'
    ) {
      const rescuerMarker = new Feature({
        geometry: new Point(
          fromLonLat([rescuerLocation.longitude, rescuerLocation.latitude])
        ),
      });
      rescuerMarker.setStyle(
        new Style({
          image: new CircleStyle({
            radius: 6,
            fill: new Fill({ color: 'rgba(34,197,94,0.9)' }),
            stroke: new Stroke({ color: '#166534', width: 2 }),
          }),
        })
      );
      rescuerSource.current.addFeature(rescuerMarker);
    }
    helpRequests.forEach((request) => {
      // Support both local shape { location: { latitude, longitude } }
      // and Supabase shape { latitude, longitude } (possibly as strings)
      const locRaw = request.location || {
        latitude: request.latitude,
        longitude: request.longitude,
      };
      const lat = Number(locRaw?.latitude);
      const lon = Number(locRaw?.longitude);
      if (Number.isNaN(lat) || Number.isNaN(lon)) return;

      const marker = new Feature({
        geometry: new Point(fromLonLat([lon, lat])),
      });
      const isSelected = selectedRequest && selectedRequest.id === request.id;
      let style;
      if (request.image_url) {
        style = new Style({
          image: new CircleStyle({
            radius: isSelected ? 8 : 6,
            fill: new Fill({ color: 'rgba(234,179,8,0.9)' }),
            stroke: new Stroke({ color: '#a16207', width: 2 }),
          }),
          text: new Text({
            text: '📷',
            offsetY: -14,
            font: '16px sans-serif',
          }),
        });
      } else {
        const baseIcon = new Icon({
          src: 'https://openlayers.org/en/latest/examples/data/icon.png',
          scale: isSelected ? 1.2 : 1,
        });
        style = new Style({ image: baseIcon });
      }
      marker.setStyle(style);
      vectorSource.current.addFeature(marker);
    });
    // Fit view to show all pins (and rescuer) when available
    const hasRequests = vectorSource.current.getFeatures().length > 0;
    const hasRescuer = rescuerSource.current.getFeatures().length > 0;
    if (map.current && (hasRequests || hasRescuer)) {
      let fitExtent = hasRequests
        ? vectorSource.current.getExtent()
        : rescuerSource.current.getExtent();
      if (hasRequests && hasRescuer) {
        const vExt = vectorSource.current.getExtent();
        const rExt = rescuerSource.current.getExtent();
        fitExtent = [
          Math.min(vExt[0], rExt[0]),
          Math.min(vExt[1], rExt[1]),
          Math.max(vExt[2], rExt[2]),
          Math.max(vExt[3], rExt[3]),
        ];
      }
      map.current.getView().fit(fitExtent, {
        padding: [40, 40, 40, 40],
        maxZoom: 13,
        duration: 400,
      });
    }
  }, [helpRequests, selectedRequest, rescuerLocation]);

  // Show photo overlay card anchored to selected request
  useEffect(() => {
    if (!map.current) return;
    // Remove existing overlay when selection changes
    if (photoOverlayRef.current) {
      try { map.current.removeOverlay(photoOverlayRef.current); } catch (error) {
        console.warn('Error removing existing overlay:', error);
      }
      photoOverlayRef.current = null;
      photoElRef.current = null;
    }

    if (!selectedRequest || !selectedRequest.image_url) return;
    const loc = selectedRequest.location || {
      latitude: selectedRequest.latitude,
      longitude: selectedRequest.longitude,
    };
    if (!loc || Number.isNaN(Number(loc.latitude)) || Number.isNaN(Number(loc.longitude))) return;

    // Create card element (smaller size) with close button
    const wrap = document.createElement('div');
    wrap.style.background = '#fff';
    wrap.style.border = '1px solid var(--border-light)';
    wrap.style.boxShadow = 'var(--shadow-lg)';
    wrap.style.borderRadius = '10px';
    wrap.style.overflow = 'hidden';
    wrap.style.width = '220px';
    wrap.style.position = 'relative';
    const img = document.createElement('img');
    img.src = selectedRequest.image_url;
    img.alt = 'Request photo';
    img.style.display = 'block';
    img.style.width = '100%';
    img.style.height = '140px';
    img.style.objectFit = 'cover';
    // Recommended vehicles badge row
    const veh = document.createElement('div');
    veh.style.display = 'flex';
    veh.style.flexWrap = 'wrap';
    veh.style.gap = '4px';
    veh.style.padding = '6px 8px';
    veh.style.borderTop = '1px solid var(--border-light)';
    veh.style.background = 'rgba(255,255,255,0.85)';
    const recList = Array.isArray(selectedRequest.access_vehicles) ? selectedRequest.access_vehicles : [];
    if (recList.length > 0) {
      const label = document.createElement('div');
      label.textContent = 'Recommended:';
      label.style.fontSize = '0.75rem';
      label.style.color = '#374151';
      label.style.fontWeight = '600';
      veh.appendChild(label);
      recList.forEach((v) => {
        const badge = document.createElement('span');
        badge.textContent = v;
        badge.style.fontSize = '0.72rem';
        badge.style.background = 'rgba(59,130,246,0.12)';
        badge.style.color = '#1d4ed8';
        badge.style.border = '1px solid rgba(59,130,246,0.25)';
        badge.style.borderRadius = '6px';
        badge.style.padding = '2px 6px';
        veh.appendChild(badge);
      });
    }
    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✖';
    closeBtn.title = 'Close';
    closeBtn.style.position = 'absolute';
    closeBtn.style.top = '6px';
    closeBtn.style.right = '6px';
    closeBtn.style.background = 'rgba(0,0,0,0.55)';
    closeBtn.style.color = '#fff';
    closeBtn.style.border = 'none';
    closeBtn.style.borderRadius = '8px';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.width = '24px';
    closeBtn.style.height = '24px';
    closeBtn.style.lineHeight = '24px';
    closeBtn.style.textAlign = 'center';
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (photoOverlayRef.current && map.current) {
        try { map.current.removeOverlay(photoOverlayRef.current); } catch (error) {
          console.warn('Error removing overlay on close:', error);
        }
      }
      photoOverlayRef.current = null;
      photoElRef.current = null;
    });
    const caption = document.createElement('div');
    caption.style.padding = '0.5rem';
    caption.style.fontSize = '0.8rem';
    caption.style.color = 'var(--text-dark)';
    caption.textContent = selectedRequest.message || 'Photo attached';
    wrap.appendChild(img);
    wrap.appendChild(closeBtn);
    wrap.appendChild(caption);
    // Road health badge below caption
    const status = document.createElement('div');
    status.style.margin = '0.375rem 0.5rem 0.5rem';
    status.style.padding = '4px 8px';
    status.style.borderRadius = '8px';
    status.style.fontSize = '0.75rem';
    status.style.fontWeight = '600';
    status.style.width = 'fit-content';
    status.textContent = 'Road Status: Unknown';
    status.style.background = 'rgba(107,114,128,0.18)';
    status.style.color = '#374151';
    wrap.appendChild(status);
    if (recList.length > 0) wrap.appendChild(veh);
    photoElRef.current = wrap;
    roadStatusElRef.current = status;

    const ov = new Overlay({
      element: wrap,
      positioning: 'bottom-center',
      stopEvent: true,
      offset: [0, -12],
    });
    photoOverlayRef.current = ov;
    map.current.addOverlay(ov);
    const coord = fromLonLat([Number(loc.longitude), Number(loc.latitude)]);
    ov.setPosition(coord);
  }, [selectedRequest]);

  // Center on the selected request even if rescuer location is unavailable
  useEffect(() => {
    if (!map.current || !selectedRequest) return;
    if (rescuerLocation &&
        typeof rescuerLocation.latitude === 'number' &&
        typeof rescuerLocation.longitude === 'number') {
      // When rescuer location exists, the routing effect below will handle centering
      return;
    }
    const loc = selectedRequest.location || {
      latitude: selectedRequest.latitude,
      longitude: selectedRequest.longitude,
    };
    if (!loc || typeof loc.latitude !== 'number' || typeof loc.longitude !== 'number') return;
    const end = fromLonLat([Number(loc.longitude), Number(loc.latitude)]);
    map.current.getView().animate({ center: end, zoom: 13, duration: 300 });
  }, [selectedRequest, rescuerLocation]);

  useEffect(() => {
    routeSource.current.clear();
    if (!selectedRequest) return;
    const locationRaw = selectedRequest.location || {
      latitude: selectedRequest.latitude,
      longitude: selectedRequest.longitude,
    };
    const endLat = Number(locationRaw?.latitude);
    const endLon = Number(locationRaw?.longitude);
    if (Number.isNaN(endLat) || Number.isNaN(endLon)) return;

    const hasRescuer = rescuerLocation &&
      !Number.isNaN(Number(rescuerLocation.latitude)) &&
      !Number.isNaN(Number(rescuerLocation.longitude));
    const end = fromLonLat([endLon, endLat]);

    const updateRoadBadge = (st) => {
      routeStatusRef.current = st;
      if (roadStatusElRef.current) {
        const el = roadStatusElRef.current;
        let text = 'Road Status: Unknown';
        let bg = 'rgba(107,114,128,0.18)';
        let color = '#374151';
        if (st === 'usable') { text = 'Road Health: Usable'; bg = 'rgba(34,197,94,0.18)'; color = '#166534'; }
        if (st === 'unavailable') { text = 'Road Health: Not Usable'; bg = 'rgba(239,68,68,0.18)'; color = '#991b1b'; }
        el.textContent = text;
        el.style.background = bg;
        el.style.color = color;
      }
    };

    const drawStraight = () => {
      if (!hasRescuer) {
        if (map.current) {
          map.current.getView().setCenter(end);
          map.current.getView().setZoom(12);
        }
        updateRoadBadge('unknown');
        return;
      }
      const startCoord = fromLonLat([Number(rescuerLocation.longitude), Number(rescuerLocation.latitude)]);
      const line = new LineString([startCoord, end]);
      const feature = new Feature({ geometry: line });
      feature.setStyle(new Style({ stroke: new Stroke({ color: 'rgba(59,130,246,0.9)', width: 3 }) }));
      routeSource.current.addFeature(feature);
      if (map.current) {
        map.current.getView().fit(feature.getGeometry().getExtent(), { padding: [40,40,40,40], duration: 300 });
      }
      updateRoadBadge('unknown');
    };

    if (!hasRescuer) { drawStraight(); return; }

    // Try OSRM for best route; fallback to straight line on failure
    const startLon = Number(rescuerLocation.longitude);
    const startLat = Number(rescuerLocation.latitude);
    // OSRM supports walking/cycling/driving; no boat profile. For boats, draw straight.
    if (vehicleType === 'boat') {
      drawStraight();
      updateRoadBadge('unknown');
      return;
    }
    const profile = vehicleType === 'foot' ? 'walking' : 'driving';
    const url = `https://router.project-osrm.org/route/v1/${profile}/${startLon},${startLat};${endLon},${endLat}?overview=full&geometries=geojson`;
    fetch(url).then((res) => {
      if (!res.ok) throw new Error('OSRM failed');
      return res.json();
    }).then(async (json) => {
      const coords = json?.routes?.[0]?.geometry?.coordinates;
      if (!coords || !Array.isArray(coords)) throw new Error('No route');
      const olCoords = coords.map(([lon, lat]) => fromLonLat([lon, lat]));
      const line = new LineString(olCoords);
      const feature = new Feature({ geometry: line });
      feature.setStyle(new Style({ stroke: new Stroke({ color: 'rgba(59,130,246,0.9)', width: 3 }) }));
      routeSource.current.addFeature(feature);
      if (map.current) {
        map.current.getView().fit(feature.getGeometry().getExtent(), { padding: [40,40,40,40], duration: 400, maxZoom: 15 });
      }
      // Combine with crowdsourced road reports using accurate intersection/distance and time-decay
      let finalStatus = 'usable';
      const routeLine = turf.lineString(coords); // OSRM geometry is lon/lat already
      if (supabase) {
        try {
          const { data } = await supabase
            .from('road_reports')
            .select('*')
            .eq('region', region);
          if (Array.isArray(data) && data.length) {
            const thresholdMeters = 40; // tighter buffer for better precision
            const staleHours = 72; // ignore reports older than 3 days
            let newestRelevant = null;
            for (const rep of data) {
              const sLon = Number(rep.start_lon);
              const sLat = Number(rep.start_lat);
              const eLon = Number(rep.end_lon);
              const eLat = Number(rep.end_lat);
              if ([sLon,sLat,eLon,eLat].some((n) => Number.isNaN(n))) continue;
              const createdAt = rep.created_at ? new Date(rep.created_at) : null;
              const ageHours = createdAt ? ((Date.now() - createdAt.getTime()) / (1000*60*60)) : Infinity;
              if (ageHours > staleHours) continue; // skip stale reports
              const seg = turf.lineString([[sLon, sLat], [eLon, eLat]]);
              const intersects = turf.lineIntersect(routeLine, seg);
              const nearStart = turf.pointToLineDistance(turf.point([sLon, sLat]), routeLine, { units: 'meters' }) <= thresholdMeters;
              const nearEnd = turf.pointToLineDistance(turf.point([eLon, eLat]), routeLine, { units: 'meters' }) <= thresholdMeters;
              const close = (intersects.features?.length || 0) > 0 || nearStart || nearEnd;
              if (!close) continue;
              if (!newestRelevant || (createdAt && new Date(newestRelevant.created_at) < createdAt)) {
                newestRelevant = rep;
              }
            }
            if (newestRelevant) {
              const newestStatus = (newestRelevant.status || '').toLowerCase();
              if (newestStatus === 'clear') {
                finalStatus = 'usable';
              } else {
                const affects = vehicleType === 'boat' ? newestStatus === 'blocked' : (newestStatus === 'blocked' || newestStatus === 'flooded');
                finalStatus = affects ? 'unavailable' : 'usable';
              }
            }
          }
        } catch (error) {
          console.warn('Error fetching road reports:', error);
        }
      }
      updateRoadBadge(finalStatus);
    }).catch(() => {
      // OSRM failed: draw straight and mark road health unknown
      drawStraight();
      updateRoadBadge('unknown');
    });
  }, [rescuerLocation, selectedRequest, vehicleType, region]);

  return <div ref={mapRef} className="map-container"></div>;
};

export default MapComponent;