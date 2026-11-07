import React from 'react';
import { Tabs } from 'expo-router';
import { Platform, View, StyleSheet } from 'react-native';
import {
  LayoutDashboard,
  NotebookPen,
  ReceiptText,
  Target,
  TrendingUp,
  User,
} from 'lucide-react-native';
import { useTheme } from '../../lib/theme';

export default function TabLayout() {
  const { theme, isDark } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: isDark ? '#64748B' : '#94A3B8',
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 88 : 66,
          paddingBottom: Platform.OS === 'ios' ? 28 : 10,
          paddingTop: 8,
          ...(isDark
            ? {
                shadowColor: '#000000',
                shadowOffset: { width: 0, height: -4 },
                shadowOpacity: 0.35,
                shadowRadius: 12,
                elevation: 8,
              }
            : {
                shadowColor: '#0F172A',
                shadowOffset: { width: 0, height: -3 },
                shadowOpacity: 0.04,
                shadowRadius: 6,
                elevation: 4,
              }),
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
          letterSpacing: 0.2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <LayoutDashboard size={size - 2} color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="activity"
        options={{
          title: 'Activity',
          tabBarIcon: ({ color, size }) => <ReceiptText size={size - 2} color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="trackers"
        options={{
          title: 'Tracker',
          tabBarIcon: ({ color, size }) => <NotebookPen size={size - 2} color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="budgets"
        options={{
          title: 'Budgets',
          tabBarIcon: ({ color, size }) => <Target size={size - 2} color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          title: 'Insights',
          tabBarIcon: ({ color, size }) => <TrendingUp size={size - 2} color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <User size={size - 2} color={color as string} />,
        }}
      />
    </Tabs>
  );
}
