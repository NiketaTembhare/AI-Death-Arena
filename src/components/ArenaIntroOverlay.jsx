import React, { useEffect, useState, useRef } from 'react';
import { audioManager } from '../lib/audioManager';
import { X, Swords } from 'lucide-react';

export default function ArenaIntroOverlay({ onClose }) {
  const [isFadingOut, setIsFadingOut] = useState(false);
  const hasTriggeredAudioRef = useRef(false);

  useEffect(() => {
    if (!hasTriggeredAudioRef.current) {
      hasTriggeredAudioRef.current = true;
      try {
        audioManager.initContext();
        audioManager.playArenaWelcomeIntro();
      } catch (e) {
        console.warn('Welcome audio error:', e);
      }
    }

    // Auto-dismiss after the full cinematic sequence finishes
    const timer = setTimeout(() => {
      handleClose();
    }, 5000);

    return () => {
      clearTimeout(timer);
    };
  }, []);

  const handleClose = (e) => {
    if (e) e.stopPropagation();
    setIsFadingOut(true);
    setTimeout(() => {
      if (onClose) onClose();
    }, 380);
  };

  return (
    <div
      onClick={handleClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(9, 7, 20, 0.92)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        opacity: isFadingOut ? 0 : 1,
        transform: isFadingOut ? 'scale(1.04)' : 'scale(1)',
        transition: 'opacity 0.38s ease, transform 0.38s ease',
        cursor: 'pointer',
        padding: '1.25rem',
        overflow: 'hidden'
      }}
    >
      <style>{`
        /* Cinematic Card Intro */
        @keyframes cinematicCardIn {
          0% {
            opacity: 0;
            transform: scale(0.93) translateY(14px);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        /* Subdued Center Ambient Glow */
        @keyframes backlightSurge {
          0% {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.6);
          }
          50% {
            opacity: 0.35;
            transform: translate(-50%, -50%) scale(1.05);
          }
          100% {
            opacity: 0.22;
            transform: translate(-50%, -50%) scale(1);
          }
        }

        /* "WELCOME TO AI" - Soft Cinematic Fade */
        @keyframes revealWelcomeAI {
          0% {
            opacity: 0;
            transform: scale(0.88) translateY(6px);
            letter-spacing: 0.12em;
            filter: blur(6px);
          }
          60% {
            opacity: 1;
            filter: blur(0) drop-shadow(0 0 10px rgba(56, 189, 248, 0.35));
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(0);
            letter-spacing: 0.2em;
            filter: blur(0) drop-shadow(0 0 8px rgba(129, 140, 248, 0.25));
          }
        }

        /* "DEATH ARENA" - Smooth Impact Reveal (Controlled Brightness) */
        @keyframes impactDeathArena {
          0% {
            opacity: 0;
            transform: scale(1.22) translateY(8px);
            filter: blur(10px);
            letter-spacing: 0.02em;
          }
          45% {
            opacity: 1;
            transform: scale(0.98) translateY(-1px);
            filter: blur(0) drop-shadow(0 0 22px rgba(108, 92, 231, 0.45)) drop-shadow(0 0 35px rgba(225, 29, 72, 0.3));
            letter-spacing: 0.04em;
          }
          75% {
            transform: scale(1.01) translateY(0);
            filter: blur(0) drop-shadow(0 0 16px rgba(108, 92, 231, 0.35));
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(0);
            filter: blur(0) drop-shadow(0 0 14px rgba(108, 92, 231, 0.3));
            letter-spacing: 0.03em;
          }
        }

        /* Soft Cinematic Light Streak */
        @keyframes beamSweep {
          0% {
            transform: translateX(-120%) skewX(-25deg);
            opacity: 0;
          }
          40% {
            opacity: 0.25;
          }
          100% {
            transform: translateX(180%) skewX(-25deg);
            opacity: 0;
          }
        }

        /* "⚡ BATTLE GROUND! ⚡" - Subdued Energy Impact */
        @keyframes battleGroundEntrance {
          0% {
            opacity: 0;
            transform: scale(0.8) translateY(10px);
            filter: blur(6px);
          }
          60% {
            opacity: 1;
            transform: scale(1.05) translateY(-1px);
            filter: blur(0);
            box-shadow: 0 0 24px rgba(225, 29, 72, 0.4), 0 0 40px rgba(217, 119, 6, 0.25);
          }
          85% {
            transform: scale(0.99) translateY(0);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(0);
            filter: blur(0);
            box-shadow: 0 0 16px rgba(225, 29, 72, 0.3), 0 0 28px rgba(217, 119, 6, 0.18);
          }
        }

        /* Subtle Ambient Breathing (Gentle) */
        @keyframes ambientTextPulse {
          0%, 100% {
            filter: drop-shadow(0 0 12px rgba(108, 92, 231, 0.25));
          }
          50% {
            filter: drop-shadow(0 0 18px rgba(108, 92, 231, 0.4)) drop-shadow(0 0 28px rgba(225, 29, 72, 0.25));
          }
        }
      `}</style>

      {/* Cinematic HUD Card Container */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '580px',
          background: 'linear-gradient(150deg, rgba(22, 18, 46, 0.97) 0%, rgba(12, 10, 26, 0.99) 100%)',
          border: '1.5px solid rgba(108, 92, 231, 0.45)',
          borderRadius: '28px',
          padding: '2.8rem 2.2rem',
          textAlign: 'center',
          color: '#FFFFFF',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.8), 0 0 35px rgba(108, 92, 231, 0.2)',
          animation: 'cinematicCardIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards',
          overflow: 'hidden'
        }}
      >
        {/* Soft Ambient Backlight Glow */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: '340px',
          height: '220px',
          background: 'radial-gradient(ellipse at center, rgba(108, 92, 231, 0.28) 0%, rgba(56, 189, 248, 0.1) 50%, transparent 70%)',
          pointerEvents: 'none',
          animation: 'backlightSurge 1.8s ease-out forwards',
          zIndex: 0
        }} />

        {/* Soft Ambient Light Beam */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'linear-gradient(90deg, transparent 0%, rgba(162, 155, 254, 0.12) 50%, transparent 100%)',
          pointerEvents: 'none',
          animation: 'beamSweep 1.2s cubic-bezier(0.2, 0.8, 0.2, 1) 1.2s forwards',
          opacity: 0,
          zIndex: 1
        }} />

        {/* Close Button X */}
        <button
          onClick={handleClose}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: 'rgba(255, 255, 255, 0.06)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            color: '#A29BFE',
            borderRadius: '50%',
            width: '36px',
            height: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            zIndex: 3
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(225, 29, 72, 0.2)';
            e.currentTarget.style.color = '#FFF';
            e.currentTarget.style.transform = 'scale(1.05)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
            e.currentTarget.style.color = '#A29BFE';
            e.currentTarget.style.transform = 'scale(1)';
          }}
          title="Dismiss Welcome"
        >
          <X size={18} />
        </button>

        {/* CINEMATIC MAIN HEADING ENTRANCE */}
        <div style={{
          position: 'relative',
          zIndex: 2,
          margin: '0.8rem 0 1.5rem 0',
          animation: 'ambientTextPulse 3.5s ease-in-out 2.4s infinite alternate'
        }}>
          {/* Line 1: WELCOME TO AI */}
          <div
            style={{
              fontSize: 'clamp(1.05rem, 3.6vw, 1.45rem)',
              fontWeight: 800,
              textTransform: 'uppercase',
              lineHeight: 1.2,
              marginBottom: '0.25rem',
              background: 'linear-gradient(90deg, #93C5FD 0%, #38BDF8 50%, #C084FC 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              animation: 'revealWelcomeAI 0.85s cubic-bezier(0.16, 1, 0.3, 1) 0.35s both'
            }}
          >
            WELCOME TO AI
          </div>

          {/* Line 2: DEATH ARENA (Impact Reveal with Softer Tone) */}
          <h1
            style={{
              fontSize: 'clamp(2.1rem, 6.8vw, 3.2rem)',
              fontWeight: 900,
              lineHeight: 1.05,
              textTransform: 'uppercase',
              margin: 0,
              background: 'linear-gradient(135deg, #F8FAFC 0%, #C084FC 35%, #818CF8 70%, #FB7185 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              animation: 'impactDeathArena 0.9s cubic-bezier(0.2, 0.9, 0.25, 1) 0.95s both'
            }}
          >
            DEATH ARENA
          </h1>

          {/* Divider Light Line */}
          <div style={{
            height: '1.5px',
            width: '75%',
            maxWidth: '220px',
            margin: '1.1rem auto 1.2rem auto',
            background: 'linear-gradient(90deg, transparent, rgba(45, 212, 191, 0.5) 50%, transparent)',
            borderRadius: '999px',
            opacity: 0.7
          }} />

          {/* Line 3: BATTLE GROUND! (Toned Down Energy Banner) */}
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                background: 'linear-gradient(135deg, #E11D48 0%, #BE123C 50%, #D97706 100%)',
                padding: '0.55rem 1.8rem',
                borderRadius: '16px',
                fontWeight: 900,
                fontSize: 'clamp(1.05rem, 3.5vw, 1.4rem)',
                letterSpacing: '2px',
                color: '#FFFFFF',
                textShadow: '0 1px 6px rgba(0,0,0,0.4)',
                textTransform: 'uppercase',
                animation: 'battleGroundEntrance 0.8s cubic-bezier(0.18, 0.9, 0.3, 1) 1.65s both'
              }}
            >
              <Swords size={18} color="#FFFFFF" />
              <span>BATTLE GROUND!</span>
              <Swords size={18} color="#FFFFFF" style={{ transform: 'scaleX(-1)' }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

