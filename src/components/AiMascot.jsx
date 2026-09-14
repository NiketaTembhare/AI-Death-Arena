import React from 'react';

export default function AiMascot({ side = 'left', className = '', style = {}, animated = true }) {
  const isRight = side === 'right';
  const floatAnim = isRight
    ? 'mascotFloatRight 3.6s ease-in-out infinite 0.4s'
    : 'mascotFloatLeft 3.6s ease-in-out infinite';

  return (
    <div
      aria-hidden="true"
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        filter: 'drop-shadow(0 0 8px rgba(129, 140, 248, 0.35)) drop-shadow(0 0 16px rgba(108, 92, 231, 0.25))',
        animation: animated ? floatAnim : 'none',
        transformOrigin: 'center center',
        ...style
      }}
      className={`mascot-animated-float ${className}`}
    >
      <svg
        viewBox="0 0 110 135"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ width: '100%', height: 'auto', overflow: 'visible' }}
      >
        <defs>
          <linearGradient id={`mascotBody_${side}`} x1="0" y1="0" x2="110" y2="135" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#2E1065" />
            <stop offset="50%" stopColor="#1E1B4B" />
            <stop offset="100%" stopColor="#0F172A" />
          </linearGradient>

          <linearGradient id={`mascotHelmet_${side}`} x1="20" y1="15" x2="90" y2="65" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#312E81" />
            <stop offset="100%" stopColor="#0F172A" />
          </linearGradient>

          <linearGradient id={`mascotVisor_${side}`} x1="30" y1="28" x2="80" y2="52" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#090D16" />
            <stop offset="100%" stopColor="#172554" />
          </linearGradient>

          <linearGradient id={`mascotEyeGrad_${side}`} x1="0" y1="0" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#38BDF8" />
            <stop offset="100%" stopColor="#F472B6" />
          </linearGradient>

          <linearGradient id={`mascotCoreGrad_${side}`} x1="45" y1="75" x2="65" y2="95" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#38BDF8" />
            <stop offset="50%" stopColor="#818CF8" />
            <stop offset="100%" stopColor="#F472B6" />
          </linearGradient>

          <linearGradient id={`mascotRingGrad_${side}`} x1="15" y1="120" x2="95" y2="120" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="rgba(56, 189, 248, 0.6)" />
            <stop offset="50%" stopColor="rgba(192, 132, 252, 0.8)" />
            <stop offset="100%" stopColor="rgba(244, 114, 182, 0.6)" />
          </linearGradient>
        </defs>

        {/* Hover / Levitation Aura Base */}
        <ellipse
          cx="55"
          cy="124"
          rx="34"
          ry="7"
          fill={`url(#mascotRingGrad_${side})`}
          opacity="0.5"
          style={{ animation: animated ? 'mascotRingPulse 3.6s ease-in-out infinite' : 'none' }}
          className="mascot-animated-core"
        />
        <ellipse
          cx="55"
          cy="124"
          rx="22"
          ry="4"
          fill="#38BDF8"
          opacity="0.4"
        />

        {/* Floating Thruster Particles */}
        <circle cx="38" cy="116" r="1.5" fill="#38BDF8" opacity="0.6" />
        <circle cx="72" cy="118" r="1.5" fill="#F472B6" opacity="0.6" />
        <circle cx="55" cy="120" r="2" fill="#C084FC" opacity="0.7" />

        {/* Outer Antennae / Ear Sensors */}
        <path d="M 28 36 L 16 26" stroke="#818CF8" strokeWidth="3" strokeLinecap="round" />
        <circle cx="15" cy="25" r="3.5" fill="#38BDF8" />

        <path d="M 82 36 L 94 26" stroke="#818CF8" strokeWidth="3" strokeLinecap="round" />
        <circle cx="95" cy="25" r="3.5" fill="#F472B6" />

        {/* Shoulder Armor */}
        <path
          d="M 20 72 C 16 66, 26 58, 38 64 L 35 78 Z"
          fill="#312E81"
          stroke="#818CF8"
          strokeWidth="1.2"
        />
        <path
          d="M 90 72 C 94 66, 84 58, 72 64 L 75 78 Z"
          fill="#312E81"
          stroke="#818CF8"
          strokeWidth="1.2"
        />

        {/* Main Torso Chassis */}
        <path
          d="M 34 65 L 76 65 L 71 104 C 70 109, 40 109, 39 104 Z"
          fill={`url(#mascotBody_${side})`}
          stroke="#6366F1"
          strokeWidth="1.5"
        />

        {/* Torso Armor Panel Lines */}
        <path d="M 44 65 L 47 100" stroke="rgba(162, 155, 254, 0.25)" strokeWidth="1" />
        <path d="M 66 65 L 63 100" stroke="rgba(162, 155, 254, 0.25)" strokeWidth="1" />
        <path d="M 39 82 L 71 82" stroke="rgba(162, 155, 254, 0.2)" strokeWidth="1" />

        {/* Chest Core Reactor */}
        <path
          d="M 55 76 L 63 84 L 55 92 L 47 84 Z"
          fill={`url(#mascotCoreGrad_${side})`}
          style={{ animation: animated ? 'mascotCorePulse 2.8s ease-in-out infinite' : 'none' }}
          className="mascot-animated-core"
        />

        {/* Robot Hands / Arms stance */}
        <path
          d="M 24 74 Q 18 88 28 96"
          stroke="#818CF8"
          strokeWidth="3.5"
          strokeLinecap="round"
          fill="none"
        />
        <circle cx="29" cy="96" r="3.5" fill="#C084FC" />

        <path
          d="M 86 74 Q 94 86 84 96"
          stroke="#818CF8"
          strokeWidth="3.5"
          strokeLinecap="round"
          fill="none"
        />
        <circle cx="83" cy="96" r="3.5" fill="#38BDF8" />

        {/* Helmet / Head Shell */}
        <path
          d="M 26 42 C 26 22, 84 22, 84 42 C 84 56, 76 64, 55 64 C 34 64, 26 56, 26 42 Z"
          fill={`url(#mascotHelmet_${side})`}
          stroke="#818CF8"
          strokeWidth="1.8"
        />

        {/* Helmet Crest Highlight */}
        <path
          d="M 48 24 L 62 24 L 59 18 L 51 18 Z"
          fill="#38BDF8"
          opacity="0.8"
        />

        {/* Digital Glass Visor Screen */}
        <path
          d="M 31 38 C 31 31, 79 31, 79 38 C 79 50, 72 56, 55 56 C 38 56, 31 50, 31 38 Z"
          fill={`url(#mascotVisor_${side})`}
          stroke="#C084FC"
          strokeWidth="1.2"
        />

        {/* Visor Screen Flare Line */}
        <path
          d="M 35 34 C 45 32, 65 32, 75 34"
          stroke="rgba(255, 255, 255, 0.35)"
          strokeWidth="1"
          strokeLinecap="round"
        />

        {/* Animated Digital Eyes */}
        <g
          style={{
            animation: animated ? 'mascotEyeBlink 4.5s ease-in-out infinite' : 'none',
            transformOrigin: '55px 43px'
          }}
          className="mascot-animated-eye"
        >
          <rect
            x="41"
            y="39"
            width="10"
            height="8"
            rx="3"
            fill={`url(#mascotEyeGrad_${side})`}
          />
          <circle cx="44" cy="41" r="1.2" fill="#FFFFFF" />

          <rect
            x="59"
            y="39"
            width="10"
            height="8"
            rx="3"
            fill={`url(#mascotEyeGrad_${side})`}
          />
          <circle cx="62" cy="41" r="1.2" fill="#FFFFFF" />
        </g>

        {/* Expressive Blush / Cheek Accent */}
        <circle cx="37" cy="48" r="2.5" fill="#F472B6" opacity="0.4" />
        <circle cx="73" cy="48" r="2.5" fill="#F472B6" opacity="0.4" />
      </svg>
    </div>
  );
}
