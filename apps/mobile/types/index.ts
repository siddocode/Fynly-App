export type TransactionType = 'INCOME' | 'EXPENSE' | 'TRANSFER' | 'REFUND';
export type TransactionStatus = 'PENDING' | 'SETTLED' | 'CANCELLED';
export type AccountType = 'SAVINGS' | 'CURRENT' | 'CREDIT_CARD' | 'WALLET' | 'CASH';
export type BudgetPeriod = 'DAILY' | 'WEEKLY' | 'MONTHLY';

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

export interface Budget {
  id: string;
  userId: string;
  name: string;
  period: BudgetPeriod;
  limitPaise: string | number;
  startDate: string;
  endDate?: string | null;
  spentPaise?: string | number;
  alert70Sent: boolean;
  alert90Sent: boolean;
  alert100Sent: boolean;
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
