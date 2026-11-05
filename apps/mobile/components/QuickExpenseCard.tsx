import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Plus, TrendingUp } from 'lucide-react-native';
import { api, formatPaiseToRupees, rupeesToPaise } from '../lib/api';
import { useTheme, Theme } from '../lib/theme';
import { Card } from './Card';
import { useSafeRouter } from '../hooks/useSafeRouter';

const getTodayRange = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
};

interface QuickExpenseCardProps {
  dailyLimitPaise?: string;
  dailyRemainingPaise?: string;
  dailyExceededByPaise?: string;
  isOverPace?: boolean;
}

export const QuickExpenseCard: React.FC<QuickExpenseCardProps> = ({
  dailyLimitPaise,
  dailyRemainingPaise,
  dailyExceededByPaise,
  isOverPace,
}) => {
  const { theme } = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const router = useSafeRouter();
  const queryClient = useQueryClient();

  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const descInputRef = React.useRef<React.ComponentRef<typeof TextInput>>(null);

  const { data: accounts } = useQuery({
    queryKey: ['accounts'],
    queryFn: api.getAccounts,
  });

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: api.getCategories,
  });

  const {
    data: todayData,
    isLoading: todayLoading,
  } = useQuery({
    queryKey: ['transactions', 'today-expenses'],
    queryFn: () => {
      const { start, end } = getTodayRange();
      return api.getTransactions({ type: 'EXPENSE', startDate: start, endDate: end, limit: 20 });
    },
  });

  const expenseCategories = useMemo(() => {
    const list = categories || [];
    return list.filter(
      (c) =>
        !c.name.toLowerCase().includes('salary') &&
        !c.name.toLowerCase().includes('income') &&
        !c.slug.toLowerCase().includes('salary') &&
        !c.slug.toLowerCase().includes('income')
    );
  }, [categories]);

  const todayExpenses = todayData?.transactions || [];
  const todayTotalPaise = todayExpenses.reduce(
    (sum, tx) => sum + BigInt(tx.amountPaise),
    0n
  );

  const defaultCategory =
    categories?.find((c) => c.slug === 'other' || c.name.toLowerCase() === 'other') ||
    categories?.[0];
  const activeCategoryId = categoryId || defaultCategory?.id || null;
  const activeCategory =
    categories?.find((c) => c.id === activeCategoryId) || defaultCategory;

  const hasDailyLimit = !!dailyLimitPaise && BigInt(dailyLimitPaise) > 0n;
  const paceText = hasDailyLimit
    ? isOverPace
      ? `${formatPaiseToRupees(dailyExceededByPaise || '0')} over today`
      : `${formatPaiseToRupees(dailyRemainingPaise || '0')} left today`
    : 'spent so far';
  const paceColor = isOverPace
    ? theme.colors.expense
    : hasDailyLimit
    ? theme.colors.primary
    : theme.colors.textMuted;

  const dateLabel = new Date().toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const amountPaise = rupeesToPaise(amount);
      if (amountPaise <= 0) {
        throw new Error('Enter how much you spent');
      }
      if (!accounts || accounts.length === 0) {
        throw new Error('No account available to record this expense');
      }
      return api.createTransaction({
        accountId: accounts[0].id,
        categoryId: activeCategoryId || undefined,
        type: 'EXPENSE',
        amountPaise,
        description: description.trim() || activeCategory?.name || 'Expense',
        allowDuplicate: true,
      });
    },
    onSuccess: async (created) => {
      setAmount('');
      setDescription('');
      setCategoryId(null);
      setError(null);
      setSuccess(`${created.description || 'Expense'} added`);
      await Promise.all([
        queryClient.resetQueries({ queryKey: ['dashboard'] }),
        queryClient.resetQueries({ queryKey: ['budgets'] }),
        queryClient.resetQueries({ queryKey: ['transactions'] }),
        queryClient.resetQueries({ queryKey: ['accounts'] }),
        queryClient.resetQueries({ queryKey: ['insights'] }),
        queryClient.resetQueries({ queryKey: ['insights-overview'] }),
        queryClient.resetQueries({ queryKey: ['notifications'] }),
        queryClient.resetQueries({ queryKey: ['me'] }),
      ]);
      setTimeout(() => setSuccess(null), 2400);
    },
    onError: (err: any) => {
      setSuccess(null);
      setError(err?.message || 'Failed to add expense');
    },
  });

  const handleAdd = () => {
    setError(null);
    setSuccess(null);
    mutation.mutate();
  };

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>TODAY</Text>
          <Text style={styles.dateText}>{dateLabel}</Text>
        </View>
        <View style={styles.totalWrap}>
          <Text style={styles.totalAmount} numberOfLines={1} adjustsFontSizeToFit>
            {todayLoading ? '—' : formatPaiseToRupees(todayTotalPaise.toString())}
          </Text>
          <Text style={[styles.totalMeta, { color: paceColor }]}>{paceText}</Text>
        </View>
      </View>

      {!todayLoading && todayExpenses.length > 0 ? (
        <View style={styles.list}>
          {todayExpenses.slice(0, 5).map((tx) => (
            <View key={tx.id} style={styles.row}>
              <View style={styles.rowLeft}>
                <View
                  style={[
                    styles.dot,
                    { backgroundColor: tx.category?.color || theme.colors.expense },
                  ]}
                />
                <Text style={styles.itemName} numberOfLines={1}>
                  {tx.description || tx.category?.name || 'Expense'}
                </Text>
              </View>
              <Text style={styles.itemAmount}>
                -{formatPaiseToRupees(tx.amountPaise)}
              </Text>
            </View>
          ))}
          {todayExpenses.length > 5 && (
            <TouchableOpacity
              onPress={() => router.push('/activity')}
              activeOpacity={0.7}
            >
              <Text style={styles.more}>+{todayExpenses.length - 5} more today</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : !todayLoading ? (
        <Text style={styles.emptyHint}>Nothing spent yet today.</Text>
      ) : null}

      <View style={[styles.composer, isFocused && styles.composerFocused]}>
        <View style={styles.amountWrap}>
          <Text style={styles.currency}>₹</Text>
          <TextInput
            style={styles.amountInput}
            placeholder="0"
            placeholderTextColor={theme.colors.textMuted}
            value={amount}
            onChangeText={(text) => {
              setAmount(text);
              setError(null);
            }}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            keyboardType="decimal-pad"
            returnKeyType="next"
            onSubmitEditing={() => descInputRef.current?.focus()}
            editable={!mutation.isPending}
          />
        </View>

        <View style={styles.composerDivider} />

        <TextInput
          ref={descInputRef}
          style={styles.descInput}
          placeholder="What did you spend on?"
          placeholderTextColor={theme.colors.textMuted}
          value={description}
          onChangeText={(text) => {
            setDescription(text);
            setError(null);
          }}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          returnKeyType="done"
          editable={!mutation.isPending}
          onSubmitEditing={handleAdd}
        />

        <TouchableOpacity
          style={[styles.addBtn, mutation.isPending && { opacity: 0.6 }]}
          onPress={handleAdd}
          disabled={mutation.isPending}
          activeOpacity={0.85}
        >
          {mutation.isPending ? (
            <ActivityIndicator size="small" color={theme.colors.textInverse} />
          ) : (
            <Plus size={18} color={theme.colors.textInverse} />
          )}
        </TouchableOpacity>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {success ? (
        <View style={styles.successRow}>
          <CheckCircle2 size={13} color={theme.colors.primary} />
          <Text style={styles.successText}>{success}</Text>
        </View>
      ) : null}

      {expenseCategories.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
        >
          {expenseCategories.slice(0, 12).map((cat) => {
            const isSelected = activeCategoryId === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[styles.chip, isSelected && styles.chipActive]}
                onPress={() => setCategoryId(cat.id)}
                activeOpacity={0.75}
                disabled={mutation.isPending}
              >
                <View
                  style={[
                    styles.chipDot,
                    { backgroundColor: cat.color || theme.colors.primary },
                  ]}
                />
                <Text
                  style={[styles.chipText, isSelected && styles.chipTextActive]}
                  numberOfLines={1}
                >
                  {cat.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.footerAction}
          onPress={() => router.push('/add-transaction?type=INCOME')}
          activeOpacity={0.7}
        >
          <TrendingUp size={13} color={theme.colors.income} />
          <Text style={styles.footerActionText}>Add income</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push('/add-transaction?type=EXPENSE')}
          activeOpacity={0.7}
        >
          <Text style={styles.footerMore}>More options</Text>
        </TouchableOpacity>
      </View>
    </Card>
  );
};

const getStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      padding: 18,
      borderRadius: 20,
      backgroundColor: theme.colors.surface,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
    },
    eyebrow: {
      fontSize: 10.5,
      fontWeight: '800',
      color: theme.colors.textMuted,
      letterSpacing: 1,
    },
    dateText: {
      fontSize: 12.5,
      fontWeight: '600',
      color: theme.colors.textSecondary,
      marginTop: 3,
    },
    totalWrap: {
      alignItems: 'flex-end',
      flexShrink: 1,
      marginLeft: 12,
    },
    totalAmount: {
      fontSize: 26,
      fontWeight: '800',
      color: theme.colors.textPrimary,
      letterSpacing: -0.6,
    },
    totalMeta: {
      fontSize: 11.5,
      fontWeight: '600',
      marginTop: 2,
    },
    list: {
      gap: 10,
      marginTop: 16,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    rowLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flex: 1,
      marginRight: 12,
    },
    dot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    itemName: {
      flex: 1,
      fontSize: 13.5,
      fontWeight: '600',
      color: theme.colors.textPrimary,
    },
    itemAmount: {
      fontSize: 13.5,
      fontWeight: '700',
      color: theme.colors.expense,
    },
    more: {
      fontSize: 11.5,
      fontWeight: '600',
      color: theme.colors.primary,
      marginTop: 2,
    },
    emptyHint: {
      fontSize: 12.5,
      color: theme.colors.textMuted,
      marginTop: 14,
    },
    composer: {
      flexDirection: 'row',
      alignItems: 'center',
      height: 52,
      marginTop: 16,
      paddingLeft: 12,
      paddingRight: 6,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surfaceAlt,
    },
    composerFocused: {
      borderColor: theme.colors.primary,
    },
    amountWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      width: 84,
    },
    currency: {
      fontSize: 16,
      fontWeight: '800',
      color: theme.colors.textPrimary,
      marginRight: 2,
    },
    amountInput: {
      flex: 1,
      fontSize: 16,
      fontWeight: '700',
      color: theme.colors.textPrimary,
      paddingVertical: 0,
      ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
    },
    composerDivider: {
      width: 1,
      height: 24,
      backgroundColor: theme.colors.border,
      marginRight: 10,
    },
    descInput: {
      flex: 1,
      fontSize: 13.5,
      color: theme.colors.textPrimary,
      paddingVertical: 0,
      ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
    },
    addBtn: {
      width: 38,
      height: 38,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.primary,
      marginLeft: 8,
    },
    error: {
      marginTop: 10,
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.danger,
    },
    successRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 10,
    },
    successText: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.colors.primary,
    },
    chipsRow: {
      gap: 6,
      paddingTop: 12,
      paddingBottom: 2,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 9,
      paddingVertical: 5,
      borderRadius: theme.borderRadius.full,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surfaceAlt,
      maxWidth: 130,
    },
    chipActive: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.primaryBg,
    },
    chipDot: {
      width: 5,
      height: 5,
      borderRadius: 3,
    },
    chipText: {
      fontSize: 10.5,
      fontWeight: '600',
      color: theme.colors.textSecondary,
    },
    chipTextActive: {
      color: theme.colors.primary,
      fontWeight: '700',
    },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 14,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    footerAction: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    footerActionText: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.colors.income,
    },
    footerMore: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.textMuted,
    },
  });
