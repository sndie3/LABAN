// Local Mesh Network for offline request sharing
// This simulates a local mesh network where devices can discover each other
// and share help requests when offline

class LocalMeshNetwork {
  constructor() {
    this.isEnabled = false;
    this.deviceId = this.generateDeviceId();
    this.discoveredDevices = new Set();
    this.localRequests = new Map();
    this.broadcastInterval = null;
    this.discoveryInterval = null;
    this.listeners = new Set();
    this.range = 500; // meters - simulated range for local discovery
  }

  generateDeviceId() {
    return 'device_' + Math.random().toString(36).substr(2, 9);
  }

  // Calculate distance between two coordinates (simplified)
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  }

  // Start the local mesh network
  async start(currentLocation) {
    if (this.isEnabled) return;
    
    this.isEnabled = true;
    this.currentLocation = currentLocation;
    
    console.log(`[LocalMesh] Starting mesh network for device ${this.deviceId}`);
    
    // Start broadcasting our presence
    this.broadcastInterval = setInterval(() => {
      this.broadcastPresence();
    }, 5000); // Broadcast every 5 seconds

    // Start discovering other devices
    this.discoveryInterval = setInterval(() => {
      this.discoverDevices();
    }, 3000); // Discover every 3 seconds

    // Initial broadcast
    this.broadcastPresence();
  }

  // Stop the local mesh network
  stop() {
    if (!this.isEnabled) return;
    
    this.isEnabled = false;
    
    if (this.broadcastInterval) {
      clearInterval(this.broadcastInterval);
      this.broadcastInterval = null;
    }
    
    if (this.discoveryInterval) {
      clearInterval(this.discoveryInterval);
      this.discoveryInterval = null;
    }

    console.log(`[LocalMesh] Stopping mesh network for device ${this.deviceId}`);
  }

  // Broadcast our device presence (simulated with localStorage)
  broadcastPresence() {
    if (!this.isEnabled || !this.currentLocation) return;

    const presence = {
      deviceId: this.deviceId,
      timestamp: Date.now(),
      location: this.currentLocation,
      type: 'mesh_presence',
      range: this.range
    };

    // Store in localStorage for other tabs/windows to discover
    const key = `mesh_presence_${this.deviceId}`;
    try {
      localStorage.setItem(key, JSON.stringify(presence));
      
      // Clean up old presences after 30 seconds
      setTimeout(() => {
        localStorage.removeItem(key);
      }, 30000);
    } catch (error) {
      console.warn('[LocalMesh] Failed to broadcast presence:', error);
    }
  }

  // Discover other devices (simulated by reading localStorage)
  discoverDevices() {
    if (!this.isEnabled || !this.currentLocation) return;

    const now = Date.now();
    const devices = [];

    // Check localStorage for other device presences
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('mesh_presence_') && !key.includes(this.deviceId)) {
        try {
          const presence = JSON.parse(localStorage.getItem(key));
          
          // Check if presence is recent (within 30 seconds)
          if (now - presence.timestamp < 30000) {
            // Calculate distance
            const distance = this.calculateDistance(
              this.currentLocation.latitude,
              this.currentLocation.longitude,
              presence.location.latitude,
              presence.location.longitude
            );

            // Check if device is within range
            if (distance <= this.range) {
              devices.push({
                deviceId: presence.deviceId,
                distance: Math.round(distance),
                location: presence.location,
                lastSeen: presence.timestamp
              });
            }
          }
        } catch (error) {
          console.warn('[LocalMesh] Failed to parse presence:', error);
        }
      }
    }

    // Update discovered devices
    this.discoveredDevices.clear();
    devices.forEach(device => {
      this.discoveredDevices.add(device.deviceId);
    });

    if (devices.length > 0) {
      console.log(`[LocalMesh] Discovered ${devices.length} nearby devices:`, devices);
    }

    // Request data from discovered devices
    devices.forEach(device => {
      this.requestDataFromDevice(device.deviceId);
    });
  }

  // Request help requests from a specific device
  requestDataFromDevice(deviceId) {
    if (!this.isEnabled) return;

    // Send a data request (simulated with localStorage)
    const request = {
      fromDevice: this.deviceId,
      toDevice: deviceId,
      timestamp: Date.now(),
      type: 'data_request'
    };

    const key = `mesh_request_${this.deviceId}_${deviceId}`;
    try {
      localStorage.setItem(key, JSON.stringify(request));
      
      // Clean up after 10 seconds
      setTimeout(() => {
        localStorage.removeItem(key);
      }, 10000);
    } catch (error) {
      console.warn('[LocalMesh] Failed to send data request:', error);
    }
  }

  // Share help requests with nearby devices
  shareHelpRequests(requests) {
    if (!this.isEnabled) return;

    const shareData = {
      deviceId: this.deviceId,
      timestamp: Date.now(),
      type: 'help_requests',
      requests: requests.map(req => ({
        id: req.id,
        user_name: req.user_name,
        message: req.message,
        role: req.role,
        latitude: req.latitude,
        longitude: req.longitude,
        region: req.region,
        status: req.status,
        image_url: req.image_url,
        access_vehicles: req.access_vehicles,
        created_at: req.created_at || req.timestamp
      }))
    };

    const key = `mesh_data_${this.deviceId}`;
    try {
      localStorage.setItem(key, JSON.stringify(shareData));
      
      // Clean up after 30 seconds
      setTimeout(() => {
        localStorage.removeItem(key);
      }, 30000);
    } catch (error) {
      console.warn('[LocalMesh] Failed to share help requests:', error);
    }
  }

  // Listen for incoming data from other devices
  listenForIncomingData() {
    if (!this.isEnabled) return;

    const checkInterval = setInterval(() => {
      if (!this.isEnabled) {
        clearInterval(checkInterval);
        return;
      }

      this.processIncomingData();
    }, 2000); // Check every 2 seconds
  }

  // Process incoming data from other devices
  processIncomingData() {
    const now = Date.now();

    // Check for data requests directed at us
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('mesh_request_') && key.includes(this.deviceId)) {
        try {
          const request = JSON.parse(localStorage.getItem(key));
          
          // Check if this is a recent request for us
          if (request.toDevice === this.deviceId && now - request.timestamp < 10000) {
            // Share our local requests
            const localRequests = Array.from(this.localRequests.values());
            if (localRequests.length > 0) {
              this.shareHelpRequests(localRequests);
            }
            
            // Remove the processed request
            localStorage.removeItem(key);
          }
        } catch (error) {
          console.warn('[LocalMesh] Failed to process data request:', error);
        }
      }
    }

    // Check for shared data from other devices
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('mesh_data_') && !key.includes(this.deviceId)) {
        try {
          const data = JSON.parse(localStorage.getItem(key));
          
          // Check if this is recent data (within 30 seconds)
          if (data.type === 'help_requests' && now - data.timestamp < 30000) {
            // Filter requests that are nearby (within 1km)
            const nearbyRequests = data.requests.filter(req => {
              if (!req.latitude || !req.longitude || !this.currentLocation) return false;
              
              const distance = this.calculateDistance(
                this.currentLocation.latitude,
                this.currentLocation.longitude,
                req.latitude,
                req.longitude
              );
              
              return distance <= 1000; // Within 1km
            });

            if (nearbyRequests.length > 0) {
              console.log(`[LocalMesh] Received ${nearbyRequests.length} nearby requests from device ${data.deviceId}`);
              
              // Notify listeners about new requests
              this.listeners.forEach(listener => {
                listener(nearbyRequests);
              });
            }
          }
        } catch (error) {
          console.warn('[LocalMesh] Failed to process shared data:', error);
        }
      }
    }
  }

  // Add a listener for incoming requests
  addListener(callback) {
    this.listeners.add(callback);
  }

  // Remove a listener
  removeListener(callback) {
    this.listeners.delete(callback);
  }

  // Update current location
  updateLocation(location) {
    this.currentLocation = location;
  }

  // Store a local help request
  storeLocalRequest(request) {
    const requestId = request.id || Date.now().toString();
    this.localRequests.set(requestId, {
      ...request,
      id: requestId,
      deviceId: this.deviceId,
      timestamp: new Date().toISOString()
    });
    
    // Share with nearby devices
    this.shareHelpRequests(Array.from(this.localRequests.values()));
  }

  // Get all local requests (including discovered ones)
  getAllRequests() {
    return Array.from(this.localRequests.values());
  }
}

// Create singleton instance
const localMeshNetwork = new LocalMeshNetwork();

export default localMeshNetwork;