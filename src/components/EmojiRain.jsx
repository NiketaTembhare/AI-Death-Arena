import React, { useMemo } from 'react';

const CELEBRATION_EMOJIS = ['🎉', '👏🏻', '👏🏼', '✨', '💸', '🥳', '🎉', '🎊', '🪩'];

export default function EmojiRain({ count = 50 }) {
  const particles = useMemo(() => {
    const items = [];
    for (let i = 0; i < count; i++) {
      const emoji = CELEBRATION_EMOJIS[Math.floor(Math.random() * CELEBRATION_EMOJIS.length)];
      const left = Math.random() * 95; // 0vw to 95vw
      const size = 1.8 + Math.random() * 2.4; // 1.8rem to 4.2rem
      const duration = 2.6 + Math.random() * 3.4; // 2.6s to 6s
      const delay = Math.random() * 4; // 0s to 4s delay
      const drift = -50 + Math.random() * 100; // -50px to +50px horizontal wobble
      const spin = -180 + Math.random() * 360; // rotation angle
      items.push({ id: i, emoji, left, size, duration, delay, drift, spin });
    }
    return items;
  }, [count]);

  return (
    <>
      <style>{`
        @keyframes emojiRainFall {
          0% {
            transform: translateY(-80px) translateX(0px) rotate(0deg);
            opacity: 0;
          }
          12% {
            opacity: 1;
          }
          88% {
            opacity: 1;
          }
          100% {
            transform: translateY(105vh) translateX(var(--drift-x)) rotate(var(--spin-deg));
            opacity: 0;
          }
        }
      `}</style>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 999999,
          overflow: 'hidden'
        }}
      >
        {particles.map((p) => (
          <span
            key={p.id}
            style={{
              position: 'absolute',
              top: 0,
              left: `${p.left}vw`,
              fontSize: `${p.size}rem`,
              animation: `emojiRainFall ${p.duration}s cubic-bezier(0.25, 0.46, 0.45, 0.94) ${p.delay}s infinite`,
              '--drift-x': `${p.drift}px`,
              '--spin-deg': `${p.spin}deg`,
              filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))',
              userSelect: 'none'
            }}
          >
            {p.emoji}
          </span>
        ))}
      </div>
    </>
  );
}
