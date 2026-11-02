import { QueryClient } from '@tanstack/react-query';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import {
  ApiResponse,
  HealthStatus,
  Transaction,
  FinancialAccount,
  Category,
  TransactionType,
  Budget,
  DashboardSummary,
  NotificationEvent,
  StatementPreviewSummary,
  StatementPreviewRow,
  InsightsOverview,
  RecurringSubscriptionsResponse,
  SpendingTrendsResponse,
  BankInstitution,
  BankSyncStatus,
} from '../types';

const getBaseUrl = (): string => {
  if (Platform?.OS === 'web') {
    return 'http://localhost:4000/api/v1';
  }

  // Detect dev machine host IP from Expo Go or dev client manifest
  const hostUri =
    Constants.expoConfig?.hostUri ||
    (Constants as any).manifest?.debuggerHost ||
    (Constants as any).manifest2?.extra?.expoGo?.debuggerHost ||
    (Constants as any).linkingUri;

  if (hostUri) {
    const cleaned = String(hostUri).replace(/^[a-z]+:\/\//, '');
    const host = cleaned.split('/')[0].split(':')[0];
    if (host && host !== 'localhost' && host !== '127.0.0.1') {
      return `http://${host}:4000/api/v1`;
    }
  }

  // Android emulator fallback
  if (Platform?.OS === 'android' && !Constants.isDevice) {
    return 'http://10.0.2.2:4000/api/v1';
  }

  // Fallback to active local network IP for physical device
  return 'http://192.168.31.207:4000/api/v1';
};

export const API_BASE_URL = getBaseUrl();

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 15,
      refetchOnWindowFocus: false,
    },
  },
});

// Persistent auth token & refresh token storage
let authToken: string | null = null;
let refreshToken: string | null = null;

const AUTH_TOKEN_KEY = '@fynly_auth_token';
const REFRESH_TOKEN_KEY = '@fynly_refresh_token';

// Synchronously restore tokens on web startup
if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
  try {
    const saved = window.localStorage.getItem(AUTH_TOKEN_KEY);
    if (saved && saved !== 'undefined' && saved !== 'null') {
      authToken = saved;
    }
    const savedRefresh = window.localStorage.getItem(REFRESH_TOKEN_KEY);
    if (savedRefresh && savedRefresh !== 'undefined' && savedRefresh !== 'null') {
      refreshToken = savedRefresh;
    }
  } catch {}
}

export const setAuthToken = (token: string | null): void => {
  authToken = token;
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    try {
      if (token) {
        window.localStorage.setItem(AUTH_TOKEN_KEY, token);
      } else {
        window.localStorage.removeItem(AUTH_TOKEN_KEY);
      }
    } catch {}
  }
};

export const setRefreshToken = (token: string | null): void => {
  refreshToken = token;
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    try {
      if (token) {
        window.localStorage.setItem(REFRESH_TOKEN_KEY, token);
      } else {
        window.localStorage.removeItem(REFRESH_TOKEN_KEY);
      }
    } catch {}
  }
};

export const getAuthToken = (): string | null => authToken;
export const getRefreshToken = (): string | null => refreshToken;

const authHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  return headers;
};

let refreshPromise: Promise<{ accessToken: string; refreshToken: string }> | null = null;

export const fetchWithAuth = async (url: string, options: RequestInit = {}): Promise<Response> => {
  const headers = {
    ...authHeaders(),
    ...((options.headers as Record<string, string>) || {}),
  };

  let res = await fetch(url, { ...options, headers });

  // If 401 and we have a refreshToken, attempt silent refresh & retry once
  if (res.status === 401 && refreshToken) {
    try {
      if (!refreshPromise) {
        refreshPromise = api.refreshSession().finally(() => {
          refreshPromise = null;
        });
      }
      const newTokens = await refreshPromise;
      if (newTokens?.accessToken) {
        const retryHeaders = {
          ...headers,
          Authorization: `Bearer ${newTokens.accessToken}`,
        };
        res = await fetch(url, { ...options, headers: retryHeaders });
      }
    } catch {
      // Refresh failed
    }
  }

  return res;
};

export const formatPaiseToRupees = (paise: string | number | bigint | null | undefined): string => {
  if (paise === null || paise === undefined) return '₹0.00';
  const numeric = typeof paise === 'bigint' ? Number(paise) : Number(paise || 0);
  const safeNumeric = isNaN(numeric) ? 0 : numeric;
  const rupees = safeNumeric / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(rupees);
};

