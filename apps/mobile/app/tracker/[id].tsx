import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock,
  Play,
  Plus,
  Square,
  Trash2,
  TrendingDown,
} from 'lucide-react-native';
import { api, formatPaiseToRupees, rupeesToPaise } from '../../lib/api';
import { useSafeRouter } from '../../hooks/useSafeRouter';
import { useTheme, Theme } from '../../lib/theme';
import { Card } from '../../components/Card';
import { Transaction } from '../../types';

const pad = (value: number) => String(value).padStart(2, '0');

const localDateKey = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const shortDate = (value: string | null | undefined): string => {
  if (!value) return '';
  return new Date(value).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
  });
};

const dayLabel = (value: string): string =>
  new Date(`${value}T12:00:00`).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

export default function TrackerDetailScreen() {
  const router = useSafeRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const trackerId = Array.isArray(id) ? id[0] : id;
  const queryClient = useQueryClient();
  const { theme } = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);

  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const {
    data: tracker,
    isLoading,
    isError,
    error: fetchError,
    refetch,
  } = useQuery({
    queryKey: ['tracker', trackerId],
    queryFn: () => api.getTracker(trackerId as string),
    enabled: !!trackerId,
  });

  const invalidateAll = async () => {
    await Promise.all([
      queryClient.refetchQueries({ queryKey: ['tracker', trackerId], type: 'all' }),
      queryClient.refetchQueries({ queryKey: ['trackers'], type: 'all' }),
      queryClient.refetchQueries({ queryKey: ['dashboard'], type: 'all' }),
      queryClient.refetchQueries({ queryKey: ['transactions'], type: 'all' }),
      queryClient.refetchQueries({ queryKey: ['accounts'], type: 'all' }),
      queryClient.refetchQueries({ queryKey: ['budgets'], type: 'all' }),
      queryClient.refetchQueries({ queryKey: ['insights'], type: 'all' }),
      queryClient.refetchQueries({ queryKey: ['insights-overview'], type: 'all' }),
      queryClient.refetchQueries({ queryKey: ['notifications'], type: 'all' }),
    ]);
  };

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!tracker) throw new Error('Tracker not loaded');
      const amountPaise = rupeesToPaise(amount);
      if (amountPaise <= 0) throw new Error('Enter how much you spent');
      return api.addTrackerExpense(tracker.id, {
        amountPaise,
        description: description.trim() || undefined,
        allowDuplicate: true,
      });
    },
    onSuccess: async () => {
      setAmount('');
      setDescription('');
      setError(null);
      setSuccess('Expense added');
      await invalidateAll();
      setTimeout(() => setSuccess(null), 2400);
    },
    onError: (err: any) => {
      setSuccess(null);
      setError(err?.message || 'Failed to add expense');
    },
  });

  const endMutation = useMutation({
    mutationFn: () => {
      if (!tracker) throw new Error('Tracker not loaded');
      return api.endTracker(tracker.id);
    },
    onSuccess: async () => {
      setError(null);
      await invalidateAll();
    },
    onError: (err: any) => {
      setError(err?.message || 'Failed to end tracker');
    },
  });

  const deleteExpenseMutation = useMutation({
    mutationFn: (transactionId: string) => {
      if (!tracker) throw new Error('Tracker not loaded');
      return api.deleteTrackerExpense(tracker.id, transactionId);
    },
    onSuccess: async () => {
      await invalidateAll();
    },
    onError: (err: any) => {
      setError(err?.message || 'Failed to delete expense');
    },
  });

  const deleteTrackerMutation = useMutation({
    mutationFn: () => {
      if (!tracker) throw new Error('Tracker not loaded');
      return api.deleteTracker(tracker.id);
    },
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: ['trackers'], type: 'all' });
      router.replace('/(tabs)/trackers');
    },
    onError: (err: any) => {
      setError(err?.message || 'Failed to delete tracker');
    },
  });

  const groupedDays = useMemo(() => {
    const transactions = tracker?.transactions || [];
    const map = new Map<string, Transaction[]>();

    for (const tx of transactions) {
      const key = localDateKey(new Date(tx.date));
      const bucket = map.get(key) || [];
      bucket.push(tx);
      map.set(key, bucket);
    }

    return Array.from(map.entries())
      .map(([key, items]) => ({
        key,
        label: dayLabel(key),
        totalPaise: items.reduce((sum, tx) => sum + BigInt(tx.amountPaise), 0n),
        items,
      }))
      .sort((a, b) => (a.key < b.key ? 1 : a.key > b.key ? -1 : 0));
  }, [tracker]);

  const todayKey = localDateKey(new Date());
  const todaySpentPaise = tracker?.summary.dailyBreakdown.find(
    (day) => day.date === todayKey
  )?.totalPaise;

  const confirmEnd = () => {
    if (Platform.OS === 'web') {
      if (window.confirm('End this tracker and freeze its final summary?')) {
        endMutation.mutate();
      }
      return;
    }
    Alert.alert(
      'End Tracker',
      'End this tracker and freeze its final summary? You can still view it later.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'End Tracker', style: 'destructive', onPress: () => endMutation.mutate() },
      ]
    );
  };

  const confirmDeleteExpense = (transaction: Transaction) => {
    const label = transaction.description || 'this expense';
    if (Platform.OS === 'web') {
      if (window.confirm(`Delete "${label}"? The account balance will be reversed.`)) {
        deleteExpenseMutation.mutate(transaction.id);
      }
      return;
    }
    Alert.alert('Delete Expense', `Delete "${label}"? The account balance will be reversed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteExpenseMutation.mutate(transaction.id),
      },
    ]);
  };

  const confirmDeleteTracker = () => {
    if (Platform.OS === 'web') {
      if (
        window.confirm(
          'Delete this tracker? Its logged transactions will stay in Activity but will no longer be linked to a tracker.'
        )
      ) {
        deleteTrackerMutation.mutate();
      }
      return;
    }
    Alert.alert(
      'Delete Tracker',
      'Delete this tracker? Its logged transactions will stay in Activity but will no longer be linked to a tracker.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteTrackerMutation.mutate(),
        },
      ]
    );
  };

  const isBusy =
    addMutation.isPending ||
    endMutation.isPending ||
    deleteExpenseMutation.isPending ||
    deleteTrackerMutation.isPending;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => {
            if (typeof router.canGoBack === 'function' && router.canGoBack()) {
              router.back();
            } else {
              router.replace('/(tabs)/trackers');
            }
          }}
          accessibilityLabel="Go back"
        >
          <ArrowLeft size={20} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {tracker?.name || 'Tracker'}
        </Text>
        <View style={{ width: 34 }} />
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : isError || !tracker ? (
        <View style={styles.center}>
          <Text style={styles.errorTitle}>Could not load tracker</Text>
          <Text style={styles.errorSubtitle}>
            {(fetchError as any)?.message || 'Please try again.'}
          </Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Card style={styles.heroCard}>
            <View style={styles.heroTopRow}>
              <View
                style={[
                  styles.statusPill,
                  tracker.isActive ? styles.statusActive : styles.statusEnded,
                ]}
              >
                {tracker.isActive ? (
                  <Play size={10} color={theme.colors.primary} fill={theme.colors.primary} />
                ) : (
                  <CheckCircle2 size={11} color={theme.colors.textMuted} />
                )}
                <Text
                  style={[
                    styles.statusText,
                    { color: tracker.isActive ? theme.colors.primary : theme.colors.textMuted },
                  ]}
                >
                  {tracker.isActive ? 'ACTIVE' : 'ENDED'}
                </Text>
              </View>
              <Text style={styles.heroRange}>
                {shortDate(tracker.startedAt)} – {tracker.endedAt ? shortDate(tracker.endedAt) : 'now'}
              </Text>
            </View>

            <Text style={styles.heroName} numberOfLines={2}>
              {tracker.name}
            </Text>

            <Text style={styles.heroTotal} numberOfLines={1} adjustsFontSizeToFit>
              {formatPaiseToRupees(tracker.summary.totalPaise)}
            </Text>
            <Text style={styles.heroTotalLabel}>
              {tracker.isActive ? 'spent so far' : 'total spent'}
            </Text>

            <View style={styles.statsGrid}>
              <View style={styles.statBox}>
                <CalendarDays size={14} color={theme.colors.textMuted} />
                <Text style={styles.statValue}>{tracker.summary.durationDays}</Text>
                <Text style={styles.statLabel}>
                  {tracker.summary.durationDays === 1 ? 'day' : 'days'}
                </Text>
              </View>
              <View style={styles.statBox}>
                <TrendingDown size={14} color={theme.colors.textMuted} />
                <Text style={styles.statValue}>{tracker.summary.expenseCount}</Text>
                <Text style={styles.statLabel}>
                  {tracker.summary.expenseCount === 1 ? 'entry' : 'entries'}
                </Text>
              </View>
              <View style={styles.statBox}>
                <Clock size={14} color={theme.colors.textMuted} />
                <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
                  {formatPaiseToRupees(tracker.summary.averagePerDayPaise)}
                </Text>
                <Text style={styles.statLabel}>avg / day</Text>
              </View>
              <View style={styles.statBox}>
                <CalendarDays size={14} color={theme.colors.textMuted} />
                <Text style={styles.statValue}>{tracker.summary.activeDays}</Text>
                <Text style={styles.statLabel}>active days</Text>
              </View>
            </View>

            {tracker.isActive ? (
              <View style={styles.todayRow}>
                <Text style={styles.todayLabel}>Today</Text>
                <Text style={styles.todayAmount}>
                  {formatPaiseToRupees(todaySpentPaise || '0')}
                </Text>
              </View>
            ) : tracker.summary.highestSpendDay ? (
              <View style={styles.todayRow}>
                <Text style={styles.todayLabel}>Highest day</Text>
                <Text style={styles.todayAmount}>
                  {formatPaiseToRupees(tracker.summary.highestSpendDay.totalPaise)} ·{' '}
                  {tracker.summary.highestSpendDay.label}
                </Text>
              </View>
            ) : null}

            {tracker.isActive ? (
              <>
                <View style={styles.composer}>
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
                      keyboardType="decimal-pad"
                      editable={!isBusy}
                    />
                  </View>
                  <View style={styles.composerDivider} />
                  <TextInput
                    style={styles.descInput}
                    placeholder="What did you spend on?"
                    placeholderTextColor={theme.colors.textMuted}
                    value={description}
                    onChangeText={(text) => {
                      setDescription(text);
                      setError(null);
                    }}
                    editable={!isBusy}
                    onSubmitEditing={() => addMutation.mutate()}
                  />
                  <TouchableOpacity
                    style={[styles.addBtn, isBusy && { opacity: 0.6 }]}
                    onPress={() => addMutation.mutate()}
                    disabled={isBusy}
                    activeOpacity={0.85}
                  >
                    {addMutation.isPending ? (
                      <ActivityIndicator size="small" color={theme.colors.textInverse} />
                    ) : (
                      <Plus size={18} color={theme.colors.textInverse} />
                    )}
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={styles.endBtn}
                  onPress={confirmEnd}
                  disabled={isBusy}
                  activeOpacity={0.85}
                >
                  <Square size={13} color={theme.colors.expense} />
                  <Text style={styles.endBtnText}>End tracker & see summary</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity
                style={styles.deleteTrackerBtn}
                onPress={confirmDeleteTracker}
                disabled={isBusy}
                activeOpacity={0.8}
              >
                <Trash2 size={13} color={theme.colors.danger} />
                <Text style={styles.deleteTrackerText}>Delete tracker</Text>
              </TouchableOpacity>
            )}

            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            {success ? (
              <View style={styles.successRow}>
                <CheckCircle2 size={13} color={theme.colors.primary} />
                <Text style={styles.successText}>{success}</Text>
              </View>
            ) : null}
          </Card>

          <View style={styles.breakdownWrap}>
            <Text style={styles.sectionHeading}>Daily breakdown</Text>

            {groupedDays.length === 0 ? (
              <Card style={styles.emptyCard} variant="subtle">
                <Text style={styles.emptyTitle}>No expenses logged yet</Text>
                <Text style={styles.emptySubtitle}>
                  {tracker.isActive
                    ? 'Add your first amount above and it will be grouped by day here.'
                    : 'This tracker ended without any logged expenses.'}
                </Text>
              </Card>
            ) : (
              groupedDays.map((day) => (
                <Card key={day.key} style={styles.dayCard} variant="subtle">
                  <View style={styles.dayHeader}>
                    <Text style={styles.dayLabel}>{day.label}</Text>
                    <Text style={styles.dayTotal}>
                      {formatPaiseToRupees(day.totalPaise.toString())}
                    </Text>
                  </View>

                  {day.items.map((tx) => (
                    <View key={tx.id} style={styles.txRow}>
                      <View
                        style={[
                          styles.txDot,
                          { backgroundColor: tx.category?.color || theme.colors.expense },
                        ]}
                      />
                      <View style={styles.txInfo}>
                        <Text style={styles.txTitle} numberOfLines={1}>
                          {tx.merchantName || tx.description || 'Expense'}
                        </Text>
                        <Text style={styles.txMeta}>
                          {new Date(tx.date).toLocaleTimeString('en-IN', {
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                          {tx.category?.name ? ` · ${tx.category.name}` : ''}
                        </Text>
                      </View>
                      <Text style={styles.txAmount}>
                        -{formatPaiseToRupees(tx.amountPaise)}
                      </Text>
                      <TouchableOpacity
                        style={styles.txDelete}
                        onPress={() => confirmDeleteExpense(tx)}
                        disabled={isBusy}
                        accessibilityLabel="Delete expense"
                      >
                        <Trash2 size={14} color={theme.colors.textMuted} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </Card>
              ))
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const getStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    backBtn: {
      width: 34,
      height: 34,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    headerTitle: {
      flex: 1,
      textAlign: 'center',
      fontSize: 16,
      fontWeight: '700',
      color: theme.colors.textPrimary,
      marginHorizontal: 8,
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 32,
    },
    errorTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.colors.textPrimary,
    },
    errorSubtitle: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      marginTop: 6,
    },
    retryBtn: {
      marginTop: 16,
      paddingHorizontal: 18,
      paddingVertical: 9,
      borderRadius: 999,
      backgroundColor: theme.colors.primaryBg,
    },
    retryText: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.colors.primary,
    },
    scrollContent: {
      paddingHorizontal: 16,
      paddingBottom: 40,
    },
    heroCard: {
      padding: 18,
      borderRadius: 20,
    },
    heroTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    statusPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
    },
    statusActive: {
      backgroundColor: theme.colors.primaryBg,
    },
    statusEnded: {
      backgroundColor: theme.colors.surfaceAlt,
    },
    statusText: {
      fontSize: 9.5,
      fontWeight: '800',
      letterSpacing: 0.6,
    },
    heroRange: {
      fontSize: 11.5,
      fontWeight: '600',
      color: theme.colors.textMuted,
    },
    heroName: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.colors.textSecondary,
      marginTop: 12,
    },
    heroTotal: {
      fontSize: 40,
      fontWeight: '800',
      color: theme.colors.textPrimary,
      letterSpacing: -1.4,
      marginTop: 2,
    },
    heroTotalLabel: {
      fontSize: 11.5,
      fontWeight: '500',
      color: theme.colors.textMuted,
    },
    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 16,
    },
    statBox: {
      flexBasis: '47%',
      flexGrow: 1,
      padding: 10,
      borderRadius: 12,
      backgroundColor: theme.colors.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    statValue: {
      fontSize: 16,
      fontWeight: '800',
      color: theme.colors.textPrimary,
      marginTop: 6,
      letterSpacing: -0.3,
    },
    statLabel: {
      fontSize: 10,
      fontWeight: '600',
      color: theme.colors.textMuted,
      marginTop: 1,
    },
    todayRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 14,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    todayLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    todayAmount: {
      fontSize: 13.5,
      fontWeight: '800',
      color: theme.colors.expense,
    },
    composer: {
      flexDirection: 'row',
      alignItems: 'center',
      height: 50,
      marginTop: 14,
      paddingLeft: 12,
      paddingRight: 6,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surfaceAlt,
    },
    amountWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      width: 78,
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
      fontSize: 13,
      color: theme.colors.textPrimary,
      paddingVertical: 0,
      ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
    },
    addBtn: {
      width: 36,
      height: 36,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.primary,
      marginLeft: 8,
    },
    endBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      marginTop: 12,
      paddingVertical: 11,
      borderRadius: 12,
      backgroundColor: theme.colors.expenseBg,
      borderWidth: 1,
      borderColor: 'rgba(225, 29, 72, 0.25)',
    },
    endBtnText: {
      fontSize: 12.5,
      fontWeight: '700',
      color: theme.colors.expense,
    },
    deleteTrackerBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      marginTop: 14,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: theme.colors.dangerBg,
      borderWidth: 1,
      borderColor: 'rgba(220, 38, 38, 0.2)',
    },
    deleteTrackerText: {
      fontSize: 12.5,
      fontWeight: '700',
      color: theme.colors.danger,
    },
    errorText: {
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
    breakdownWrap: {
      marginTop: 22,
    },
    sectionHeading: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.colors.textPrimary,
      letterSpacing: -0.2,
      marginBottom: 10,
    },
    emptyCard: {
      alignItems: 'center',
      paddingVertical: 24,
      borderRadius: 14,
    },
    emptyTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.textSecondary,
    },
    emptySubtitle: {
      fontSize: 12,
      color: theme.colors.textMuted,
      marginTop: 4,
      textAlign: 'center',
      lineHeight: 18,
    },
    dayCard: {
      padding: 14,
      marginBottom: 10,
      borderRadius: 14,
    },
    dayHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    dayLabel: {
      fontSize: 12,
      fontWeight: '800',
      color: theme.colors.textPrimary,
      letterSpacing: -0.1,
    },
    dayTotal: {
      fontSize: 12.5,
      fontWeight: '800',
      color: theme.colors.expense,
    },
    txRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 7,
    },
    txDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      marginRight: 9,
    },
    txInfo: {
      flex: 1,
      marginRight: 8,
    },
    txTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.colors.textPrimary,
    },
    txMeta: {
      fontSize: 10.5,
      color: theme.colors.textMuted,
      marginTop: 1,
    },
    txAmount: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.colors.expense,
    },
    txDelete: {
      padding: 6,
      marginLeft: 4,
    },
  });
