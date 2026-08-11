import React from 'react';

interface CircularProgressProps {
  progress: number; // 0 to 1
  color: string;
  size?: number;
  strokeWidth?: number;
}

/**
 * Circular progress designed for low-frequency updates with a short CSS tween.
 */
const CircularProgress: React.FC<CircularProgressProps> = ({ 
  progress, 
  color, 
  size = 280, 
  strokeWidth = 4 
}) => {
  const radius = (size - 20) / 2; // Extra padding for glow
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - progress * circumference;

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ transform: 'rotate(-90deg)', overflow: 'visible' }}
      >
        {/* Background track (subtle) */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255, 255, 255, 0.03)"
          strokeWidth={strokeWidth}
        />
        
        {/* Glow layer - Sharp but luminous */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth + 1}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ 
            filter: 'blur(4px)',
            opacity: 0.3,
            transition: 'stroke-dashoffset 250ms linear',
          }}
        />

        {/* Primary progress ring (razor sharp) */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ 
            transition: 'stroke-dashoffset 250ms linear',
          }}
        />
      </svg>
    </div>
  );
};

export default CircularProgress;
