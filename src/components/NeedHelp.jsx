import React, { useState } from 'react';

const NeedHelp = ({ onSubmitRequest }) => {
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (message.trim()) {
      setIsSubmitting(true);
      
      onSubmitRequest(message);
      setMessage('');
      
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