export const Colors = {
  light: {
    primary: '#16C79A',
    secondary: '#FF8C42',
    destructive: '#FF6B6B',
    background: '#FFFFFF',
    foreground: '#09090B',
    muted: '#F4F4F5',
    mutedForeground: '#71717A',
    card: '#FFFFFF',
    border: '#E4E4E7',
    // Specific UI uses
    amber: '#F59E0B',
    amberLight: '#FEF3C7',
    amberBorder: '#FCD34D',
    green: '#16A34A',
    greenLight: '#DCFCE7',
    markerActive: '#0f766e',
  },
  dark: {
    primary: '#16C79A',        // intentionally same — brand color preserved in dark mode
    secondary: '#FF8C42',      // intentionally same
    destructive: '#FF6B6B',    // intentionally same
    background: '#09090B',
    foreground: '#FAFAFA',
    muted: '#27272A',
    mutedForeground: '#A1A1AA',
    card: '#09090B',
    border: '#27272A',
    amber: '#F59E0B',
    amberLight: '#2D1F00',
    amberBorder: '#92400E',
    green: '#4ADE80',
    greenLight: '#052E16',
    markerActive: '#0f766e',
  },
} as const;

export type ColorScheme = keyof typeof Colors;
export type ColorTokens = typeof Colors.light;
