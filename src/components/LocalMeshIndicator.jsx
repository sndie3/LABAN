import React, { useState, useEffect } from 'react';
import localMeshNetwork from '../lib/localMeshNetwork';

const LocalMeshIndicator = () => {
  const [isActive, setIsActive] = useState(false);
  const [nearbyDevices, setNearbyDevices] = useState(0);

  useEffect(() => {
    const checkMeshStatus = () => {
      setIsActive(localMeshNetwork.isEnabled);
      setNearbyDevices(localMeshNetwork.discoveredDevices.size);
    };

    // Check status every 10 seconds
    const interval = setInterval(checkMeshStatus, 10000);
    checkMeshStatus(); // Initial check

    return () => clearInterval(interval);
  }, []);

  if (!isActive || nearbyDevices === 0) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      background: 'rgba(34, 197, 94, 0.9)',
      color: 'white',
      padding: '8px 12px',
      borderRadius: '20px',
      fontSize: '11px',
      fontWeight: '500',
      boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      backdropFilter: 'blur(4px)'
    }}>
      <span style={{
        width: '6px',
        height: '6px',
        background: '#10B981',
        borderRadius: '50%',
        animation: 'pulse 2s infinite'
      }}></span>
      {nearbyDevices} device{nearbyDevices !== 1 ? 's' : ''} nearby
      
      <style jsx>{`
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default LocalMeshIndicator;