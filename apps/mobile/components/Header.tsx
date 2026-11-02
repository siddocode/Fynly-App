import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../lib/theme';
import { Sun, Moon } from 'lucide-react-native';

interface HeaderProps {
  title: string;
  subtitle?: string;
  rightElement?: React.ReactNode;
  hideThemeToggle?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  rightElement,
  hideThemeToggle = false,
}) => {
  const { theme, mode, toggleTheme } = useTheme();

  return (
    <View style={styles.container}>
      <View style={styles.textContainer}>
        <Text style={[styles.title, { color: theme.colors.textPrimary }]} numberOfLines={1} adjustsFontSizeToFit>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View style={styles.rightActions}>
        {!hideThemeToggle && (
          <TouchableOpacity
            onPress={toggleTheme}
            style={[
              styles.themeToggleBtn,
              {
                backgroundColor: theme.colors.surfaceAlt,
                borderColor: theme.colors.border,
              },
            ]}
            accessibilityLabel={`Switch to ${mode === 'light' ? 'dark' : 'normal'} mode`}
            accessibilityRole="button"
          >
            {mode === 'light' ? (
              <Moon size={18} color={theme.colors.textPrimary} />
            ) : (
              <Sun size={18} color={theme.colors.warning} />
            )}
          </TouchableOpacity>
        )}
        {rightElement ? <View style={styles.right}>{rightElement}</View> : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.7,
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
    letterSpacing: -0.1,
    fontWeight: '500',
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  themeToggleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  right: {
    marginLeft: 4,
  },
});