export const rupeesToPaise = (rupees: string | number): number => {
  const num = typeof rupees === 'string' ? parseFloat(rupees.replace(/[^0-9.]/g, '')) || 0 : rupees;
  return Math.round(num * 100);
};

export const api = {
  // Health
  getHealth: async (): Promise<HealthStatus> => {
    const res = await fetch(`${API_BASE_URL}/health`);
    const json: ApiResponse<HealthStatus> = await res.json();
    if (!json.success || !json.data) {
      throw new Error(json.error?.message || 'Failed to fetch health status');
    }
    return json.data;
  },

  // Auth
  register: async (payload: {
    email: string;
    password: string;
    name: string;
    currency?: string;
  }) => {
    const res = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.error?.message || 'Registration failed');
    }
    if (json.data?.tokens?.accessToken) {
      setAuthToken(json.data.tokens.accessToken);
    }
    if (json.data?.tokens?.refreshToken) {
      setRefreshToken(json.data.tokens.refreshToken);
    }
    return json.data;
  },

  login: async (payload: { email: string; password: string }) => {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.error?.message || 'Login failed');
    }
    if (json.data?.tokens?.accessToken) {
      setAuthToken(json.data.tokens.accessToken);
    }
    if (json.data?.tokens?.refreshToken) {
      setRefreshToken(json.data.tokens.refreshToken);
    }
    return json.data;
  },

  sendOtp: async (payload: { email: string; purpose: 'REGISTER' | 'LOGIN' }) => {
    const res = await fetch(`${API_BASE_URL}/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.error?.message || 'Failed to send verification code');
    }
    return json;
  },

  verifyOtp: async (payload: {
    email: string;
    otp: string;
    purpose: 'REGISTER' | 'LOGIN';
    name?: string;
  }) => {
    const res = await fetch(`${API_BASE_URL}/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.error?.message || 'Verification failed');
    }
    if (json.data?.tokens?.accessToken) {
      setAuthToken(json.data.tokens.accessToken);
    }
    if (json.data?.tokens?.refreshToken) {
      setRefreshToken(json.data.tokens.refreshToken);
    }
    return json.data;
  },

  refreshSession: async (tokenToUse?: string): Promise<{ accessToken: string; refreshToken: string }> => {
    const token = tokenToUse || refreshToken;
    if (!token) {
      throw new Error('No refresh token available');
    }
    const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: token }),
    });
    const json = await res.json();
    if (!res.ok || !json.success || !json.data?.tokens) {
      throw new Error(json.error?.message || 'Failed to refresh token');
    }
    const newTokens = json.data.tokens;
    setAuthToken(newTokens.accessToken);
    if (newTokens.refreshToken) {
      setRefreshToken(newTokens.refreshToken);
    }
    return newTokens;
  },

  getMe: async () => {
    const res = await fetchWithAuth(`${API_BASE_URL}/auth/me`);
    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.error?.message || 'Failed to fetch user profile');
    }
    return json.data;
  },

  // Accounts
  getAccounts: async (): Promise<FinancialAccount[]> => {
    const res = await fetch(`${API_BASE_URL}/accounts`, {
      headers: authHeaders(),
    });
    const json: ApiResponse<FinancialAccount[]> = await res.json();
    if (!res.ok || !json.success || !json.data) {
      throw new Error(json.error?.message || 'Failed to fetch accounts');
    }
    return json.data;
  },

  createAccount: async (payload: {
    name: string;
    type?: string;
    initialBalancePaise?: number;
    currency?: string;
  }): Promise<FinancialAccount> => {
    const res = await fetch(`${API_BASE_URL}/accounts`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    const json: ApiResponse<FinancialAccount> = await res.json();
    if (!res.ok || !json.success || !json.data) {
      throw new Error(json.error?.message || 'Failed to create account');
    }
    return json.data;
  },

  // Categories
  getCategories: async (): Promise<Category[]> => {
    const res = await fetch(`${API_BASE_URL}/categories`, {
      headers: authHeaders(),
    });
    const json: ApiResponse<Category[]> = await res.json();
    if (!res.ok || !json.success || !json.data) {
      throw new Error(json.error?.message || 'Failed to fetch categories');
    }
    return json.data;
  },

  createCategory: async (data: {
    name: string;
    color?: string;
    icon?: string;
    limitPaise?: number | string;
  }): Promise<Category> => {
    const res = await fetch(`${API_BASE_URL}/categories`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(data),
    });
    const json: ApiResponse<Category> = await res.json();
    if (!res.ok || !json.success || !json.data) {
      throw new Error(json.error?.message || 'Failed to create category');
    }
    return json.data;
  },

  deleteCategory: async (id: string): Promise<void> => {
    const res = await fetch(`${API_BASE_URL}/categories/${id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    const json: ApiResponse<any> = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.error?.message || 'Failed to delete category');
    }
  },

  // Transactions
  getTransactions: async (params?: {
    search?: string;
    type?: TransactionType;
    accountId?: string;
    categoryId?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }): Promise<{ transactions: Transaction[]; pagination: { total: number; page: number; totalPages: number } }> => {
    const url = new URL(`${API_BASE_URL}/transactions`);
    if (params?.search) url.searchParams.set('search', params.search);
    if (params?.type) url.searchParams.set('type', params.type);
    if (params?.accountId) url.searchParams.set('accountId', params.accountId);
    if (params?.categoryId) url.searchParams.set('categoryId', params.categoryId);
    if (params?.startDate) url.searchParams.set('startDate', params.startDate);
    if (params?.endDate) url.searchParams.set('endDate', params.endDate);
    if (params?.page) url.searchParams.set('page', params.page.toString());
    if (params?.limit) url.searchParams.set('limit', params.limit.toString());

    const res = await fetch(url.toString(), {
      headers: authHeaders(),
    });
    const json = await res.json();
    if (!res.ok || !json.success || !json.data) {
      throw new Error(json.error?.message || 'Failed to fetch transactions');
    }
    return json.data;
  },

  createTransaction: async (payload: {
    accountId: string;
    toAccountId?: string;
    categoryId?: string;
    type: TransactionType;
    amountPaise: number | string;
    date?: string;
    description?: string;
    merchantName?: string;
    notes?: string;
    allowDuplicate?: boolean;
  }): Promise<Transaction> => {
    const res = await fetch(`${API_BASE_URL}/transactions`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      const error: any = new Error(json.error?.message || 'Failed to create transaction');
      error.status = res.status;
      error.details = json.error?.details;
      throw error;
    }
    return json.data;
  },

  deleteTransaction: async (id: string): Promise<void> => {
    const res = await fetch(`${API_BASE_URL}/transactions/${id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.error?.message || 'Failed to delete transaction');
    }
  },

  clearTransactionHistory: async (resetBalances: boolean = true): Promise<void> => {
    const res = await fetch(
      `${API_BASE_URL}/transactions/history/clear?resetBalances=${resetBalances}`,
      {
        method: 'DELETE',
        headers: authHeaders(),
      }
    );
    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.error?.message || 'Failed to clear transaction history');
    }
  },

  // Budgets
  getBudgets: async (): Promise<Budget[]> => {
    const res = await fetch(`${API_BASE_URL}/budgets`, {
      headers: authHeaders(),
    });
    const json: ApiResponse<Budget[]> = await res.json();
    if (!res.ok || !json.success || !json.data) {
      throw new Error(json.error?.message || 'Failed to fetch budgets');
    }
    return json.data;
  },

  createBudget: async (payload: {
    id?: string;
    name: string;
    period?: 'DAILY' | 'WEEKLY' | 'MONTHLY';
    startDate?: string;
    endDate?: string;
    month?: number;
    year?: number;
    limitPaise: number | string;
    dailyLimitPaise?: number | string | null;
    weeklyLimitPaise?: number | string | null;
    categories?: Array<{ categoryId: string; limitPaise: number | string }>;
    setActive?: boolean;
  }): Promise<Budget> => {
    const res = await fetch(`${API_BASE_URL}/budgets`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    const json: ApiResponse<Budget> = await res.json();
    if (!res.ok || !json.success || !json.data) {
      throw new Error(json.error?.message || 'Failed to save budget');
    }
    return json.data;
  },

  activateBudget: async (id: string): Promise<void> => {
    const res = await fetch(`${API_BASE_URL}/budgets/${id}/activate`, {
      method: 'PATCH',
      headers: authHeaders(),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.error?.message || 'Failed to activate budget plan');
    }
  },

  deleteBudget: async (id: string, options?: { clearTransactions?: boolean }): Promise<void> => {
    let url = `${API_BASE_URL}/budgets/${id}`;
    if (options?.clearTransactions) {
      url += '?clearTransactions=true';
    }
    const res = await fetch(url, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.error?.message || 'Failed to delete budget');
    }
  },

  clearMonthTransactions: async (month: number, year: number): Promise<{ count: number }> => {
    const res = await fetch(`${API_BASE_URL}/transactions/history/clear?month=${month}&year=${year}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.error?.message || 'Failed to clear month transactions');
    }
    return json.data;
  },

  // Dashboard Summary
  getDashboardSummary: async (): Promise<DashboardSummary> => {
    const res = await fetch(`${API_BASE_URL}/dashboard/summary`, {
      headers: authHeaders(),
    });
    const json: ApiResponse<DashboardSummary> = await res.json();
    if (!res.ok || !json.success || !json.data) {
      throw new Error(json.error?.message || 'Failed to fetch dashboard summary');
    }
    return json.data;
  },

  // Notifications
  getNotifications: async (): Promise<{ notifications: NotificationEvent[]; unreadCount: number }> => {
    const res = await fetch(`${API_BASE_URL}/notifications`, {
      headers: authHeaders(),
    });
    const json = await res.json();
    if (!res.ok || !json.success || !json.data) {
      throw new Error(json.error?.message || 'Failed to fetch notifications');
    }
    return json.data;
  },

  markNotificationAsRead: async (id: string): Promise<void> => {
    const res = await fetch(`${API_BASE_URL}/notifications/${id}/read`, {
      method: 'PATCH',
      headers: authHeaders(),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.error?.message || 'Failed to update notification');
    }
  },

  clearNotifications: async (): Promise<void> => {
    const res = await fetch(`${API_BASE_URL}/notifications/read`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.error?.message || 'Failed to clear notifications');
    }
  },

  // Statements
  previewStatement: async (payload: {
    accountId: string;
    csvContent: string;
  }): Promise<{ summary: StatementPreviewSummary; rows: StatementPreviewRow[] }> => {
    const res = await fetch(`${API_BASE_URL}/statements/preview`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok || !json.success || !json.data) {
      throw new Error(json.error?.message || 'Failed to parse statement preview');
    }
    return json.data;
  },

  importStatement: async (payload: {
    accountId: string;
    transactions: any[];
  }): Promise<{ importedCount: number; skippedCount: number; newBalancePaise: string; alertsTriggeredCount: number }> => {
    const res = await fetch(`${API_BASE_URL}/statements/import`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok || !json.success || !json.data) {
      throw new Error(json.error?.message || 'Failed to import statement transactions');
    }
    return json.data;
  },

  // Analytics & Insights
  getInsightsOverview: async (month?: string): Promise<InsightsOverview> => {
    const url = month
      ? `${API_BASE_URL}/analytics/overview?month=${encodeURIComponent(month)}`
      : `${API_BASE_URL}/analytics/overview`;
    const res = await fetch(url, {
      method: 'GET',
      headers: authHeaders(),
    });
    const json = await res.json();
    if (!res.ok || !json.success || !json.data) {
      throw new Error(json.error?.message || 'Failed to fetch insights overview');
    }
    return json.data;
  },

  getRecurringSubscriptions: async (): Promise<RecurringSubscriptionsResponse> => {
    const res = await fetch(`${API_BASE_URL}/analytics/recurring`, {
      method: 'GET',
      headers: authHeaders(),
    });
    const json = await res.json();
    if (!res.ok || !json.success || !json.data) {
      throw new Error(json.error?.message || 'Failed to fetch recurring subscriptions');
    }
    return json.data;
  },

  getSpendingTrends: async (): Promise<SpendingTrendsResponse> => {
    const res = await fetch(`${API_BASE_URL}/analytics/trends`, {
      method: 'GET',
      headers: authHeaders(),
    });
    const json = await res.json();
    if (!res.ok || !json.success || !json.data) {
      throw new Error(json.error?.message || 'Failed to fetch spending trends');
    }
    return json.data;
  },

  // Bank Connectivity
  getBankSyncProviders: async (): Promise<{ institutions: BankInstitution[] }> => {
    const res = await fetch(`${API_BASE_URL}/bank-sync/providers`, {
      method: 'GET',
      headers: authHeaders(),
    });
    const json = await res.json();
    if (!res.ok || !json.success || !json.data) {
      throw new Error(json.error?.message || 'Failed to fetch bank sync providers');
    }
    return json.data;
  },

  getBankSyncStatus: async (): Promise<BankSyncStatus> => {
    const res = await fetch(`${API_BASE_URL}/bank-sync/status`, {
      method: 'GET',
      headers: authHeaders(),
    });
    const json = await res.json();
    if (!res.ok || !json.success || !json.data) {
      throw new Error(json.error?.message || 'Failed to fetch bank sync status');
    }
    return json.data;
  },
};
