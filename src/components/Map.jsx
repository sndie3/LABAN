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
    helpRequests.forEach((request) => {
      // Support both local shape { location: { latitude, longitude } }
      // and Supabase shape { latitude, longitude }
      const loc = request.location || {
        latitude: request.latitude,
        longitude: request.longitude,
      };
      if (!loc || typeof loc.latitude !== 'number' || typeof loc.longitude !== 'number') return;

      const marker = new Feature({
        geometry: new Point(fromLonLat([loc.longitude, loc.latitude])),
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
  }, [helpRequests, selectedRequest]);

  useEffect(() => {
    routeSource.current.clear();
    if (!rescuerLocation || !selectedRequest) return;
    // Support both local selectedRequest.location and Supabase fields
    const location = selectedRequest.location || {
      latitude: selectedRequest.latitude,
      longitude: selectedRequest.longitude,
    };
    if (!location || typeof location.latitude !== 'number' || typeof location.longitude !== 'number') return;
    if (typeof rescuerLocation.latitude !== 'number' || typeof rescuerLocation.longitude !== 'number') return;

    const start = fromLonLat([rescuerLocation.longitude, rescuerLocation.latitude]);
    const end = fromLonLat([location.longitude, location.latitude]);
    const line = new LineString([start, end]);
    const feature = new Feature({ geometry: line });
    feature.setStyle(
      new Style({
        stroke: new Stroke({ color: 'rgba(59,130,246,0.9)', width: 3 }),
      })
    );
    routeSource.current.addFeature(feature);

    if (map.current) {
      map.current.getView().setCenter(end);
      map.current.getView().setZoom(12);
    }
  }, [rescuerLocation, selectedRequest]);

  return <div ref={mapRef} className="map-container"></div>;
};

export default MapComponent;