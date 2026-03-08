/**
 * Nuit Glass Design System — Animation Presets
 *
 * Keyframe definitions and durations for common UI motions.
 * Import these strings into component styles or inject them
 * into a global stylesheet.
 */
export const animations = {
  fadeIn: {
    keyframes: `@keyframes nuit-fade-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}`,
    duration: '300ms',
    easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
    name: 'nuit-fade-in',
  },

  slideUp: {
    keyframes: `@keyframes nuit-slide-up {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}`,
    duration: '350ms',
    easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
    name: 'nuit-slide-up',
  },

  pulseGlow: {
    keyframes: `@keyframes nuit-pulse-glow {
  0%, 100% { box-shadow: 0 0 12px rgba(0, 245, 255, 0.2); }
  50%      { box-shadow: 0 0 24px rgba(0, 245, 255, 0.45); }
}`,
    duration: '2s',
    easing: 'ease-in-out',
    name: 'nuit-pulse-glow',
  },

  shimmer: {
    keyframes: `@keyframes nuit-shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}`,
    duration: '2.5s',
    easing: 'linear',
    name: 'nuit-shimmer',
  },
} as const;

export type Animations = typeof animations;
