import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp, Platform } from 'react-native';
import { useTheme } from '../lib/theme';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: 'default' | 'subtle' | 'accent' | 'glass';
}

export const Card: React.FC<CardProps> = ({ children, style, variant = 'default' }) => {
  const { theme, isDark } = useTheme();

  const getVariantStyle = (): ViewStyle => {
    switch (variant) {
      case 'subtle':
        return {
          backgroundColor: theme.colors.surfaceSubtle,
          borderColor: theme.colors.border,
        };
      case 'accent':
        return {
          backgroundColor: isDark ? 'rgba(16, 185, 129, 0.06)' : 'rgba(5, 150, 105, 0.04)',
          borderColor: theme.colors.primary,
        };
      case 'glass':
        return {
          backgroundColor: theme.colors.surfaceGlass,
          borderColor: theme.colors.border,
          ...(isDark
            ? {
                shadowColor: '#000000',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.35,
                shadowRadius: 16,
                elevation: 4,
              }
            : {
                shadowColor: '#0F172A',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.06,
                shadowRadius: 10,
                elevation: 2,
              }),
        };
      default:
        return {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.surfaceBorder,
          ...(isDark
            ? {
                shadowColor: '#000000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.28,
                shadowRadius: 12,
                elevation: 3,
              }
            : {
                shadowColor: '#0F172A',
                shadowOffset: { width: 0, height: 3 },
                shadowOpacity: 0.05,
                shadowRadius: 8,
                elevation: 2,
              }),
        };
    }
  };

  return (
    <View
      style={[
        {
          borderRadius: theme.borderRadius.lg,
          padding: theme.spacing.lg,
          borderWidth: 1,
        },
        getVariantStyle(),
        style,
      ]}
    >
      {children}
    </View>
  );
};
