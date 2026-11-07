const MS_PER_DAY = 1000 * 60 * 60 * 24;

export interface TrackerTransactionInput {
  amountPaise: bigint | number | string;
  date: Date | string;
}

export interface TrackerDailyBreakdown {
  date: string;
  label: string;
  totalPaise: string;
  count: number;
}

export interface TrackerSummary {
  totalPaise: string;
  expenseCount: number;
  durationDays: number;
  activeDays: number;
  averagePerDayPaise: string;
  averagePerActiveDayPaise: string;
  highestSpendDay: TrackerDailyBreakdown | null;
  firstExpenseDate: string | null;
  lastExpenseDate: string | null;
  dailyBreakdown: TrackerDailyBreakdown[];
}

export const toLocalDateKey = (value: Date | string): string => {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const toStartOfDay = (value: Date | string): Date => {
  const date = new Date(value);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
};

const formatDayLabel = (value: Date | string): string =>
  new Date(value).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
  });

/**
 * Builds a complete summary for a spending tracker session.
 * All monetary values are computed and returned as integer paise strings.
 */
export const buildTrackerSummary = (
  tracker: { startedAt: Date | string; endedAt?: Date | string | null },
  transactions: TrackerTransactionInput[],
  now: Date = new Date()
): TrackerSummary => {
  const start = toStartOfDay(tracker.startedAt);
  const end = toStartOfDay(tracker.endedAt || now);
  const durationDays = Math.max(
    1,
    Math.round((end.getTime() - start.getTime()) / MS_PER_DAY) + 1
  );

  const byDay = new Map<string, { totalPaise: bigint; count: number }>();
  let totalPaise = 0n;

  for (const tx of transactions) {
    const amount = BigInt(tx.amountPaise);
    totalPaise += amount;
    const key = toLocalDateKey(tx.date);
    const bucket = byDay.get(key) || { totalPaise: 0n, count: 0 };
    bucket.totalPaise += amount;
    bucket.count += 1;
    byDay.set(key, bucket);
  }

  const dailyBreakdown: TrackerDailyBreakdown[] = Array.from(byDay.entries())
    .map(([date, bucket]) => ({
      date,
      label: formatDayLabel(`${date}T00:00:00`),
      totalPaise: bucket.totalPaise.toString(),
      count: bucket.count,
    }))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  const activeDays = dailyBreakdown.length;
  const highestSpendDay = dailyBreakdown.reduce<TrackerDailyBreakdown | null>(
    (highest, day) => {
      if (!highest) return day;
      return BigInt(day.totalPaise) > BigInt(highest.totalPaise) ? day : highest;
    },
    null
  );

  const expenseCount = transactions.length;
  const averagePerDayPaise = totalPaise / BigInt(durationDays);
  const averagePerActiveDayPaise =
    activeDays > 0 ? totalPaise / BigInt(activeDays) : 0n;

  return {
    totalPaise: totalPaise.toString(),
    expenseCount,
    durationDays,
    activeDays,
    averagePerDayPaise: averagePerDayPaise.toString(),
    averagePerActiveDayPaise: averagePerActiveDayPaise.toString(),
    highestSpendDay,
    firstExpenseDate:
      dailyBreakdown.length > 0
        ? dailyBreakdown[dailyBreakdown.length - 1].date
        : null,
    lastExpenseDate: dailyBreakdown.length > 0 ? dailyBreakdown[0].date : null,
    dailyBreakdown,
  };
};
