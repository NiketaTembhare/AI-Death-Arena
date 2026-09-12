import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Trophy, Settings, Lock } from 'lucide-react';

export default function HomeView() {
  const navigate = useNavigate();
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');

  const handleAdminAccess = (e) => {
    e.preventDefault();
    // Single global Host PIN: 1234
    if (pinInput === '1234') {
      setShowPinModal(false);
      navigate('/admin');
    } else {
      setPinError('Invalid PIN code');
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #161334 0%, #0D0B1D 100%)',
      color: '#FFFFFF',
      padding: '2rem'
    }}>
      <div style={{ textAlign: 'center', maxWidth: '420px', width: '100%' }}>
        <h1 className="brand-title" style={{ fontSize: '2.5rem', marginBottom: '0.25rem' }}>
          AI-DEATH ARENA
        </h1>
        <p style={{ color: '#A29BFE', fontSize: '0.95rem', marginBottom: '2.5rem', fontWeight: 600 }}>
          Synchronous Expo Booth Trivia
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <button
            onClick={() => navigate('/match')}
            className="btn btn-purple"
            style={{ width: '100%', fontSize: '1.25rem', padding: '1.1rem' }}
          >
            <Play size={24} /> HOST MATCH
          </button>

          <button
            onClick={() => navigate('/leaderboard')}
            className="btn btn-yellow"
            style={{ width: '100%', fontSize: '1.25rem', padding: '1.1rem' }}
          >
            <Trophy size={24} /> HALL OF FAME
          </button>

          <button
            onClick={() => {
              setPinInput('');
              setPinError('');
              setShowPinModal(true);
            }}
            className="btn btn-blue"
            style={{ width: '100%', fontSize: '1.25rem', padding: '1.1rem' }}
          >
            <Settings size={24} /> GAME CONFIG
          </button>
        </div>
      </div>

      {/* PIN Gate Modal */}
      {showPinModal && (
        <div className="countdown-overlay">
          <div className="card-light" style={{ width: '90%', maxWidth: '360px', textAlign: 'center', color: '#2D3436' }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: '#FFEAA7',
              color: '#D63031',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem'
            }}>
              <Lock size={28} />
            </div>
            <h2 style={{ marginBottom: '0.5rem' }}>Host PIN Required</h2>
            <p style={{ color: '#636E72', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
              Enter host PIN code to access Game Config
            </p>
            <form onSubmit={handleAdminAccess}>
              <input
                type="password"
                maxLength={4}
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                placeholder="Enter PIN (e.g. 1234)"
                autoFocus
                style={{
                  width: '100%',
                  padding: '0.8rem',
                  fontSize: '1.5rem',
                  textAlign: 'center',
                  letterSpacing: '0.5rem',
                  borderRadius: '12px',
                  border: '2px solid #E2E8F0',
                  marginBottom: '1rem'
                }}
              />
              {pinError && <p style={{ color: '#E71D36', fontSize: '0.85rem', marginBottom: '0.75rem' }}>{pinError}</p>}
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowPinModal(false)}
                  className="btn"
                  style={{ flex: 1, background: '#DFE6E9', color: '#2D3436' }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-purple" style={{ flex: 1 }}>
                  Submit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
