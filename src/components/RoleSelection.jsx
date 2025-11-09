import React from 'react';

const RoleSelection = ({ onRoleSelect }) => {
  return (
    <div className="role-selection-container">
      <div className="role-header">
        <div className="emergency-icon">
          🚨
        </div>
        <h2>Choose Your Role</h2>
        <p>Select your role to get the appropriate tools and features for disaster response.</p>
      </div>
      
      <div className="role-buttons">
        <button 
          className="role-button civilian"
          onClick={() => onRoleSelect('Civilian')}
        >
          <div className="role-content">
            <div className="role-icon">🧍</div>
            <div className="role-title">
              Civilian
            </div>
            <div className="role-description">
              Request help or report emergency conditions
            </div>
          </div>
        </button>
        
        <button 
          className="role-button rescuer"
          onClick={() => onRoleSelect('Rescuer')}
        >
          <div className="role-content">
            <div className="role-icon">🚒</div>
            <div className="role-title">
              Rescuer
            </div>
            <div className="role-description">
              Assist and respond to emergency situations
            </div>
          </div>
        </button>
      </div>
      
      <div style={{ 
        textAlign: 'center', 
        marginTop: '2rem', 
        fontSize: '0.8rem', 
        color: 'var(--text-light)',
        opacity: 0.8
      }}>
        <p>💡 You can change your role later if needed</p>
      </div>
    </div>
  );
};

export default RoleSelection;