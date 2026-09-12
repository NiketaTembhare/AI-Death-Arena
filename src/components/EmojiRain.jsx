import React, { useMemo } from 'react';

const EMOJI_LIST = ['👏🏻', '👏🏼', '✨', '💸', '🥳', '🎉', '🎊', '🪩'];

export default function EmojiRain({ count = 60 }) {
  const particles = useMemo(() => {
    return Array.from({ length: count }).map((_, i) => {
      const emoji = EMOJI_LIST[i % EMOJI_LIST.length];
      const left = Math.random() * 100;
      const delay = Math.random() * 5;
      const duration = 3 + Math.random() * 4;
      const size = 1.5 + Math.random() * 2.0; // rem
      const opacity = 0.7 + Math.random() * 0.3;

      return {
        id: i,
        emoji,
        left: `${left}%`,
        delay: `${delay}s`,
        duration: `${duration}s`,
        size: `${size}rem`,
        opacity
      };
    });
  }, [count]);

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 999,
        overflow: 'hidden'
      }}
    >
      <style>{`
        @keyframes emojiFall {
          0% {
            transform: translateY(-50px) rotate(0deg);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          90% {
            opacity: 1;
          }
          100% {
            transform: translateY(105vh) rotate(360deg);
            opacity: 0;
          }
        }
      `}</style>
      {particles.map((p) => (
        <span
          key={p.id}
          style={{
            position: 'absolute',
            left: p.left,
            top: 0,
            fontSize: p.size,
            opacity: p.opacity,
            animation: `emojiFall ${p.duration} linear infinite`,
            animationDelay: p.delay,
            willChange: 'transform, opacity'
          }}
        >
          {p.emoji}
        </span>
      ))}
    </div>
  );
}
