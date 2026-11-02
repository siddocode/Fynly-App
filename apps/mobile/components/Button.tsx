import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  StyleProp,
} from 'react-native';
import { useTheme } from '../lib/theme';

let globalLastButtonPressTimestamp = 0;

interface ButtonProps {
  title: string;
  onPress: () => void | Promise<any>;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  icon?: React.ReactNode;
  debounceMs?: number;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  style,
  textStyle,
  icon,
  debounceMs = 150,
}) => {
  const { theme, isDark } = useTheme();
  const lastPressRef = React.useRef<number>(0);
  const isExecutingRef = React.useRef<boolean>(false);

  const handlePress = React.useCallback(() => {
    if (disabled || loading) return;

    const now = Date.now();
    // Drop rapid-fire duplicate clicks
    if (
      now - lastPressRef.current < debounceMs ||
      isExecutingRef.current
    ) {
      return;
    }

    lastPressRef.current = now;
    isExecutingRef.current = true;

    try {
      const result = onPress();
      if (result && typeof (result as any).then === 'function') {
        (result as Promise<any>).finally(() => {
          setTimeout(() => {
            isExecutingRef.current = false;
          }, 80);
        });
      } else {
        setTimeout(() => {
          isExecutingRef.current = false;
        }, 80);
      }
    } catch (err) {
      isExecutingRef.current = false;
      throw err;
    }
  }, [disabled, loading, onPress, debounceMs]);

  const getButtonStyles = (): ViewStyle => {
    let paddingVertical = 12;
    let paddingHorizontal = 18;

    if (size === 'sm') {
      paddingVertical = 8;
      paddingHorizontal = 14;
    } else if (size === 'lg') {
      paddingVertical = 15;
      paddingHorizontal = 22;
    }

    let variantStyles: ViewStyle = {
      backgroundColor: theme.colors.primary,
      shadowColor: theme.colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDark ? 0.28 : 0.20,
      shadowRadius: 10,
      elevation: 3,
    };

    if (variant === 'secondary') {
      variantStyles = {
        backgroundColor: theme.colors.surfaceSubtle,
        borderWidth: 1,
        borderColor: theme.colors.border,
      };
    } else if (variant === 'outline') {
      variantStyles = {
        backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(15, 23, 42, 0.02)',
        borderWidth: 1,
        borderColor: theme.colors.border,
      };
    } else if (variant === 'ghost') {
      variantStyles = {
        backgroundColor: 'transparent',
      };
    } else if (variant === 'danger') {
      variantStyles = {
        backgroundColor: theme.colors.danger,
        shadowColor: theme.colors.danger,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 3,
      };
    }

    return {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: theme.borderRadius.md,
      gap: theme.spacing.sm,
      paddingVertical,
      paddingHorizontal,
      ...variantStyles,
      ...(disabled || loading ? { opacity: 0.55 } : {}),
    };
  };

  const getTextColor = (): string => {
    if (variant === 'primary') return isDark ? '#070A12' : '#FFFFFF';
    if (variant === 'danger') return '#FFFFFF';
    if (variant === 'outline') return theme.colors.primary;
    if (variant === 'ghost') return theme.colors.textSecondary;
    return theme.colors.textPrimary;
  };

  return (
    <TouchableOpacity
      activeOpacity={0.82}
      onPress={handlePress}
      disabled={disabled || loading}
      style={[getButtonStyles(), style]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={getTextColor()} />
      ) : (
        <>
          {icon}
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            style={[
              {
                fontSize: size === 'sm' ? 12 : size === 'lg' ? 15 : 13.5,
                fontWeight: '700',
                letterSpacing: -0.2,
                color: getTextColor(),
                flexShrink: 1,
              },
              textStyle,
            ]}
          >
            {title}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
};
