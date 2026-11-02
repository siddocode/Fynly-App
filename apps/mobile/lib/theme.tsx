import React, { createContext, useContext, useState, useEffect } from 'react';
import { Platform } from 'react-native';

export type ThemeMode = 'light' | 'dark';

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceSubtle: string;
  surfaceBorder: string;
  surfaceGlass: string;
  primary: string;
  primaryHover: string;
  primarySubtle: string;
  accent: string;
  accentSubtle: string;
  income: string;
  incomeBg: string;
  expense: string;
  expenseBg: string;
  transfer: string;
  transferBg: string;
  alertAmber: string;
  alertAmberBg: string;
  alertOrange: string;
  alertOrangeBg: string;
  alertRed: string;
  alertRedBg: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textInverse: string;
  success: string;
  warning: string;
  error: string;
  info: string;
  border: string;
  surfaceAlt: string;
  primaryBg: string;
  danger: string;
  dangerBg: string;
  warningBg: string;
}

export interface Theme {
  mode: ThemeMode;
  colors: ThemeColors;
  typography: {
    fontFamilies: { sans: string };
    sizes: {
      xs: number;
      sm: number;
      base: number;
      lg: number;
      xl: number;
      '2xl': number;
      '3xl': number;
      '4xl': number;
    };
    weights: {
      normal: '400';
      medium: '500';
      semibold: '600';
      bold: '700';
      extrabold: '800';
    };
  };
  spacing: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
    '2xl': number;
    '3xl': number;
    '4xl': number;
  };
  borderRadius: {
    sm: number;
    md: number;
    lg: number;
    xl: number;
    full: number;
  };
}

const sharedTokens = {
  typography: {
    fontFamilies: { sans: 'System' },
    sizes: {
      xs: 12,
      sm: 14,
      base: 16,
      lg: 18,
      xl: 20,
      '2xl': 24,
      '3xl': 30,
      '4xl': 38,
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
    sm: 8,
    md: 14,
    lg: 20,
    xl: 28,
    full: 9999,
  },
};

// Platinum Light Theme (Crisp, High-End Minimalist)
export const lightTheme: Theme = {
  mode: 'light',
  ...sharedTokens,
  colors: {
    background: '#F8FAFC',
    surface: '#FFFFFF',
    surfaceSubtle: '#F1F5F9',
    surfaceBorder: 'rgba(15, 23, 42, 0.08)',
    surfaceGlass: 'rgba(255, 255, 255, 0.94)',

    primary: '#059669',
    primaryHover: '#047857',
    primarySubtle: 'rgba(5, 150, 105, 0.10)',

    accent: '#4F46E5',
    accentSubtle: 'rgba(79, 70, 229, 0.10)',

    income: '#059669',
    incomeBg: 'rgba(5, 150, 105, 0.10)',
    expense: '#E11D48',
    expenseBg: 'rgba(225, 29, 72, 0.08)',
    transfer: '#0284C7',
    transferBg: 'rgba(2, 132, 199, 0.08)',

    alertAmber: '#D97706',
    alertAmberBg: 'rgba(217, 119, 6, 0.10)',
    alertOrange: '#EA580C',
    alertOrangeBg: 'rgba(234, 88, 12, 0.10)',
    alertRed: '#DC2626',
    alertRedBg: 'rgba(220, 38, 38, 0.10)',

    textPrimary: '#0F172A',
    textSecondary: '#475569',
    textMuted: '#94A3B8',
    textInverse: '#FFFFFF',

    success: '#059669',
    warning: '#D97706',
    error: '#DC2626',
    info: '#0284C7',

    border: 'rgba(15, 23, 42, 0.08)',
    surfaceAlt: '#F1F5F9',
    primaryBg: 'rgba(5, 150, 105, 0.10)',
    danger: '#DC2626',
    dangerBg: 'rgba(220, 38, 38, 0.08)',
    warningBg: 'rgba(217, 119, 6, 0.08)',
  },
};

// Obsidian Dark Theme (Velvety Luxury Dark)
export const darkTheme: Theme = {
  mode: 'dark',
  ...sharedTokens,
  colors: {
    background: '#070A12',
    surface: '#0F1523',
    surfaceSubtle: '#141C30',
    surfaceBorder: 'rgba(255, 255, 255, 0.08)',
    surfaceGlass: 'rgba(15, 21, 35, 0.90)',

    primary: '#10B981',
    primaryHover: '#059669',
    primarySubtle: 'rgba(16, 185, 129, 0.15)',

    accent: '#6366F1',
    accentSubtle: 'rgba(99, 102, 241, 0.15)',

    income: '#10B981',
    incomeBg: 'rgba(16, 185, 129, 0.14)',
    expense: '#FB7185',
    expenseBg: 'rgba(251, 113, 133, 0.14)',
    transfer: '#38BDF8',
    transferBg: 'rgba(56, 189, 248, 0.14)',

    alertAmber: '#FBBF24',
    alertAmberBg: 'rgba(251, 191, 36, 0.14)',
    alertOrange: '#FB923C',
    alertOrangeBg: 'rgba(251, 146, 60, 0.14)',
    alertRed: '#F87171',
    alertRedBg: 'rgba(248, 113, 113, 0.14)',

    textPrimary: '#FFFFFF',
    textSecondary: '#94A3B8',
    textMuted: '#64748B',
    textInverse: '#070A12',

    success: '#10B981',
    warning: '#FBBF24',
    error: '#F87171',
    info: '#38BDF8',

    border: 'rgba(255, 255, 255, 0.08)',
    surfaceAlt: '#141C30',
    primaryBg: 'rgba(16, 185, 129, 0.14)',
    danger: '#F87171',
    dangerBg: 'rgba(248, 113, 113, 0.14)',
    warningBg: 'rgba(251, 191, 36, 0.14)',
  },
};

// Mutable active theme reference defaulting to Obsidian Dark mode
export let theme: Theme = darkTheme;

interface ThemeContextType {
  mode: ThemeMode;
  theme: Theme;
  isDark: boolean;
  setMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  mode: 'dark',
  theme: darkTheme,
  isDark: true,
  setMode: () => {},
  toggleTheme: () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = window.localStorage.getItem('fynly_theme_mode');
      if (saved === 'dark' || saved === 'light') return saved;
    }
    return 'dark'; // Classy executive dark mode by default
  });

  const activeTheme = mode === 'dark' ? darkTheme : lightTheme;
  theme = activeTheme;

  const setMode = (newMode: ThemeMode) => {
    setModeState(newMode);
    theme = newMode === 'dark' ? darkTheme : lightTheme;
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('fynly_theme_mode', newMode);
    }
  };

  const toggleTheme = () => {
    setMode(mode === 'light' ? 'dark' : 'light');
  };

  return (
    <ThemeContext.Provider
      value={{
        mode,
        theme: activeTheme,
        isDark: mode === 'dark',
        setMode,
        toggleTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
