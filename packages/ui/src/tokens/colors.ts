/**
 * Nuit Glass Design System — Neon-Noir Color Palette
 *
 * Dark cinematic backgrounds for late-night sessions,
 * highly saturated neon accents, and translucent glass surfaces.
 */
export const colors = {
  background: {
    base: '#0a0a0f',
    surface: '#12121a',
    elevated: '#1a1a2e',
  },

  neon: {
    cyan: '#00f5ff',
    magenta: '#ff00e5',
    violet: '#8b5cf6',
    amber: '#f59e0b',
    green: '#00ff88',
  },

  glass: {
    border: 'rgba(255, 255, 255, 0.08)',
    fill: 'rgba(255, 255, 255, 0.04)',
    highlight: 'rgba(255, 255, 255, 0.12)',
  },

  text: {
    primary: '#f0f0f5',
    secondary: '#a0a0b0',
    muted: '#606070',
  },

  status: {
    success: '#00ff88',
    warning: '#f59e0b',
    error: '#ff3366',
    info: '#00f5ff',
  },
} as const;

export type Colors = typeof colors;
