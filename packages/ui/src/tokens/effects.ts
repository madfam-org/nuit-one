/**
 * Nuit Glass Design System — Effects
 *
 * Liquid Glass surfaces, neon glow halos, and smooth transitions.
 */
export const effects = {
  glass: {
    backdrop: 'blur(16px) saturate(180%)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    shadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
  },

  glow: {
    cyan: '0 0 20px rgba(0, 245, 255, 0.3)',
    magenta: '0 0 20px rgba(255, 0, 229, 0.3)',
    violet: '0 0 20px rgba(139, 92, 246, 0.3)',
  },

  transition: {
    fast: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
    base: '250ms cubic-bezier(0.4, 0, 0.2, 1)',
    slow: '500ms cubic-bezier(0.4, 0, 0.2, 1)',
  },
} as const;

export type Effects = typeof effects;
