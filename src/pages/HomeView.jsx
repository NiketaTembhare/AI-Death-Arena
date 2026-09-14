import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Trophy, Settings, Lock } from 'lucide-react';
import { audioManager } from '../lib/audioManager';

import ArenaBackground from '../components/ArenaBackground';
import AiMascot from '../components/AiMascot';

export default function HomeView() {
  const navigate = useNavigate();
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');

  const handleHostMatch = () => {
    try {
      audioManager.initContext();
      audioManager.playArenaWelcomeIntro();
    } catch (e) {
      console.warn('Audio welcome play error:', e);
    }
    navigate('/match');
  };

  const handleAdminAccess = (e) => {
    e.preventDefault();
    // Single global Host PIN: 2004
    if (pinInput === '2004') {
      setShowPinModal(false);
      navigate('/admin');
    } else {
      setPinError('Invalid PIN code');
    }
  };

  return (
    <ArenaBackground>
      <div style={{
        minHeight: '100vh',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#FFFFFF',
        padding: '2rem 1rem',
        overflowX: 'hidden'
      }}>
        <style>{`
          /* Large Guardian Entrance Fade */
          @keyframes guardianFadeIn {
            0% {
              opacity: 0;
              transform: translateY(-50%) scale(0.88);
              filter: blur(8px);
            }
            100% {
              opacity: 1;
              transform: translateY(-50%) scale(1);
              filter: blur(0);
            }
          }

          /* Floating Animations for Large Guardians */
          @keyframes guardianFloatLeft {
            0%, 100% {
              transform: translateY(-50%) translateY(0px) rotate(-1.5deg);
            }
            50% {
              transform: translateY(-50%) translateY(-14px) rotate(1.5deg);
            }
          }

          @keyframes guardianFloatRight {
            0%, 100% {
              transform: translateY(-50%) scaleX(-1) translateY(0px) rotate(-1.5deg);
            }
            50% {
              transform: translateY(-50%) scaleX(-1) translateY(-14px) rotate(1.5deg);
            }
          }

          /* Energy Particles / Aura Glow */
          @keyframes guardianAuraGlow {
            0%, 100% {
              opacity: 0.35;
              transform: scale(0.95);
            }
            50% {
              opacity: 0.7;
              transform: scale(1.06);
            }
          }

          /* Guardian Container Sizing & Layout */
          .home-guardian-side {
            position: absolute;
            top: 50%;
            width: 250px;
            height: 320px;
            z-index: 4;
            pointer-events: none;
            user-select: none;
            animation-duration: 4.2s;
            animation-timing-function: ease-in-out;
            animation-iteration-count: infinite;
            filter: drop-shadow(0 0 16px rgba(129, 140, 248, 0.35)) drop-shadow(0 0 32px rgba(108, 92, 231, 0.25));
          }

          .home-guardian-left {
            left: clamp(1rem, 4vw, 5rem);
            animation-name: guardianFloatLeft;
          }

          .home-guardian-right {
            right: clamp(1rem, 4vw, 5rem);
            animation-name: guardianFloatRight;
          }

          @media (max-width: 1100px) {
            .home-guardian-side {
              width: 180px;
              height: 230px;
            }
          }

          @media (max-width: 820px) {
            .home-guardian-side {
              width: 130px;
              height: 170px;
              opacity: 0.85;
            }
          }

          @media (max-width: 600px) {
            .home-guardian-side {
              width: 85px;
              height: 110px;
              opacity: 0.35;
              top: 50%;
            }
            .home-guardian-left {
              left: -10px;
            }
            .home-guardian-right {
              right: -10px;
            }
          }

          /* Reduced Motion Override */
          @media (prefers-reduced-motion: reduce) {
            .home-guardian-side {
              animation: none !important;
            }
          }
        `}</style>

        {/* FAR LEFT LARGE AI GUARDIAN */}
        <div className="home-guardian-side home-guardian-left">
          {/* Ambient Guardian Energy Aura Ring */}
          <div style={{
            position: 'absolute',
            inset: '-10%',
            background: 'radial-gradient(circle at center, rgba(56, 189, 248, 0.18) 0%, rgba(129, 140, 248, 0.08) 50%, transparent 75%)',
            borderRadius: '50%',
            pointerEvents: 'none',
            animation: 'guardianAuraGlow 4s ease-in-out infinite'
          }} />
          <AiMascot side="left" animated={false} />
        </div>

        {/* CENTERED MAIN MENU CONTAINER */}
        <div style={{ textAlign: 'center', maxWidth: '440px', width: '100%', position: 'relative', zIndex: 10 }}>
          <h1 className="brand-title" style={{ fontSize: 'clamp(1.3rem, 5.2vw, 2.2rem)', whiteSpace: 'nowrap', marginBottom: '0.25rem' }}>
            IAE AI-BATTLEGROUND
          </h1>
          <p style={{ color: '#A29BFE', fontSize: '0.95rem', marginBottom: '2.5rem', fontWeight: 600 }}>
            Synchronous Expo Booth Trivia
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <button
              onClick={handleHostMatch}
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

        {/* FAR RIGHT LARGE AI GUARDIAN */}
        <div className="home-guardian-side home-guardian-right">
          {/* Ambient Guardian Energy Aura Ring */}
          <div style={{
            position: 'absolute',
            inset: '-10%',
            background: 'radial-gradient(circle at center, rgba(244, 114, 182, 0.18) 0%, rgba(192, 132, 252, 0.08) 50%, transparent 75%)',
            borderRadius: '50%',
            pointerEvents: 'none',
            animation: 'guardianAuraGlow 4s ease-in-out infinite 0.5s'
          }} />
          <AiMascot side="right" animated={false} />
        </div>

        {/* PIN Gate Modal */}
        {showPinModal && (
          <div className="countdown-overlay" style={{ zIndex: 100 }}>
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
    </ArenaBackground>
  );
}

