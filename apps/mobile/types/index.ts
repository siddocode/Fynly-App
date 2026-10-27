export type TransactionType = 'INCOME' | 'EXPENSE' | 'TRANSFER' | 'REFUND';
export type TransactionStatus = 'PENDING' | 'SETTLED' | 'CANCELLED';
export type AccountType = 'SAVINGS' | 'CURRENT' | 'CREDIT_CARD' | 'WALLET' | 'CASH';
export type BudgetPeriod = 'DAILY' | 'WEEKLY' | 'MONTHLY';
export type BudgetStatusLevel = 'ON_TRACK' | 'WARNING_70' | 'WARNING_90' | 'EXCEEDED';

export interface FinancialAccount {
  id: string;
  userId: string;
  name: string;
  type: AccountType;
  balancePaise: string | number;
  currency: string;
  color?: string;
  icon?: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  userId?: string | null;
  name: string;
  slug: string;
  icon?: string;
  color?: string;
  isDefault: boolean;
}

export interface Transaction {
  id: string;
  userId: string;
  accountId: string;
  categoryId?: string | null;
  type: TransactionType;
  status: TransactionStatus;
  amountPaise: string | number;
  date: string;
  description: string;
  merchantName?: string | null;
  notes?: string | null;
  fingerprintHash?: string | null;
  referenceNumber?: string | null;
  isRecurring: boolean;
  createdAt: string;
  updatedAt: string;
  account?: FinancialAccount;
  category?: Category | null;
}

export interface BudgetCategoryItem {
  id: string;
  categoryId: string;
  category: Category;
  limitPaise: string | number;
  spentPaise: string | number;
  remainingPaise: string | number;
  usagePercentage: number;
  status: BudgetStatusLevel;
}

export interface Budget {
  id: string;
  name: string;
  period: BudgetPeriod;
  limitPaise: string | number;
  spentPaise: string | number;
  remainingPaise: string | number;
  usagePercentage: number;
  status: BudgetStatusLevel;
  safeToSpendTodayPaise: string | number;
  periodDetails: {
    startDate: string;
    endDate: string;
    totalDays: number;
    remainingDays: number;
    daysElapsed: number;
  };
  categories: BudgetCategoryItem[];
}

export interface DashboardSummary {
  totalBalancePaise: string;
  todaySpentPaise: string;
  monthSpentPaise: string;
  safeToSpendTodayPaise: string;
  budget?: {
    id: string;
    name: string;
    limitPaise: string;
    spentPaise: string;
    remainingPaise: string;
    usagePercentage: number;
    status: BudgetStatusLevel;
    remainingDays: number;
    daysElapsed: number;
    totalDays: number;
  } | null;
  topCategories: Array<{
    id: string;
    name: string;
    color?: string | null;
    icon?: string | null;
    spentPaise: string;
    percentage: number;
  }>;
  accountsCount: number;
  recentTransactions: Transaction[];
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    details?: unknown;
    issues?: Array<{ path: string; message: string }>;
  };
}

export interface HealthStatus {
  status: string;
  service: string;
  timestamp: string;
  uptimeSeconds: number;
  environment: string;
}
