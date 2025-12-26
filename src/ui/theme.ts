export const theme = {
  colors: {
    background: '#0A0A0A', // Deep black
    surface: '#141414',
    border: 'rgba(255, 255, 255, 0.08)',
    
    focus: {
      primary: '#FF5F57', // Premium sunset orange-red
      glow: 'rgba(255, 95, 87, 0.15)',
    },
    shortBreak: {
      primary: '#28C840', // macOS green
      glow: 'rgba(40, 200, 64, 0.15)',
    },
    longBreak: {
      primary: '#007AFF', // macOS blue
      glow: 'rgba(0, 122, 255, 0.15)',
    },
    
    text: {
      primary: '#FFFFFF',
      secondary: '#999999',
      muted: '#666666',
    },
    
    button: {
      background: 'rgba(255, 255, 255, 0.08)',
      hover: 'rgba(255, 255, 255, 0.12)',
      active: 'rgba(255, 255, 255, 0.18)',
    }
  },
  
  fonts: {
    // Inter for precision and tabular numerals
    display: '"Inter", system-ui, -apple-system, sans-serif',
    // DM Sans for boutique, award-winning branding feel
    brand: '"DM Sans", "Inter", sans-serif',
    mono: '"SF Mono", "JetBrains Mono", monospace',
  },
  
  radii: {
    window: '28px',
    button: '20px',
    pill: '100px',
  }
};
