import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Keyboard,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  X,
  Target,
  SlidersHorizontal,
  Plus,
  ShieldCheck,
  AlertCircle,
  TrendingDown,
  Calendar,
  Layers,
  RotateCcw,
  Trash2,
  Check,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Sparkles,
} from 'lucide-react-native';
import { Modal } from 'react-native';
import { api, rupeesToPaise, formatPaiseToRupees } from '../lib/api';
import { useTheme, Theme } from '../lib/theme';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { CategoryManagerModal } from '../components/CategoryManagerModal';
import { BudgetPeriod } from '../types';
import { useSafeRouter } from '../hooks/useSafeRouter';

const getBudgetFormSignature = (b: any): string =>
  JSON.stringify([
    b.id,
    b.baseLimitPaise !== undefined && b.baseLimitPaise !== null ? b.baseLimitPaise : b.limitPaise || '0',
    b.name || '',
    b.periodDetails?.startDate || '',
    [...(b.categories || [])]
      .map((c: any) => [c.categoryId, String(c.limitPaise)])
      .sort((a: any[], c: any[]) => String(a[0]).localeCompare(String(c[0]))),
  ]);

export default function CreateBudgetScreen() {
  const router = useSafeRouter();
  const searchParams = useLocalSearchParams<{ reset?: string; budgetId?: string }>();
  const isResetMode = String(searchParams.reset) === 'true';

  const queryClient = useQueryClient();
  const scrollViewRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const nameInputRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const categoryInputRefs = useRef<Record<string, React.ComponentRef<typeof TextInput> | null>>({});
  const isDismissedRef = useRef(false);

  const safeDismiss = React.useCallback(() => {
    if (isDismissedRef.current) return;
    isDismissedRef.current = true;
    if (typeof router.canGoBack === 'function' && router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/budgets');
    }
  }, [router]);

  const scrollToOffset = (y: number) => {
    scrollViewRef.current?.scrollTo({ y, animated: true });
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({ y, animated: true });
    }, 150);
  };

  const { theme } = useTheme();
  const styles = React.useMemo(() => getStyles(theme), [theme]);

  // Fetch existing budgets to detect edit/replace mode
  const { data: budgets } = useQuery({
    queryKey: ['budgets'],
    queryFn: api.getBudgets,
  });

  const existingBudget = React.useMemo(() => {
    if (isResetMode || !budgets || budgets.length === 0) return null;
    if (searchParams.budgetId) {
      return budgets.find((b) => b.id === searchParams.budgetId) || null;
    }
    return null;
  }, [budgets, isResetMode, searchParams.budgetId]);

  const ALL_MONTHS = [
    { month: 1, short: 'Jan', full: 'January' },
    { month: 2, short: 'Feb', full: 'February' },
    { month: 3, short: 'Mar', full: 'March' },
    { month: 4, short: 'Apr', full: 'April' },
    { month: 5, short: 'May', full: 'May' },
    { month: 6, short: 'Jun', full: 'June' },
    { month: 7, short: 'Jul', full: 'July' },
    { month: 8, short: 'Aug', full: 'August' },
    { month: 9, short: 'Sep', full: 'September' },
    { month: 10, short: 'Oct', full: 'October' },
    { month: 11, short: 'Nov', full: 'November' },
    { month: 12, short: 'Dec', full: 'December' },
  ];

  // Dynamic Month Options (Default upcoming 4 months)
  const defaultMonthOptions = React.useMemo(() => {
    const list = [];
    const now = new Date();
    for (let i = 0; i < 4; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const mName = d.toLocaleString('en-IN', { month: 'short' });
      const fullMName = d.toLocaleString('en-IN', { month: 'long' });
      const y = d.getFullYear();
      list.push({
        label: `${mName} ${y}`,
        fullLabel: `${fullMName} ${y}`,
        defaultName: `${mName} Budget`,
        month: d.getMonth() + 1,
        year: y,
        isCurrent: i === 0,
      });
    }
    return list;
  }, []);

  const [customMonthList, setCustomMonthList] = useState<Array<{
    label: string;
    fullLabel: string;
    defaultName: string;
    month: number;
    year: number;
    isCurrent: boolean;
  }>>([]);

  const monthOptions = React.useMemo(() => {
    const combined = [...defaultMonthOptions];
    for (const custom of customMonthList) {
      if (!combined.some((m) => m.month === custom.month && m.year === custom.year)) {
        combined.push(custom);
      }
    }
    return combined;
  }, [defaultMonthOptions, customMonthList]);

  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    const mName = now.toLocaleString('en-IN', { month: 'short' });
    const fullMName = now.toLocaleString('en-IN', { month: 'long' });
    return {
      label: `${mName} ${now.getFullYear()}`,
      fullLabel: `${fullMName} ${now.getFullYear()}`,
      month: now.getMonth() + 1,
      year: now.getFullYear(),
      defaultName: `${mName} Budget`,
      isCurrent: true,
    };
  });

  const [monthPickerVisible, setMonthPickerVisible] = useState(false);
  const [pickerYear, setPickerYear] = useState(() => new Date().getFullYear());

  const daysInSelectedMonth = React.useMemo(() => {
    return new Date(selectedMonth.year, selectedMonth.month, 0).getDate();
  }, [selectedMonth.year, selectedMonth.month]);

  const handleSelectMonthFromPicker = (monthNum: number, yearNum: number) => {
    const d = new Date(yearNum, monthNum - 1, 1);
    const mName = d.toLocaleString('en-IN', { month: 'short' });
    const fullMName = d.toLocaleString('en-IN', { month: 'long' });
    const now = new Date();
    const isCurrent = now.getMonth() + 1 === monthNum && now.getFullYear() === yearNum;

    const alreadyExists = budgets?.some((b) => {
      if (existingBudget && b.id === existingBudget.id) return false;
      const bStart = new Date(b.periodDetails.startDate);
      return bStart.getMonth() + 1 === monthNum && bStart.getFullYear() === yearNum;
    });

    const defaultName = alreadyExists ? `${mName} Plan 2` : `${mName} Budget`;

    const newOption = {
      label: `${mName} ${yearNum}`,
      fullLabel: `${fullMName} ${yearNum}`,
      defaultName,
      month: monthNum,
      year: yearNum,
      isCurrent,
    };

    setCustomMonthList((prev) => {
      if (prev.some((p) => p.month === monthNum && p.year === yearNum)) {
        return prev;
      }
      return [...prev, newOption];
    });

    setSelectedMonth(newOption);

    if (!name.trim() || monthOptions.some((m) => m.defaultName === name.trim() || name.trim().endsWith('Plan 2'))) {
      setName(newOption.defaultName);
    }

    setMonthPickerVisible(false);
  };

  // Detect if user is creating a new budget for a month that already has a budget
  const existingBudgetForSelectedMonth = React.useMemo(() => {
    if (!budgets || budgets.length === 0) return null;
    return (
      budgets.find((b) => {
        if (existingBudget && b.id === existingBudget.id) return false;
        const bStart = new Date(b.periodDetails.startDate);
        return (
          bStart.getMonth() + 1 === selectedMonth.month &&
          bStart.getFullYear() === selectedMonth.year
        );
      }) || null
    );
  }, [budgets, selectedMonth.month, selectedMonth.year, existingBudget]);

  // Check for prior activity / transactions in the selected month
  const { data: monthTransactionsData, refetch: refetchMonthTransactions } = useQuery({
    queryKey: ['transactions', 'month-check', selectedMonth.month, selectedMonth.year],
    queryFn: () => {
      const start = new Date(selectedMonth.year, selectedMonth.month - 1, 1, 0, 0, 0, 0).toISOString();
      const lastDay = new Date(selectedMonth.year, selectedMonth.month, 0).getDate();
      const end = new Date(selectedMonth.year, selectedMonth.month - 1, lastDay, 23, 59, 59, 999).toISOString();
      return api.getTransactions({ startDate: start, endDate: end, limit: 100 });
    },
  });

  const monthExpensesRupees = React.useMemo(() => {
    const txs = monthTransactionsData?.transactions || [];
    return txs
      .filter((t) => t.type === 'EXPENSE' && t.status === 'SETTLED')
      .reduce((sum, t) => sum + Number(BigInt(t.amountPaise)) / 100, 0);
  }, [monthTransactionsData]);

  const monthIncomeRupees = React.useMemo(() => {
    const txs = monthTransactionsData?.transactions || [];
    return txs
      .filter((t) => t.type === 'INCOME' && t.status === 'SETTLED')
      .reduce((sum, t) => sum + Number(BigInt(t.amountPaise)) / 100, 0);
  }, [monthTransactionsData]);

  const clearMonthMutation = useMutation({
    mutationFn: () => api.clearMonthTransactions(selectedMonth.month, selectedMonth.year),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['transactions'] }),
        queryClient.invalidateQueries({ queryKey: ['budgets'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['insights'] }),
      ]);
      await refetchMonthTransactions();
    },
  });

  const applyBudgetToForm = React.useCallback((b: any) => {
    setName(b.name || '');

    // `limitPaise` from the API is the effective limit (base + income for the
    // cycle). Editing must start from the user's original base amount so that
    // income transactions don't inflate the value every time it is edited.
    const basePaise =
      b.baseLimitPaise !== undefined && b.baseLimitPaise !== null
        ? b.baseLimitPaise
        : b.limitPaise || '0';

    let limitRupees = 0;
    try {
      limitRupees = Number(BigInt(basePaise)) / 100;
    } catch {
      limitRupees = Number(basePaise) / 100 || 0;
    }
    setOverallLimitRupees(limitRupees > 0 ? String(limitRupees) : '');

    if (b.categories && b.categories.length > 0) {
      const catMap: Record<string, string> = {};
      for (const cat of b.categories) {
        catMap[cat.categoryId] = String(Number(BigInt(cat.limitPaise)) / 100);
      }
      setCategoryLimits(catMap);
    } else {
      setCategoryLimits({});
    }

    // Restore the budget's actual target month instead of defaulting to today.
    const startRaw = b.periodDetails?.startDate;
    if (startRaw) {
      const start = new Date(startRaw);
      if (!isNaN(start.getTime())) {
        const month = start.getMonth() + 1;
        const year = start.getFullYear();
        const mName = start.toLocaleString('en-IN', { month: 'short' });
        const fullMName = start.toLocaleString('en-IN', { month: 'long' });
        const now = new Date();
        const monthOption = {
          label: `${mName} ${year}`,
          fullLabel: `${fullMName} ${year}`,
          defaultName: `${mName} Budget`,
          month,
          year,
          isCurrent: now.getMonth() + 1 === month && now.getFullYear() === year,
        };
        setCustomMonthList((prev) =>
          prev.some((p) => p.month === month && p.year === year)
            ? prev
            : [...prev, monthOption]
        );
        setSelectedMonth(monthOption);
      }
    }

    setIsPrimary(b.isActive ?? false);
    isPrimaryUserOverriddenRef.current = true;
  }, []);

  const handleLoadExistingBudget = (b: any) => {
    applyBudgetToForm(b);
    initializedBudgetSignatureRef.current = getBudgetFormSignature(b);
    router.setParams({ budgetId: b.id, reset: 'false' });
    scrollViewRef.current?.scrollTo({ y: 0, animated: true });
  };

  const [name, setName] = useState('');
  const [overallLimitRupees, setOverallLimitRupees] = useState('');
  const [categoryLimits, setCategoryLimits] = useState<Record<string, string>>({});
  const [focusedCategoryId, setFocusedCategoryId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);

  // Default isPrimary to true if no active budget exists, false if user already has an active budget
  const [isPrimary, setIsPrimary] = useState(false);
  const isPrimaryUserOverriddenRef = useRef(false);

  // Initialize fields with existing budget when editing
  const initializedBudgetSignatureRef = useRef<string | null>(null);

  const handleResetToBlank = () => {
    setName('');
    setOverallLimitRupees('');
    setCategoryLimits({});
    setError(null);
    isPrimaryUserOverriddenRef.current = false;
  };

  const handleNameChange = (text: string) => {
    setName(text);
    const lower = text.toLowerCase();
    for (const opt of monthOptions) {
      const mWord = opt.label.split(' ')[0].toLowerCase();
      const fullWord = opt.fullLabel.split(' ')[0].toLowerCase();
      if (lower.includes(mWord) || lower.includes(fullWord)) {
        setSelectedMonth(opt);
        break;
      }
    }
  };

  useEffect(() => {
    if (!isPrimaryUserOverriddenRef.current) {
      if (existingBudget) {
        setIsPrimary(existingBudget.isActive ?? false);
      } else {
        const hasActive = budgets && budgets.some((b) => b.isActive);
        setIsPrimary(!hasActive);
      }
    }
  }, [budgets, existingBudget]);

  useEffect(() => {
    if (isResetMode) {
      handleResetToBlank();
      initializedBudgetSignatureRef.current = null;
      return;
    }
    if (existingBudget) {
      const signature = getBudgetFormSignature(existingBudget);
      if (initializedBudgetSignatureRef.current !== signature) {
        applyBudgetToForm(existingBudget);
        initializedBudgetSignatureRef.current = signature;
      }
    }
  }, [existingBudget, isResetMode, applyBudgetToForm]);

  // Fetch categories
  const { data: categories, isLoading: categoriesLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: api.getCategories,
  });

  // Filter out non-expense/income categories for budgeting
  const expenseCategories = React.useMemo(() => {
    if (!categories) return [];
    return categories.filter(
      (c) =>
        !c.name.toLowerCase().includes('salary') &&
        !c.name.toLowerCase().includes('income') &&
        !c.slug.toLowerCase().includes('salary') &&
        !c.slug.toLowerCase().includes('income')
    );
  }, [categories]);

  // Total allocated across categories
  const totalAllocatedRupees = React.useMemo(() => {
    let sum = 0;
    for (const val of Object.values(categoryLimits)) {
      const num = parseFloat(val);
      if (!isNaN(num) && num > 0) {
        sum += num;
      }
    }
    return sum;
  }, [categoryLimits]);

  // Calculate safe spending recommendations based on the EXACT number of days in the selected month
  const overallNum = Math.max(0, parseFloat(overallLimitRupees) || 0);
  const safeDailyNum = Math.floor(overallNum / daysInSelectedMonth);
  const safeWeeklyNum = Math.floor((overallNum / daysInSelectedMonth) * 7);

  const mutation = useMutation({
    mutationFn: () => {
      const overallPaise = rupeesToPaise(overallLimitRupees);
      if (overallPaise <= 0) {
        throw new Error('Please enter a monthly budget limit greater than ₹0');
      }

      if (overallNum > 0 && totalAllocatedRupees > overallNum) {
        throw new Error(
          `Total category allocations (₹${totalAllocatedRupees.toLocaleString('en-IN')}) exceed monthly budget target (₹${overallNum.toLocaleString('en-IN')})`
        );
      }

      const categoryPayload = Object.entries(categoryLimits)
        .filter(([catId, val]) => {
          const hasVal = val && parseFloat(val) > 0;
          const isValidCategory = categories?.some((c) => c.id === catId);
          return hasVal && isValidCategory;
        })
        .map(([categoryId, val]) => ({
          categoryId,
          limitPaise: rupeesToPaise(val),
        }));

      // Ensure target month reflects name if month was mentioned
      let targetMonth = selectedMonth.month;
      let targetYear = selectedMonth.year;
      const lowerName = name.toLowerCase();
      for (const opt of monthOptions) {
        const mWord = opt.label.split(' ')[0].toLowerCase();
        const fullWord = opt.fullLabel.split(' ')[0].toLowerCase();
        if (lowerName.includes(mWord) || lowerName.includes(fullWord)) {
          targetMonth = opt.month;
          targetYear = opt.year;
          break;
        }
      }

      return api.createBudget({
        id: existingBudget?.id,
        name: name.trim() || selectedMonth.defaultName,
        period: 'MONTHLY',
        month: targetMonth,
        year: targetYear,
        limitPaise: overallPaise,
        categories: categoryPayload.length > 0 ? categoryPayload : undefined,
        setActive: isPrimary,
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ['budgets'], type: 'all' }),
        queryClient.refetchQueries({ queryKey: ['dashboard'], type: 'all' }),
        queryClient.refetchQueries({ queryKey: ['insights'], type: 'all' }),
      ]);
      safeDismiss();
    },
    onError: (err: any) => {
      setError(err.message || 'Failed to save budget');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!existingBudget) return;
      await api.deleteBudget(existingBudget.id);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.resetQueries({ queryKey: ['budgets'] }),
        queryClient.resetQueries({ queryKey: ['dashboard'] }),
        queryClient.resetQueries({ queryKey: ['insights'] }),
      ]);
      setDeleteConfirmVisible(false);
      safeDismiss();
    },
    onError: (err: any) => {
      setError(err?.message || 'Failed to remove budget');
    },
  });

  const isProcessing = mutation.isPending || deleteMutation.isPending;

  useEffect(() => {
    const backAction = () => {
      if (isProcessing) {
        return true;
      }
      safeDismiss();
      return true;
    };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [isProcessing, safeDismiss]);

  const handleCategoryLimitChange = (catId: string, text: string) => {
    setError(null);
    if (!text.trim()) {
      setCategoryLimits((prev) => {
        const next = { ...prev };
        delete next[catId];
        return next;
      });
      return;
    }

    const valNum = parseFloat(text);
    if (isNaN(valNum) || valNum < 0) {
      return;
    }

    if (overallNum > 0) {
      let otherTotal = 0;
      for (const [id, val] of Object.entries(categoryLimits)) {
        if (id !== catId) {
          const n = parseFloat(val);
          if (!isNaN(n) && n > 0) otherTotal += n;
        }
      }

      if (otherTotal + valNum > overallNum) {
        const maxForThis = Math.max(0, overallNum - otherTotal);
        setError(
          `🔴 Limit Reached! Total monthly target is ₹${overallNum.toLocaleString('en-IN')}. Max for this category: ₹${maxForThis.toLocaleString('en-IN')}`
        );
        setCategoryLimits((prev) => ({
          ...prev,
          [catId]: maxForThis > 0 ? String(maxForThis) : '',
        }));
        return;
      }
    }

    setCategoryLimits((prev) => ({
      ...prev,
      [catId]: text,
    }));
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 70 : 0}
      >
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 380 }]}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets={true}
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={safeDismiss}
              disabled={isProcessing}
              style={[styles.closeBtn, isProcessing && { opacity: 0.4 }]}
            >
              <X size={22} color={theme.colors.textSecondary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>
              {existingBudget && !isResetMode ? 'Edit Monthly Budget' : 'Set Monthly Budget'}
            </Text>
            {existingBudget && !isResetMode ? (
              <TouchableOpacity
                onPress={handleResetToBlank}
                style={styles.headerActionBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <RotateCcw size={16} color={theme.colors.accent} />
              </TouchableOpacity>
            ) : (
              <View style={{ width: 28 }} />
            )}
          </View>

          {/* Target Month Cycle Selector */}
          <Card style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Calendar size={15} color={theme.colors.primary} />
                <Text style={styles.inputLabel}>Target Month / Cycle</Text>
              </View>
              <TouchableOpacity
                style={styles.pickAnyMonthBtn}
                onPress={() => {
                  setPickerYear(selectedMonth.year || new Date().getFullYear());
                  setMonthPickerVisible(true);
                }}
                activeOpacity={0.7}
              >
                <CalendarDays size={13} color={theme.colors.primary} />
                <Text style={styles.pickAnyMonthBtnText}>Pick Any Month...</Text>
              </TouchableOpacity>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.monthScrollRow}>
              {monthOptions.map((opt) => {
                const isSel = selectedMonth.month === opt.month && selectedMonth.year === opt.year;
                const daysInThis = new Date(opt.year, opt.month, 0).getDate();
                return (
                  <TouchableOpacity
                    key={`${opt.year}-${opt.month}`}
                    style={[styles.monthPill, isSel && styles.monthPillActive]}
                    onPress={() => {
                      const alreadyExists = budgets?.some((b) => {
                        if (existingBudget && b.id === existingBudget.id) return false;
                        const bStart = new Date(b.periodDetails.startDate);
                        return bStart.getMonth() + 1 === opt.month && bStart.getFullYear() === opt.year;
                      });
                      const defaultName = alreadyExists ? `${opt.label.split(' ')[0]} Plan 2` : opt.defaultName;
                      setSelectedMonth({
                        ...opt,
                        defaultName,
                      });
                      if (!name.trim() || monthOptions.some((m) => m.defaultName === name.trim() || name.trim().endsWith('Plan 2'))) {
                        setName(defaultName);
                      }
                    }}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.monthPillText, isSel && styles.monthPillTextActive]}>
                      {opt.label}
                    </Text>
                    {opt.isCurrent ? (
                      <View style={styles.currentMonthBadge}>
                        <Text style={styles.currentMonthBadgeText}>Now</Text>
                      </View>
                    ) : (
                      <Text style={[styles.monthDaysSubtext, isSel && styles.monthDaysSubtextActive]}>
                        {daysInThis}d
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              })}

              {/* Extra button in scroll row for discoverability */}
              <TouchableOpacity
                style={styles.moreMonthsPill}
                onPress={() => {
                  setPickerYear(selectedMonth.year || new Date().getFullYear());
                  setMonthPickerVisible(true);
                }}
                activeOpacity={0.75}
              >
                <Plus size={13} color={theme.colors.primary} />
                <Text style={styles.moreMonthsPillText}>Other Month</Text>
              </TouchableOpacity>
            </ScrollView>

            {/* Confirmation Note of Exact Days */}
            <View style={styles.monthConfirmationRow}>
              <Check size={12} color={theme.colors.primary} />
              <Text style={styles.monthConfirmationText}>
                Active Cycle: <Text style={{ fontWeight: '700', color: theme.colors.textPrimary }}>{selectedMonth.fullLabel}</Text> • Automatically configured for <Text style={{ fontWeight: '700', color: theme.colors.primary }}>{daysInSelectedMonth} days</Text>
              </Text>
            </View>
          </Card>

          {/* Single Unified, Classy Month Context Notice */}
          {!existingBudget && (existingBudgetForSelectedMonth || monthExpensesRupees > 0 || monthIncomeRupees > 0) && (
            <View style={styles.unifiedMonthContextCard}>
              <View style={styles.unifiedMonthHeader}>
                <View style={styles.unifiedMonthTitleGroup}>
                  <Sparkles size={14} color={theme.colors.primary} />
                  <Text style={styles.unifiedMonthTitle}>
                    {selectedMonth.label} Context
                  </Text>
                </View>
                {existingBudgetForSelectedMonth && (
                  <View style={styles.alternatePlanBadge}>
                    <Text style={styles.alternatePlanBadgeText}>Alternate Plan</Text>
                  </View>
                )}
              </View>

              <View style={styles.unifiedMonthInfoBlock}>
                {existingBudgetForSelectedMonth && (
                  <Text style={styles.unifiedMonthInfoText}>
                    • Active plan: <Text style={styles.unifiedMonthHighlight}>"{existingBudgetForSelectedMonth.name}"</Text> ({formatPaiseToRupees(existingBudgetForSelectedMonth.limitPaise)})
                  </Text>
                )}
                {(monthExpensesRupees > 0 || monthIncomeRupees > 0) && (
                  <Text style={styles.unifiedMonthInfoText}>
                    • Logged activity: <Text style={styles.unifiedExpenseHighlight}>₹{monthExpensesRupees.toLocaleString('en-IN')}</Text> spent
                    {monthIncomeRupees > 0 ? ` • ₹${monthIncomeRupees.toLocaleString('en-IN')} income` : ''}
                  </Text>
                )}
              </View>

              <View style={styles.unifiedMonthActionsRow}>
                {existingBudgetForSelectedMonth && (
                  <TouchableOpacity
                    style={styles.unifiedEditPlanBtn}
                    onPress={() => handleLoadExistingBudget(existingBudgetForSelectedMonth)}
                    activeOpacity={0.75}
                  >
                    <RotateCcw size={12} color={theme.colors.primary} />
                    <Text style={styles.unifiedEditPlanBtnText}>Edit Existing Plan</Text>
                  </TouchableOpacity>
                )}

                {(monthExpensesRupees > 0 || monthIncomeRupees > 0) && (
                  <TouchableOpacity
                    style={styles.unifiedClearActivityBtn}
                    onPress={() => clearMonthMutation.mutate()}
                    disabled={clearMonthMutation.isPending}
                    activeOpacity={0.75}
                  >
                    {clearMonthMutation.isPending ? (
                      <ActivityIndicator size="small" color={theme.colors.danger} />
                    ) : (
                      <>
                        <Trash2 size={12} color={theme.colors.danger} />
                        <Text style={styles.unifiedClearActivityBtnText}>
                          Clear Activity (Start ₹0)
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {/* Monthly Budget Target Card */}
          <Card style={styles.amountCard}>
            <Text style={styles.amountLabel}>Monthly Spending Target</Text>
            <View style={styles.amountInputRow}>
              <Text style={styles.currencySymbol}>₹</Text>
              <TextInput
                style={styles.amountInput}
                placeholder="0.00"
                placeholderTextColor={theme.colors.textMuted}
                value={overallLimitRupees}
                onChangeText={setOverallLimitRupees}
                keyboardType="decimal-pad"
                returnKeyType="next"
                blurOnSubmit={false}
                editable={!isProcessing}
                onSubmitEditing={() => {
                  nameInputRef.current?.focus();
                  scrollToOffset(420);
                }}
                onFocus={() => scrollToOffset(120)}
                autoFocus={!existingBudget}
              />
            </View>
            <Text style={styles.amountCaption}>
              Set your overall spending ceiling for the current monthly cycle.
            </Text>
          </Card>

          {/* Automatic Smart Safe-to-Spend Pacing */}
          <Card style={styles.planCard}>
            <View style={styles.planCardHeader}>
              <SlidersHorizontal size={18} color={theme.colors.primary} />
              <Text style={styles.planCardTitle}>Smart Safe-to-Spend Pacing</Text>
            </View>

            <Text style={styles.planCardDesc}>
              Fynly automatically breaks down your monthly target into manageable daily and weekly spending allowances.
            </Text>

            {overallNum > 0 ? (
              <View style={styles.safeSummaryContainer}>
                <View style={styles.safeStatGrid}>
                  <View style={styles.safeStatBox}>
                    <Text style={styles.safeStatLabel}>Daily Safe Pace</Text>
                    <Text style={styles.safeStatValue}>
                      ₹{safeDailyNum.toLocaleString('en-IN')}
                      <Text style={styles.safeStatUnit}> / day</Text>
                    </Text>
                  </View>
                  <View style={styles.safeStatDivider} />
                  <View style={styles.safeStatBox}>
                    <Text style={styles.safeStatLabel}>Weekly Trajectory</Text>
                    <Text style={styles.safeStatValue}>
                      ₹{safeWeeklyNum.toLocaleString('en-IN')}
                      <Text style={styles.safeStatUnit}> / wk</Text>
                    </Text>
                  </View>
                </View>

                <View style={styles.safeNoteRow}>
                  <ShieldCheck size={15} color={theme.colors.primary} style={{ marginTop: 1 }} />
                  <Text style={styles.safeNote}>
                    Based on {daysInSelectedMonth} days in {selectedMonth.label}. Recalculates every morning based on remaining days in cycle.
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.safeStatEmptyBox}>
                <SlidersHorizontal size={20} color={theme.colors.textMuted} style={{ marginBottom: 6 }} />
                <Text style={styles.safeStatEmptyTitle}>Automatic Daily Allowance</Text>
                <Text style={styles.safeStatEmptyText}>
                  Enter a monthly amount above to calculate your daily safe-to-spend pace and weekly trajectory.
                </Text>
              </View>
            )}
          </Card>

          {error && (
            <Card style={styles.errorCard} variant="subtle">
              <Text style={styles.errorText}>{error}</Text>
            </Card>
          )}

          {/* Budget Name (Optional) */}
          <Card style={styles.sectionCard}>
            <Text style={styles.inputLabel}>Budget Name (Optional)</Text>
            <TextInput
              ref={nameInputRef}
              style={styles.textInput}
              value={name}
              onChangeText={handleNameChange}
              placeholder="e.g. Monthly Spending Limit"
              placeholderTextColor={theme.colors.textMuted}
              returnKeyType="next"
              blurOnSubmit={false}
              editable={!isProcessing}
              onSubmitEditing={() => {
                if (expenseCategories.length > 0) {
                  categoryInputRefs.current[expenseCategories[0].id]?.focus();
                  scrollToOffset(780);
                }
              }}
              onFocus={() => scrollToOffset(420)}
            />
          </Card>

          {/* Category Limits (Optional) */}
          <Card style={styles.sectionCard}>
            <View style={styles.categoryHeader}>
              <View style={styles.categoryHeaderLeft}>
                <Target size={18} color={theme.colors.primary} />
                <Text style={styles.sectionTitle} numberOfLines={1}>Category Budgets</Text>
              </View>
              <TouchableOpacity
                style={styles.addCategoryHeaderBtn}
                onPress={() => setCategoryModalVisible(true)}
                activeOpacity={0.7}
              >
                <Plus size={13} color={theme.colors.primary} />
                <Text style={styles.addCategoryHeaderText}>Add / Manage</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.sectionSubtitle}>
              Set individual spending targets for specific categories (optional).
            </Text>

            {overallNum > 0 && totalAllocatedRupees >= overallNum ? (
              <View style={styles.limitReachedWarningBanner}>
                <AlertCircle size={15} color={theme.colors.danger} />
                <Text style={styles.limitReachedWarningText}>
                  🔴 Monthly target limit reached (₹{overallNum.toLocaleString('en-IN')}). Reduce other categories or increase monthly target to allocate more.
                </Text>
              </View>
            ) : overallNum > 0 && totalAllocatedRupees > 0 ? (
              <View style={styles.allocationSummaryBadge}>
                <Text style={styles.allocationSummaryText}>
                  ₹{totalAllocatedRupees.toLocaleString('en-IN')} allocated • ₹{Math.max(0, overallNum - totalAllocatedRupees).toLocaleString('en-IN')} buffer remaining
                </Text>
              </View>
            ) : null}

            {categoriesLoading ? (
              <ActivityIndicator size="small" color={theme.colors.primary} />
            ) : (
              <View style={styles.categoryList}>
                {expenseCategories.map((cat, index) => {
                  const isLast = index === expenseCategories.length - 1;
                  return (
                    <View key={cat.id} style={styles.categoryRow}>
                      <View style={styles.categoryInfo}>
                        <View
                          style={[
                            styles.catDot,
                            { backgroundColor: cat.color || theme.colors.primary },
                          ]}
                        />
                        <Text style={styles.catName} numberOfLines={1}>{cat.name}</Text>
                      </View>

                      <View
                        style={[
                          styles.catInputWrap,
                          focusedCategoryId === cat.id && styles.activeCatInputWrap,
                        ]}
                      >
                        <Text
                          style={[
                            styles.catPrefix,
                            focusedCategoryId === cat.id && { color: theme.colors.primary, fontWeight: '700' },
                          ]}
                        >
                          ₹
                        </Text>
                        <TextInput
                          ref={(el) => {
                            categoryInputRefs.current[cat.id] = el;
                          }}
                          style={styles.catInput}
                          placeholder="Limit"
                          placeholderTextColor={theme.colors.textMuted}
                          value={categoryLimits[cat.id] || ''}
                          onChangeText={(txt) => handleCategoryLimitChange(cat.id, txt)}
                          keyboardType="decimal-pad"
                          returnKeyType={isLast ? 'done' : 'next'}
                          blurOnSubmit={isLast}
                          editable={!isProcessing}
                          onFocus={() => {
                            setFocusedCategoryId(cat.id);
                            scrollToOffset(780 + index * 56);
                          }}
                          onBlur={() => {
                            setFocusedCategoryId((prev) => (prev === cat.id ? null : prev));
                          }}
                          onSubmitEditing={() => {
                            if (!isLast) {
                              const nextCat = expenseCategories[index + 1];
                              categoryInputRefs.current[nextCat.id]?.focus();
                              scrollToOffset(780 + (index + 1) * 56);
                            } else {
                              Keyboard.dismiss();
                            }
                          }}
                        />
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </Card>

          {/* Primary Budget / Home Screen Toggle */}
          <Card style={styles.sectionCard}>
            <TouchableOpacity
              style={styles.primaryToggleRow}
              onPress={() => {
                isPrimaryUserOverriddenRef.current = true;
                setIsPrimary(!isPrimary);
              }}
              activeOpacity={0.8}
            >
              <View style={[styles.checkboxBox, isPrimary && styles.checkboxBoxActive]}>
                {isPrimary && <Check size={14} color="#FFFFFF" />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.primaryToggleTitle}>
                  Set as Primary (Show on Home Screen)
                </Text>
                <Text style={styles.primaryToggleDesc}>
                  {isPrimary
                    ? 'Active Plan: This budget will be featured on your home dashboard and calculate your daily safe-to-spend allowance.'
                    : 'Secondary Plan: Saved in the Budgets tab. It won’t replace your home screen budget until you activate it.'}
                </Text>
              </View>
            </TouchableOpacity>
          </Card>

          <Button
            title={existingBudget && !isResetMode ? 'Update Monthly Budget' : 'Save Monthly Budget'}
            onPress={() => {
              if (!mutation.isPending && !deleteMutation.isPending) {
                mutation.mutate();
              }
            }}
            loading={mutation.isPending}
            disabled={mutation.isPending || deleteMutation.isPending}
            style={{ marginTop: theme.spacing.md }}
          />

          {existingBudget && !isResetMode && (
            <Button
              title="Delete This Budget Completely"
              variant="danger"
              onPress={() => {
                if (!mutation.isPending && !deleteMutation.isPending) {
                  setDeleteConfirmVisible(true);
                }
              }}
              loading={deleteMutation.isPending}
              disabled={mutation.isPending || deleteMutation.isPending}
              icon={<Trash2 size={16} color={theme.colors.textInverse} />}
              style={{ marginTop: theme.spacing.sm }}
            />
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Classy Saving/Deleting Overlay */}
      {isProcessing && (
        <View style={styles.savingOverlay}>
          <View style={styles.savingCard}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
            <Text style={styles.savingText}>
              {deleteMutation.isPending ? 'Removing Budget Plan...' : 'Saving Budget Plan...'}
            </Text>
          </View>
        </View>
      )}

      <CategoryManagerModal
        visible={categoryModalVisible}
        onClose={() => setCategoryModalVisible(false)}
        maxAllowedLimitRupees={Math.max(0, overallNum - totalAllocatedRupees)}
        onSelectCategory={(newCat, initialMoney) => {
          if (initialMoney && parseFloat(initialMoney) > 0) {
            setCategoryLimits((prev) => ({
              ...prev,
              [newCat.id]: initialMoney,
            }));
          }
          setCategoryModalVisible(false);
        }}
      />

      {/* Delete Confirmation Modal */}
      <Modal
        visible={deleteConfirmVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteConfirmVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Card style={styles.deleteModalCard}>
            <View style={styles.deleteModalIconWrap}>
              <Trash2 size={28} color={theme.colors.danger} />
            </View>

            <Text style={styles.deleteModalTitle}>Delete This Budget?</Text>
            <Text style={styles.deleteModalDescription}>
              This will completely remove <Text style={{ fontWeight: '700', color: theme.colors.textPrimary }}>{existingBudget?.name}</Text> and turn off safe-to-spend tracking and threshold warnings.
              {'\n\n'}
              Your historical transactions and account balances remain safe.
            </Text>

            <View style={styles.deleteModalButtons}>
              <Button
                title="Yes, Delete Budget"
                variant="danger"
                onPress={() => {
                  if (!deleteMutation.isPending) {
                    deleteMutation.mutate();
                  }
                }}
                loading={deleteMutation.isPending}
                disabled={deleteMutation.isPending}
                icon={<Trash2 size={16} color={theme.colors.textInverse} />}
                style={{ width: '100%' }}
              />

              <Button
                title="Cancel"
                variant="secondary"
                onPress={() => setDeleteConfirmVisible(false)}
                disabled={deleteMutation.isPending}
                style={{ width: '100%' }}
              />
            </View>
          </Card>
        </View>
      </Modal>

      {/* Month & Year Selection Modal */}
      <Modal
        visible={monthPickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMonthPickerVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.monthPickerModalCard}>
            {/* Modal Header */}
            <View style={styles.monthPickerHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={styles.monthPickerIconWrap}>
                  <CalendarDays size={18} color={theme.colors.primary} />
                </View>
                <View>
                  <Text style={styles.monthPickerTitle}>Select Target Month</Text>
                  <Text style={styles.monthPickerSubtitle}>Choose any month and year</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setMonthPickerVisible(false)}
                style={styles.monthPickerCloseBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <X size={18} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Year Navigator */}
            <View style={styles.yearNavigatorRow}>
              <TouchableOpacity
                style={styles.yearNavBtn}
                onPress={() => setPickerYear((y) => Math.max(2020, y - 1))}
                activeOpacity={0.7}
              >
                <ChevronLeft size={18} color={theme.colors.textPrimary} />
              </TouchableOpacity>

              <View style={styles.yearDisplayBadge}>
                <Text style={styles.yearDisplayText}>{pickerYear}</Text>
              </View>

              <TouchableOpacity
                style={styles.yearNavBtn}
                onPress={() => setPickerYear((y) => Math.min(2050, y + 1))}
                activeOpacity={0.7}
              >
                <ChevronRight size={18} color={theme.colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {/* Quick Year Bar */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.quickYearRow}
            >
              {[2024, 2025, 2026, 2027, 2028, 2029, 2030].map((y) => (
                <TouchableOpacity
                  key={y}
                  style={[styles.quickYearPill, pickerYear === y && styles.quickYearPillActive]}
                  onPress={() => setPickerYear(y)}
                  activeOpacity={0.75}
                >
                  <Text
                    style={[
                      styles.quickYearPillText,
                      pickerYear === y && styles.quickYearPillTextActive,
                    ]}
                  >
                    {y}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* 12 Months Grid */}
            <View style={styles.monthsGrid}>
              {ALL_MONTHS.map((m) => {
                const isSelected = selectedMonth.month === m.month && selectedMonth.year === pickerYear;
                const now = new Date();
                const isNow = now.getMonth() + 1 === m.month && now.getFullYear() === pickerYear;
                const daysInM = new Date(pickerYear, m.month, 0).getDate();

                return (
                  <TouchableOpacity
                    key={m.month}
                    style={[
                      styles.monthGridItem,
                      isSelected && styles.monthGridItemActive,
                      isNow && !isSelected && styles.monthGridItemNow,
                    ]}
                    onPress={() => handleSelectMonthFromPicker(m.month, pickerYear)}
                    activeOpacity={0.75}
                  >
                    <Text
                      style={[
                        styles.monthGridItemName,
                        isSelected && styles.monthGridItemNameActive,
                      ]}
                    >
                      {m.short}
                    </Text>
                    <Text
                      style={[
                        styles.monthGridItemDays,
                        isSelected && styles.monthGridItemDaysActive,
                      ]}
                    >
                      {daysInM} days
                    </Text>
                    {isNow && (
                      <View style={styles.monthGridNowBadge}>
                        <Text style={styles.monthGridNowBadgeText}>Now</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const getStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollContent: {
      padding: 16,
      paddingBottom: 48,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16,
      paddingTop: Platform.OS === 'android' ? 14 : 6,
    },
    closeBtn: {
      padding: 6,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.colors.textPrimary,
    },
    amountCard: {
      alignItems: 'center',
      paddingVertical: 24,
      marginBottom: 16,
    },
    amountLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.colors.textSecondary,
      marginBottom: 8,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    amountInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    currencySymbol: {
      fontSize: 30,
      fontWeight: '700',
      color: theme.colors.textPrimary,
      marginRight: 4,
    },
    amountInput: {
      fontSize: 38,
      fontWeight: '800',
      color: theme.colors.textPrimary,
      minWidth: 140,
      textAlign: 'center',
      ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
    },
    amountCaption: {
      fontSize: 12,
      color: theme.colors.textMuted,
      marginTop: 8,
      textAlign: 'center',
    },
    planCard: {
      padding: 16,
      marginBottom: 16,
      borderColor: theme.colors.border,
      borderWidth: 1,
    },
    planCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 4,
    },
    planCardTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.colors.textPrimary,
    },
    planCardDesc: {
      fontSize: 12,
      color: theme.colors.textMuted,
      marginBottom: 14,
      lineHeight: 18,
    },
    safeSummaryContainer: {
      backgroundColor: theme.colors.surfaceAlt,
      borderRadius: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    safeStatGrid: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-around',
      marginBottom: 12,
    },
    safeStatBox: {
      alignItems: 'center',
      flex: 1,
    },
    safeStatLabel: {
      fontSize: 11,
      color: theme.colors.textSecondary,
      marginBottom: 3,
      textTransform: 'uppercase',
      fontWeight: '600',
    },
    safeStatValue: {
      fontSize: 17,
      fontWeight: '800',
      color: theme.colors.primary,
    },
    safeStatUnit: {
      fontSize: 12,
      color: theme.colors.textMuted,
      fontWeight: '400',
    },
    safeStatDivider: {
      width: 1,
      height: 34,
      backgroundColor: theme.colors.border,
    },
    safeNoteRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      backgroundColor: theme.colors.primaryBg,
      padding: 10,
      borderRadius: 8,
    },
    safeNote: {
      flex: 1,
      fontSize: 11,
      color: theme.colors.primary,
      lineHeight: 16,
      fontWeight: '500',
    },
    safeStatEmptyBox: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 18,
      paddingHorizontal: 16,
      backgroundColor: theme.colors.surfaceAlt,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    safeStatEmptyTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.colors.textSecondary,
      marginBottom: 4,
    },
    safeStatEmptyText: {
      fontSize: 12,
      color: theme.colors.textMuted,
      textAlign: 'center',
      lineHeight: 18,
    },
    errorCard: {
      borderColor: theme.colors.danger,
      borderWidth: 1,
      marginBottom: 16,
    },
    errorText: {
      fontSize: 13,
      color: theme.colors.danger,
    },
    sectionCard: {
      padding: 16,
      marginBottom: 16,
    },
    sectionHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 10,
    },
    inputLabel: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginBottom: 4,
    },
    textInput: {
      backgroundColor: theme.colors.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: theme.colors.textPrimary,
      fontSize: 15,
      ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
    },
    categoryHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 4,
      gap: 8,
    },
    categoryHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flex: 1,
      minWidth: 0,
    },
    addCategoryHeaderBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: theme.colors.primaryBg,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 8,
      flexShrink: 0,
      borderWidth: 1,
      borderColor: `${theme.colors.primary}30`,
    },
    addCategoryHeaderText: {
      fontSize: 12,
      color: theme.colors.primary,
      fontWeight: '700',
    },
    sectionTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.colors.textPrimary,
      flexShrink: 1,
    },
    sectionSubtitle: {
      fontSize: 12,
      color: theme.colors.textMuted,
      marginBottom: 10,
    },
    allocationSummaryBadge: {
      backgroundColor: theme.colors.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      marginBottom: 12,
    },
    allocationSummaryText: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.colors.primary,
    },
    limitReachedWarningBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.dangerBg,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 8,
      marginBottom: 12,
      gap: 8,
    },
    limitReachedWarningText: {
      flex: 1,
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.danger,
      lineHeight: 16,
    },
    categoryList: {
      gap: 8,
    },
    categoryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 5,
      gap: 10,
    },
    categoryInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flex: 1,
      minWidth: 0,
    },
    catDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      flexShrink: 0,
    },
    catName: {
      fontSize: 14,
      color: theme.colors.textPrimary,
      flexShrink: 1,
    },
    catInputWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.surfaceAlt,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: 8,
      width: 105,
      flexShrink: 0,
      overflow: 'hidden',
    },
    activeCatInputWrap: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.surface,
      borderWidth: 1.5,
      shadowColor: theme.colors.primary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 2,
    },
    catPrefix: {
      fontSize: 12,
      color: theme.colors.textMuted,
      marginRight: 2,
    },
    catInput: {
      flex: 1,
      minWidth: 0,
      color: theme.colors.textPrimary,
      fontSize: 13,
      paddingVertical: 6,
      textAlign: 'right',
      ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
    },
    headerActionBtn: {
      padding: 6,
      borderRadius: 8,
      backgroundColor: `${theme.colors.accent}15`,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.65)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
    },
    deleteModalCard: {
      width: '100%',
      maxWidth: 380,
      padding: 24,
      alignItems: 'center',
    },
    deleteModalIconWrap: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: `${theme.colors.danger}15`,
      borderWidth: 1,
      borderColor: `${theme.colors.danger}35`,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    deleteModalTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.colors.textPrimary,
      textAlign: 'center',
      marginBottom: 8,
    },
    deleteModalDescription: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      lineHeight: 18,
      marginBottom: 20,
    },
    deleteModalButtons: {
      width: '100%',
      gap: 10,
    },
    monthScrollRow: {
      flexDirection: 'row',
      gap: 8,
      paddingVertical: 4,
    },
    monthPill: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 10,
      backgroundColor: theme.colors.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.colors.border,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    monthPillActive: {
      borderColor: theme.colors.primary,
      backgroundColor: `${theme.colors.primary}18`,
    },
    monthPillText: {
      fontSize: 12.5,
      fontWeight: '600',
      color: theme.colors.textSecondary,
    },
    monthPillTextActive: {
      color: theme.colors.primary,
      fontWeight: '700',
    },
    currentMonthBadge: {
      backgroundColor: `${theme.colors.primary}25`,
      paddingHorizontal: 5,
      paddingVertical: 1,
      borderRadius: 4,
    },
    currentMonthBadgeText: {
      fontSize: 9,
      fontWeight: '700',
      color: theme.colors.primary,
    },
    primaryToggleRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
    },
    checkboxBox: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: theme.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surfaceAlt,
      marginTop: 1,
    },
    checkboxBoxActive: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    primaryToggleTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.colors.textPrimary,
    },
    primaryToggleDesc: {
      fontSize: 11.5,
      color: theme.colors.textMuted,
      marginTop: 3,
      lineHeight: 16,
    },

    // Month Selector Additions
    pickAnyMonthBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 9,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: theme.colors.primaryBg,
      borderWidth: 1,
      borderColor: `${theme.colors.primary}35`,
    },
    pickAnyMonthBtnText: {
      fontSize: 11.5,
      fontWeight: '700',
      color: theme.colors.primary,
    },
    monthDaysSubtext: {
      fontSize: 10,
      fontWeight: '600',
      color: theme.colors.textMuted,
    },
    monthDaysSubtextActive: {
      color: theme.colors.primary,
    },
    moreMonthsPill: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
      backgroundColor: theme.colors.surfaceAlt,
      borderWidth: 1,
      borderColor: `${theme.colors.primary}40`,
      borderStyle: 'dashed',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    moreMonthsPillText: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.colors.primary,
    },
    monthConfirmationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 10,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    monthConfirmationText: {
      fontSize: 11.5,
      color: theme.colors.textSecondary,
      lineHeight: 16,
    },

    // Unified Classy Month Context Card
    unifiedMonthContextCard: {
      backgroundColor: theme.colors.surfaceAlt,
      borderWidth: 1,
      borderColor: `${theme.colors.primary}30`,
      borderRadius: 14,
      padding: 14,
      marginBottom: 16,
    },
    unifiedMonthHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    unifiedMonthTitleGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    unifiedMonthTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.colors.textPrimary,
    },
    alternatePlanBadge: {
      backgroundColor: `${theme.colors.primary}18`,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
    },
    alternatePlanBadgeText: {
      fontSize: 10,
      fontWeight: '700',
      color: theme.colors.primary,
    },
    unifiedMonthInfoBlock: {
      gap: 3,
      marginBottom: 12,
    },
    unifiedMonthInfoText: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      lineHeight: 17,
    },
    unifiedMonthHighlight: {
      fontWeight: '700',
      color: theme.colors.textPrimary,
    },
    unifiedExpenseHighlight: {
      fontWeight: '700',
      color: theme.colors.expense,
    },
    unifiedMonthActionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flexWrap: 'wrap',
    },
    unifiedEditPlanBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: 11,
      paddingVertical: 6,
      borderRadius: 8,
    },
    unifiedEditPlanBtnText: {
      fontSize: 11.5,
      fontWeight: '700',
      color: theme.colors.primary,
    },
    unifiedClearActivityBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: `${theme.colors.danger}12`,
      borderWidth: 1,
      borderColor: `${theme.colors.danger}35`,
      paddingHorizontal: 11,
      paddingVertical: 6,
      borderRadius: 8,
    },
    unifiedClearActivityBtnText: {
      fontSize: 11.5,
      fontWeight: '700',
      color: theme.colors.danger,
    },

    // Month & Year Picker Modal Styles
    monthPickerModalCard: {
      width: '100%',
      maxWidth: 420,
      backgroundColor: theme.colors.surface,
      borderRadius: 22,
      padding: 20,
      borderWidth: 1,
      borderColor: theme.colors.surfaceBorder,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.35,
      shadowRadius: 20,
      elevation: 10,
    },
    monthPickerHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16,
    },
    monthPickerIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: theme.colors.primaryBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    monthPickerTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: theme.colors.textPrimary,
      letterSpacing: -0.3,
    },
    monthPickerSubtitle: {
      fontSize: 11.5,
      color: theme.colors.textMuted,
      marginTop: 1,
    },
    monthPickerCloseBtn: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: theme.colors.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
    },

    // Year Navigator
    yearNavigatorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: theme.colors.surfaceAlt,
      borderRadius: 12,
      padding: 6,
      marginBottom: 10,
    },
    yearNavBtn: {
      width: 34,
      height: 34,
      borderRadius: 8,
      backgroundColor: theme.colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    yearDisplayBadge: {
      paddingHorizontal: 16,
      paddingVertical: 4,
    },
    yearDisplayText: {
      fontSize: 18,
      fontWeight: '800',
      color: theme.colors.textPrimary,
      letterSpacing: 0.5,
    },

    // Quick Year Bar
    quickYearRow: {
      flexDirection: 'row',
      gap: 6,
      paddingBottom: 14,
    },
    quickYearPill: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 8,
      backgroundColor: theme.colors.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    quickYearPillActive: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    quickYearPillText: {
      fontSize: 11.5,
      fontWeight: '600',
      color: theme.colors.textSecondary,
    },
    quickYearPillTextActive: {
      color: '#ffffff',
      fontWeight: '700',
    },

    // 12 Months Grid
    monthsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      justifyContent: 'space-between',
    },
    monthGridItem: {
      width: '31%',
      paddingVertical: 12,
      paddingHorizontal: 8,
      borderRadius: 12,
      backgroundColor: theme.colors.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: 'center',
      position: 'relative',
    },
    monthGridItemActive: {
      backgroundColor: `${theme.colors.primary}18`,
      borderColor: theme.colors.primary,
      borderWidth: 1.5,
    },
    monthGridItemNow: {
      borderColor: `${theme.colors.primary}40`,
    },
    monthGridItemName: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.colors.textPrimary,
      marginBottom: 2,
    },
    monthGridItemNameActive: {
      color: theme.colors.primary,
    },
    monthGridItemDays: {
      fontSize: 10.5,
      color: theme.colors.textMuted,
      fontWeight: '500',
    },
    monthGridItemDaysActive: {
      color: theme.colors.primary,
      fontWeight: '600',
    },
    monthGridNowBadge: {
      position: 'absolute',
      top: 4,
      right: 4,
      backgroundColor: theme.colors.primary,
      paddingHorizontal: 4,
      paddingVertical: 1,
      borderRadius: 4,
    },
    monthGridNowBadgeText: {
      fontSize: 7.5,
      fontWeight: '800',
      color: '#ffffff',
    },
    savingOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.45)',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
    },
    savingCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: theme.colors.surface,
      paddingHorizontal: 20,
      paddingVertical: 14,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.colors.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 10,
      elevation: 8,
    },
    savingText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.textPrimary,
    },
  });
