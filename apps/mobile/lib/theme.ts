export const theme = {
  colors: {
    // Backgrounds
    background: '#090D16',       // Deep midnight black
    surface: '#111726',          // Dark card surface
    surfaceSubtle: '#182032',    // Subtle surface / input bg
    surfaceBorder: '#232D42',    // Clean card border
    surfaceGlass: 'rgba(17, 23, 38, 0.85)',

    // Accents & Brand
    primary: '#10B981',          // Emerald green (Fynly signature)
    primaryHover: '#059669',
    primarySubtle: 'rgba(16, 185, 129, 0.12)',
    
    accent: '#6366F1',           // Indigo
    accentSubtle: 'rgba(99, 102, 241, 0.12)',

    // Financial semantics
    income: '#10B981',           // Emerald
    incomeBg: 'rgba(16, 185, 129, 0.1)',
    expense: '#F43F5E',          // Rose crimson
    expenseBg: 'rgba(244, 63, 94, 0.1)',
    transfer: '#38BDF8',         // Sky blue
    transferBg: 'rgba(56, 189, 248, 0.1)',

    // Budget Threshold Alerts
    alertAmber: '#F59E0B',       // 70%
    alertAmberBg: 'rgba(245, 158, 11, 0.12)',
    alertOrange: '#FB923C',      // 90%
    alertOrangeBg: 'rgba(251, 146, 60, 0.12)',
    alertRed: '#EF4444',         // 100%
    alertRedBg: 'rgba(239, 68, 68, 0.12)',

    // Text & Foreground
    textPrimary: '#F8FAFC',
    textSecondary: '#94A3B8',
    textMuted: '#64748B',
    textInverse: '#090D16',

    // Status
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#38BDF8',
  },
  typography: {
    fontFamilies: {
      sans: 'System',
    },
    sizes: {
      xs: 12,
      sm: 14,
      base: 16,
      lg: 18,
      xl: 20,
      '2xl': 24,
      '3xl': 30,
      '4xl': 36,
    },
    weights: {
      normal: '400' as const,
      medium: '500' as const,
      semibold: '600' as const,
      bold: '700' as const,
      extrabold: '800' as const,
    },
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    '2xl': 24,
    '3xl': 32,
    '4xl': 40,
  },
  borderRadius: {
    sm: 6,
    md: 10,
    lg: 16,
    xl: 24,
    full: 9999,
  },
};
