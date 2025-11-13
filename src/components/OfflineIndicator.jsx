import React, { useState, useEffect } from 'react';
import { isOnline, setupConnectionListener } from '../lib/offlineStorage';

const OfflineIndicator = () => {
  const [online, setOnline] = useState(isOnline());
  const [showSyncStatus, setShowSyncStatus] = useState(false);
  const [syncCount, setSyncCount] = useState({ helpRequests: 0, roadReports: 0 });

  useEffect(() => {
    // Listen for connection changes
    const unsubscribe = setupConnectionListener(() => {
      setOnline(isOnline());
    });

    // Listen for sync events
    const handleSyncComplete = (event) => {
      const result = event.detail;
      if (result.success) {
        setSyncCount(result.results.helpRequests.synced + result.results.roadReports.synced);
        setShowSyncStatus(true);
        setTimeout(() => setShowSyncStatus(false), 3000);
      }
    };

    window.addEventListener('offline-sync-complete', handleSyncComplete);

    return () => {
      unsubscribe();
      window.removeEventListener('offline-sync-complete', handleSyncComplete);
    };
  }, []);

  if (online && !showSyncStatus) {
    return null; // Don't show anything when online and no sync status
  }

  return (
    <div style={{
      position: 'fixed',
      top: '20px',
      right: '20px',
      zIndex: 1000,
      background: online ? '#10b981' : '#ef4444',
      color: 'white',
      padding: '8px 16px',
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      fontSize: '0.9rem',
      fontWeight: '500',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      animation: 'slideInRight 0.3s ease-out'
    }}>
      {showSyncStatus ? (
        <>
          <span style={{ animation: 'pulse 1s infinite' }}>🔄</span>
          <span>Synced {syncCount} items</span>
        </>
      ) : (
        <>
          <span style={{ animation: 'pulse 2s infinite' }}>📡</span>
          <span>Offline Mode</span>
        </>
      )}
    </div>
  );
};

export default OfflineIndicator;