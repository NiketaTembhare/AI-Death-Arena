import React from 'react';
import './ArenaBackground.css';

export default function ArenaBackground({ children, className = '' }) {
  return (
    <div className={`arena-bg-container ${className}`}>
      {/* Background Image Layer */}
      <div className="arena-bg-image" />

      {/* Dark glowing gradient overlay for high contrast & UI readability */}
      <div className="arena-bg-overlay" />

      {/* Light particle shimmer layer */}
      <div className="arena-bg-particles" />

      {/* Moving Star Light 1 - Cyan / Blue Sparkle */}
      <div className="star-light star-light-1" aria-hidden="true">
        <div className="star-glow star-glow-cyan" />
        <svg viewBox="0 0 24 24" className="star-svg">
          <path
            d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z"
            fill="url(#starGradCyan)"
          />
          <defs>
            <radialGradient id="starGradCyan" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="40%" stopColor="#74B9FF" />
              <stop offset="100%" stopColor="#0984E3" />
            </radialGradient>
          </defs>
        </svg>
      </div>

      {/* Moving Star Light 2 - Pink / Neon Purple Sparkle */}
      <div className="star-light star-light-2" aria-hidden="true">
        <div className="star-glow star-glow-magenta" />
        <svg viewBox="0 0 24 24" className="star-svg">
          <path
            d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z"
            fill="url(#starGradMagenta)"
          />
          <defs>
            <radialGradient id="starGradMagenta" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="40%" stopColor="#FF7675" />
              <stop offset="100%" stopColor="#A29BFE" />
            </radialGradient>
          </defs>
        </svg>
      </div>

      {/* Main Content Layer */}
      <div className="arena-bg-content">
        {children}
      </div>
    </div>
  );
}
