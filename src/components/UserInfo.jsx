import React, { useState } from 'react';

const UserInfo = ({ onNameSubmit }) => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = () => {
    if (firstName.trim() && lastName.trim()) {
      onNameSubmit({ firstName, lastName });
    } else {
      setError('Please enter both your first and last name.');
    }
  };

  return (
    <div className="user-info-container">
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>👤</div>
        <h2>Enter Your Name</h2>
        <p>Please provide your name to continue.</p>
      </div>
      
      <div className="user-info-form">
        <input
          type="text"
          placeholder="First Name"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
        />
        <input
          type="text"
          placeholder="Last Name"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
        />
        {error && <p className="error-message">{error}</p>}
        <button onClick={handleSubmit}>Continue</button>
      </div>
    </div>
  );
};

export default UserInfo;