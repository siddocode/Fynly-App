import { QueryClient } from '@tanstack/react-query';
import { Platform } from 'react-native';
import { ApiResponse, HealthStatus } from '../types';

// In development, Android emulator connects to host at 10.0.2.2, iOS simulator/web at localhost
const getBaseUrl = (): string => {
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:4000/api/v1';
  }
  return 'http://localhost:4000/api/v1';
};

export const API_BASE_URL = getBaseUrl();

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 1000 * 30, // 30 seconds
      refetchOnWindowFocus: false,
    },
  },
});

export const formatPaiseToRupees = (paise: string | number | bigint): string => {
  const numeric = typeof paise === 'bigint' ? Number(paise) : Number(paise || 0);
  const rupees = numeric / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(rupees);
};

export const api = {
  getHealth: async (): Promise<HealthStatus> => {
    const res = await fetch(`${API_BASE_URL}/health`);
    const json: ApiResponse<HealthStatus> = await res.json();
    if (!json.success || !json.data) {
      throw new Error(json.error?.message || 'Failed to fetch health status');
    }
    return json.data;
  },
};
