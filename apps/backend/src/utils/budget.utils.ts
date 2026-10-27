export type BudgetPeriod = 'DAILY' | 'WEEKLY' | 'MONTHLY';

export interface PeriodBoundaries {
  startDate: Date;
  endDate: Date;
  totalDays: number;
  remainingDays: number;
  daysElapsed: number;
}

export const getPeriodBoundaries = (
  period: BudgetPeriod,
  referenceDate: Date = new Date()
): PeriodBoundaries => {
  const ref = new Date(referenceDate);

  if (period === 'DAILY') {
    const startDate = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate(), 0, 0, 0, 0);
    const endDate = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate(), 23, 59, 59, 999);
    return {
      startDate,
      endDate,
      totalDays: 1,
      remainingDays: 1,
      daysElapsed: 1,
    };
  }

  if (period === 'WEEKLY') {
    // Week starting Monday (ISO-8601 style)
    const day = ref.getDay(); // 0 is Sunday, 1 is Monday
    const diffToMonday = day === 0 ? -6 : 1 - day;
    
    const startDate = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() + diffToMonday, 0, 0, 0, 0);
    const endDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + 6, 23, 59, 59, 999);

    const msPerDay = 1000 * 60 * 60 * 24;
    const daysElapsed = Math.min(7, Math.max(1, Math.floor((ref.getTime() - startDate.getTime()) / msPerDay) + 1));
    const remainingDays = Math.max(1, 7 - daysElapsed + 1);

    return {
      startDate,
      endDate,
      totalDays: 7,
      remainingDays,
      daysElapsed,
    };
  }

  // Default: MONTHLY
  const year = ref.getFullYear();
  const month = ref.getMonth(); // 0-indexed

  const startDate = new Date(year, month, 1, 0, 0, 0, 0);
  // Day 0 of next month is the last day of current month
  const lastDayDate = new Date(year, month + 1, 0);
  const totalDays = lastDayDate.getDate();
  const endDate = new Date(year, month, totalDays, 23, 59, 59, 999);

  const currentDay = ref.getDate();
  const daysElapsed = currentDay;
  const remainingDays = Math.max(1, totalDays - currentDay + 1);

  return {
    startDate,
    endDate,
    totalDays,
    remainingDays,
    daysElapsed,
  };
};

export const calculateSafeToSpend = (
  remainingBudgetPaise: bigint,
  remainingDays: number
): bigint => {
  if (remainingBudgetPaise <= 0n || remainingDays <= 0) {
    return 0n;
  }
  return remainingBudgetPaise / BigInt(remainingDays);
};

export type BudgetStatusLevel = 'ON_TRACK' | 'WARNING_70' | 'WARNING_90' | 'EXCEEDED';

export const calculateBudgetUsage = (
  limitPaise: bigint,
  spentPaise: bigint
): {
  usagePercentage: number;
  remainingPaise: bigint;
  status: BudgetStatusLevel;
} => {
  if (limitPaise <= 0n) {
    return {
      usagePercentage: 100,
      remainingPaise: 0n,
      status: 'EXCEEDED',
    };
  }

  const remainingPaise = limitPaise - spentPaise;
  // Calculate percentage using integer multiplication first to avoid premature float rounding
  const usagePercentage = Number((spentPaise * 10000n) / limitPaise) / 100;

  let status: BudgetStatusLevel = 'ON_TRACK';
  if (usagePercentage >= 100) {
    status = 'EXCEEDED';
  } else if (usagePercentage >= 90) {
    status = 'WARNING_90';
  } else if (usagePercentage >= 70) {
    status = 'WARNING_70';
  }

  return {
    usagePercentage,
    remainingPaise,
    status,
  };
};
