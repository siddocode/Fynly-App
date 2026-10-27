import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { theme } from '../lib/theme';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: 'default' | 'subtle' | 'accent';
}

export const Card: React.FC<CardProps> = ({ children, style, variant = 'default' }) => {
  const getVariantStyle = () => {
    switch (variant) {
      case 'subtle':
        return styles.subtle;
      case 'accent':
        return styles.accent;
      default:
        return styles.default;
    }
  };

  return <View style={[styles.base, getVariantStyle(), style]}>{children}</View>;
};

const styles = StyleSheet.create({
  base: {
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    borderWidth: 1,
  },
  default: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.surfaceBorder,
  },
  subtle: {
    backgroundColor: theme.colors.surfaceSubtle,
    borderColor: 'transparent',
  },
  accent: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.primary,
  },
});
