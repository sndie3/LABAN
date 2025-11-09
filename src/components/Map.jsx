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
import OSM from 'ol/source/OSM';

const regionCoordinates = {
  Luzon: fromLonLat([121.7740, 16.2995]),
  Visayas: fromLonLat([124.6088, 10.4128]),
  Mindanao: fromLonLat([125.4553, 7.9224]),
};

const MapComponent = ({ region, helpRequests, rescuerLocation, selectedRequest }) => {
  const mapRef = useRef();
  const map = useRef(null);
  const vectorSource = useRef(new VectorSource());
  const routeSource = useRef(new VectorSource());
  const rescuerSource = useRef(new VectorSource());

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
      map.current.setTarget(null);
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
      const baseIcon = new Icon({
        src: 'https://openlayers.org/en/latest/examples/data/icon.png',
        scale: isSelected ? 1.2 : 1,
      });
      const style = new Style({ image: baseIcon });
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
    // Support both local selectedRequest.location and Supabase fields
    const locationRaw = selectedRequest.location || {
      latitude: selectedRequest.latitude,
      longitude: selectedRequest.longitude,
    };
    const endLat = Number(locationRaw?.latitude);
    const endLon = Number(locationRaw?.longitude);
    if (Number.isNaN(endLat) || Number.isNaN(endLon)) return;

    let startCoord = null;
    if (
      rescuerLocation &&
      !Number.isNaN(Number(rescuerLocation.latitude)) &&
      !Number.isNaN(Number(rescuerLocation.longitude))
    ) {
      startCoord = fromLonLat([Number(rescuerLocation.longitude), Number(rescuerLocation.latitude)]);
    }
    const end = fromLonLat([endLon, endLat]);
    if (startCoord) {
      const line = new LineString([startCoord, end]);
      const feature = new Feature({ geometry: line });
      feature.setStyle(
        new Style({
          stroke: new Stroke({ color: 'rgba(59,130,246,0.9)', width: 3 }),
        })
      );
      routeSource.current.addFeature(feature);
    }

    if (map.current) {
      map.current.getView().setCenter(end);
      map.current.getView().setZoom(12);
    }
  }, [rescuerLocation, selectedRequest]);

  return <div ref={mapRef} className="map-container"></div>;
};

export default MapComponent;