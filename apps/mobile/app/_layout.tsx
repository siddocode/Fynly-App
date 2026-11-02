import React, { useEffect } from 'react';
import { LogBox } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../lib/api';
import { AuthProvider } from '../hooks/useAuth';
import { ThemeProvider, useTheme } from '../lib/theme';
import { initNotifications } from '../lib/notificationService';

// Silence standard Expo Go platform advisory notices for notifications
LogBox.ignoreLogs([
  '`expo-notifications` functionality is not fully supported in Expo Go',
  '[expo-notifications] Push notifications (remote notifications) are unavailable in Expo Go',
]);

function AppNavigation() {
  const { theme, isDark } = useTheme();

  useEffect(() => {
    initNotifications();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.background },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="auth"
          options={{
            presentation: 'modal',
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="add-transaction"
          options={{
            presentation: 'modal',
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="create-budget"
          options={{
            presentation: 'modal',
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="notifications"
          options={{
            presentation: 'modal',
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="import-statement"
          options={{
            presentation: 'modal',
            headerShown: false,
          }}
        />
      </Stack>
    </SafeAreaProvider>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <AppNavigation />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
