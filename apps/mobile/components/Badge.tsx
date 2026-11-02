import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../lib/theme';

interface BadgeProps {
  label: string;
  variant?: 'primary' | 'success' | 'warning' | 'error' | 'muted';
}

export const Badge: React.FC<BadgeProps> = ({ label, variant = 'primary' }) => {
  const { theme } = useTheme();

  const getColors = () => {
    switch (variant) {
      case 'success':
        return { bg: theme.colors.incomeBg, text: theme.colors.income };
      case 'warning':
        return { bg: theme.colors.alertAmberBg, text: theme.colors.alertAmber };
      case 'error':
        return { bg: theme.colors.expenseBg, text: theme.colors.expense };
      case 'muted':
        return { bg: theme.colors.surfaceSubtle, text: theme.colors.textMuted };
      default:
        return { bg: theme.colors.primarySubtle, text: theme.colors.primary };
    }
  };

  const colors = getColors();

  return (
    <View
      style={[
        {
          paddingHorizontal: 9,
          paddingVertical: 3.5,
          borderRadius: theme.borderRadius.full,
          alignSelf: 'flex-start',
          backgroundColor: colors.bg,
          borderWidth: 1,
          borderColor: `${colors.text}35`,
          flexShrink: 0,
        },
      ]}
    >
      <Text
        numberOfLines={1}
        style={{
          fontSize: 10.5,
          fontWeight: '700',
          textTransform: 'uppercase',
          letterSpacing: 0.6,
          color: colors.text,
        }}
      >
        {label}
      </Text>
    </View>
  );
};
