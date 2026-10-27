import { QueryClient } from '@tanstack/react-query';
import { Platform } from 'react-native';
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
} from '../types';

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
      retry: 1,
      staleTime: 1000 * 15,
      refetchOnWindowFocus: false,
    },
  },
});

// In-memory token storage (persisted in session)
let authToken: string | null = null;

export const setAuthToken = (token: string | null): void => {
  authToken = token;
};

export const getAuthToken = (): string | null => authToken;

const authHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  return headers;
};

export const formatPaiseToRupees = (paise: string | number | bigint): string => {
  const numeric = typeof paise === 'bigint' ? Number(paise) : Number(paise || 0);
  const rupees = numeric / 100;
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
    return json.data;
  },

  getMe: async () => {
    const res = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: authHeaders(),
    });
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

  // Transactions
  getTransactions: async (params?: {
    search?: string;
    type?: TransactionType;
    accountId?: string;
    categoryId?: string;
    page?: number;
    limit?: number;
  }): Promise<{ transactions: Transaction[]; pagination: { total: number; page: number; totalPages: number } }> => {
    const url = new URL(`${API_BASE_URL}/transactions`);
    if (params?.search) url.searchParams.set('search', params.search);
    if (params?.type) url.searchParams.set('type', params.type);
    if (params?.accountId) url.searchParams.set('accountId', params.accountId);
    if (params?.categoryId) url.searchParams.set('categoryId', params.categoryId);
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
    description: string;
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
    name: string;
    period?: 'DAILY' | 'WEEKLY' | 'MONTHLY';
    limitPaise: number | string;
    categories?: Array<{ categoryId: string; limitPaise: number | string }>;
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

  deleteBudget: async (id: string): Promise<void> => {
    const res = await fetch(`${API_BASE_URL}/budgets/${id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.error?.message || 'Failed to delete budget');
    }
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
};
