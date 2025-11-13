import React, { useState } from 'react';
import supabase from '../lib/supabaseClient';

const NeedHelp = ({ onSubmitRequest }) => {
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [accessVehicles, setAccessVehicles] = useState([]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (message.trim()) {
      setIsSubmitting(true);
      setUploadError('');

      let imageUrl = null;
      if (imageFile && supabase) {
        try {
          const fileExt = imageFile.name.split('.').pop();
          const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt || 'jpg'}`;
          const filePath = `requests/${fileName}`;
          const { error: upErr } = await supabase.storage.from('request-images').upload(filePath, imageFile, {
            cacheControl: '3600',
            upsert: false,
            contentType: imageFile.type || 'image/jpeg',
          });
          if (!upErr) {
            const { data: pub } = supabase.storage.from('request-images').getPublicUrl(filePath);
            imageUrl = pub?.publicUrl || null;
          } else {
            setUploadError('Image upload failed. Sending without photo.');
          }
        } catch (err) {
          console.error('Image upload error:', err);
          if (err.message?.includes('bucket')) {
            setUploadError('Image storage not available. Sending without photo.');
          } else if (err.message?.includes('network')) {
            setUploadError('Network error during upload. Sending without photo.');
          } else {
            setUploadError('Image upload failed. Sending without photo.');
          }
        }
      }

      onSubmitRequest({ message, imageUrl, accessVehicles });
      setMessage('');
      setImageFile(null);
      setImagePreview('');
      setAccessVehicles([]);

      setTimeout(() => {
        setIsSubmitting(false);
        alert('🚨 Help request sent! Rescuers in your area have been notified and will respond shortly.');
      }, 1000);
    }
  };

  const quickMessages = [
    "🌊 Water is rising in our area - need immediate evacuation",
    "🏠 House is flooded - trapped on second floor",
    "🍞 Need food and water supplies - stranded for 2 days",
    "🏥 Medical emergency - need immediate assistance",
    "⚡ Downed power lines in our area - dangerous conditions",
    "👨‍👩‍👧‍👦 Elderly people need help - cannot evacuate alone"
  ];

  return (
    <div className="need-help-container">
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <div style={{ 
          fontSize: '3rem', 
          marginBottom: '1rem',
          animation: 'pulse 1s infinite'
        }}>
          🆘
        </div>
        
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ 
            display: 'block', 
            marginBottom: '0.5rem', 
            fontWeight: '600',
            color: 'var(--text-dark)'
          }}>
            What vehicles can enter your area? (select all that apply)
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {[
              { key: 'car', label: 'Car' },
              { key: 'motorcycle', label: 'Motorcycle' },
              { key: 'foot', label: 'On Foot' },
              { key: 'boat', label: 'Boat' },
              { key: 'truck', label: 'Truck' },
            ].map((opt) => {
              const checked = accessVehicles.includes(opt.key);
              return (
                <label key={opt.key} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: 'rgba(255,255,255,0.7)', border: '1px solid var(--border-light)', borderRadius: 8, padding: '0.35rem 0.6rem' }}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      const next = e.target.checked
                        ? [...accessVehicles, opt.key]
                        : accessVehicles.filter((v) => v !== opt.key);
                      setAccessVehicles(next);
                    }}
                  />
                  <span>{opt.label}</span>
                </label>
              );
            })}
          </div>
          <p style={{ color: 'var(--text-light)', fontSize: '0.85rem', marginTop: '0.4rem' }}>
            Tip: choose all that could realistically reach you given road or flood conditions.
          </p>
        </div>
        <h2>Emergency Help Request</h2>
        <p style={{ color: 'var(--emergency-red)', fontWeight: 'bold' }}>
          Send your location and situation to nearby rescuers
        </p>
      </div>
      
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ 
            display: 'block', 
            marginBottom: '0.5rem', 
            fontWeight: '600',
            color: 'var(--text-dark)'
          }}>
            Describe your emergency situation:
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your emergency message here... (e.g., Water is rising in our area, We need food supplies, Medical emergency)"
            required
            rows={4}
          />
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ 
            display: 'block', 
            marginBottom: '0.5rem', 
            fontWeight: '600',
            color: 'var(--text-dark)'
          }}>
            Optional: attach a photo for verification
          </label>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => {
              const file = e.target.files?.[0] || null;
              setImageFile(file);
              setUploadError('');
              if (file) {
                const reader = new FileReader();
                reader.onload = () => setImagePreview(reader.result);
                reader.readAsDataURL(file);
              } else {
                setImagePreview('');
              }
            }}
            style={{ display: 'block' }}
          />
          {imagePreview && (
            <div style={{ marginTop: '0.5rem' }}>
              <img src={imagePreview} alt="Preview" style={{ maxWidth: '100%', borderRadius: 8, border: '1px solid var(--border-light)' }} />
            </div>
          )}
          {uploadError && (
            <p style={{ color: 'var(--emergency-red)', marginTop: '0.5rem' }}>{uploadError}</p>
          )}
        </div>
        
        <div style={{ marginBottom: '1.5rem' }}>
          <p style={{ 
            fontSize: '0.9rem', 
            color: 'var(--text-light)', 
            marginBottom: '0.5rem',
            fontWeight: '500'
          }}>
            Quick messages (click to use):
          </p>
          <div className="quick-messages">
            {quickMessages.map((quickMsg, index) => (
              <button
                key={index}
                type="button"
                onClick={() => setMessage(quickMsg)}
                className="quick-message-btn"
              >
                {quickMsg}
              </button>
            ))}
          </div>
        </div>
        
        <button 
          type="submit" 
          disabled={isSubmitting || !message.trim()}
          style={{
            background: isSubmitting ? '#9ca3af' : 'linear-gradient(135deg, var(--emergency-red), #b91c1c)',
            cursor: isSubmitting ? 'not-allowed' : 'pointer'
          }}
        >
          {isSubmitting ? (
            <span>
              <span className="loading" style={{ marginRight: '0.5rem' }}></span>
              Sending Alert...
            </span>
          ) : (
            <span>🚨 SEND EMERGENCY ALERT</span>
          )}
        </button>
      </form>
      
      <div style={{ 
        textAlign: 'center', 
        marginTop: '1.5rem', 
        fontSize: '0.8rem', 
        color: 'var(--text-light)',
        padding: '1rem',
        background: 'rgba(220, 38, 38, 0.1)',
        borderRadius: '8px',
        border: '1px solid rgba(220, 38, 38, 0.2)'
      }}>
        <p><strong>⚠️ This is an emergency alert system</strong></p>
        <p>Only use this feature if you need immediate assistance</p>
        <p>📍 Your location will be shared with nearby rescuers</p>
      </div>
    </div>
  );
};

export default NeedHelp;