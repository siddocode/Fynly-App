import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock,
  NotebookPen,
  Play,
  Plus,
  Sparkles,
  Square,
  TrendingDown,
} from 'lucide-react-native';
import { api, formatPaiseToRupees, rupeesToPaise } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import { useSafeRouter } from '../../hooks/useSafeRouter';
import { useTheme, Theme } from '../../lib/theme';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Header } from '../../components/Header';
import { SpendingTracker } from '../../types';

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

const rangeLabel = (tracker: SpendingTracker): string => {
  const start = shortDate(tracker.startedAt);
  const end = tracker.endedAt ? shortDate(tracker.endedAt) : 'now';
  return `${start} – ${end}`;
};

export default function TrackersScreen() {
  const router = useSafeRouter();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();
  const { theme } = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);

  const [newName, setNewName] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const {
    data: trackers,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['trackers'],
    queryFn: () => api.getTrackers('all'),
    enabled: isAuthenticated,
  });

  useFocusEffect(
    React.useCallback(() => {
      if (isAuthenticated) refetch();
    }, [isAuthenticated, refetch])
  );

  const activeTracker = trackers?.find((tracker) => tracker.isActive);
  const endedTrackers = trackers?.filter((tracker) => !tracker.isActive) || [];

  const todayKey = localDateKey(new Date());
  const todaySpentPaise = activeTracker?.summary.dailyBreakdown.find(
    (day) => day.date === todayKey
  )?.totalPaise;

  const invalidateAll = async (trackerId?: string) => {
    await Promise.all([
      queryClient.refetchQueries({ queryKey: ['trackers'], type: 'all' }),
      trackerId
        ? queryClient.refetchQueries({ queryKey: ['tracker', trackerId], type: 'all' })
        : Promise.resolve(),
      queryClient.refetchQueries({ queryKey: ['dashboard'], type: 'all' }),
      queryClient.refetchQueries({ queryKey: ['transactions'], type: 'all' }),
      queryClient.refetchQueries({ queryKey: ['accounts'], type: 'all' }),
      queryClient.refetchQueries({ queryKey: ['budgets'], type: 'all' }),
      queryClient.refetchQueries({ queryKey: ['insights'], type: 'all' }),
      queryClient.refetchQueries({ queryKey: ['insights-overview'], type: 'all' }),
      queryClient.refetchQueries({ queryKey: ['notifications'], type: 'all' }),
    ]);
  };

  const createMutation = useMutation({
    mutationFn: () =>
      api.createTracker({ name: newName.trim() || undefined }),
    onSuccess: async (created) => {
      setNewName('');
      setError(null);
      setSuccess('Tracker started');
      await invalidateAll(created.id);
      setTimeout(() => setSuccess(null), 2400);
    },
    onError: (err: any) => {
      setSuccess(null);
      setError(err?.message || 'Failed to start tracker');
    },
  });

  const addExpenseMutation = useMutation({
    mutationFn: async () => {
      if (!activeTracker) throw new Error('No active tracker');
      const amountPaise = rupeesToPaise(amount);
      if (amountPaise <= 0) throw new Error('Enter how much you spent');
      return api.addTrackerExpense(activeTracker.id, {
        amountPaise,
        description: description.trim() || undefined,
        allowDuplicate: true,
      });
    },
    onSuccess: async () => {
      setAmount('');
      setDescription('');
      setError(null);
      setSuccess('Expense added to tracker');
      await invalidateAll(activeTracker?.id);
      setTimeout(() => setSuccess(null), 2400);
    },
    onError: (err: any) => {
      setSuccess(null);
      setError(err?.message || 'Failed to add expense');
    },
  });

  const endMutation = useMutation({
    mutationFn: () => {
      if (!activeTracker) throw new Error('No active tracker');
      return api.endTracker(activeTracker.id);
    },
    onSuccess: async (ended) => {
      await invalidateAll(ended.id);
      router.push(`/tracker/${ended.id}`);
    },
    onError: (err: any) => {
      setError(err?.message || 'Failed to end tracker');
    },
  });

  const confirmEnd = () => {
    if (!activeTracker) return;
    if (Platform.OS === 'web') {
      if (window.confirm('End this tracker? You will see the final summary next.')) {
        endMutation.mutate();
      }
      return;
    }
    Alert.alert(
      'End Tracker',
      'End this tracker? You will see the final summary next.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'End Tracker', style: 'destructive', onPress: () => endMutation.mutate() },
      ]
    );
  };

  const isBusy =
    createMutation.isPending || addExpenseMutation.isPending || endMutation.isPending;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header title="Tracker" subtitle="Spend sessions without a budget" />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          isAuthenticated ? (
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => {
                refetch();
              }}
              tintColor={theme.colors.primary}
            />
          ) : undefined
        }
      >
        {!isAuthenticated ? (
          <Card style={styles.guestCard}>
            <View style={styles.guestIcon}>
              <NotebookPen size={22} color={theme.colors.primary} />
            </View>
            <Text style={styles.guestTitle}>Track spending your way</Text>
            <Text style={styles.guestText}>
              Start a tracker, add expenses whenever you spend, and see the total over the days
              you used it. No budget required.
            </Text>
            <Button
              title="Sign In / Register"
              onPress={() => router.push('/auth')}
              style={{ marginTop: 16 }}
            />
          </Card>
        ) : isLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        ) : (
          <>
            {activeTracker ? (
              <Card style={styles.activeCard}>
                <View style={styles.activeTopRow}>
                  <View style={styles.activePill}>
                    <Play size={10} color={theme.colors.primary} fill={theme.colors.primary} />
                    <Text style={styles.activePillText}>ACTIVE</Text>
                  </View>
                  <Text style={styles.rangeText}>{rangeLabel(activeTracker)}</Text>
                </View>

                <Text style={styles.trackerName} numberOfLines={1}>
                  {activeTracker.name}
                </Text>

                <Text style={styles.activeTotal} numberOfLines={1} adjustsFontSizeToFit>
                  {formatPaiseToRupees(activeTracker.summary.totalPaise)}
                </Text>
                <Text style={styles.totalLabel}>total spent so far</Text>

                <View style={styles.metaRow}>
                  <View style={styles.metaItem}>
                    <CalendarDays size={13} color={theme.colors.textMuted} />
                    <Text style={styles.metaText}>
                      {activeTracker.summary.durationDays}{' '}
                      {activeTracker.summary.durationDays === 1 ? 'day' : 'days'}
                    </Text>
                  </View>
                  <View style={styles.metaItem}>
                    <TrendingDown size={13} color={theme.colors.textMuted} />
                    <Text style={styles.metaText}>
                      {activeTracker.summary.expenseCount}{' '}
                      {activeTracker.summary.expenseCount === 1 ? 'entry' : 'entries'}
                    </Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Clock size={13} color={theme.colors.textMuted} />
                    <Text style={styles.metaText}>
                      {formatPaiseToRupees(activeTracker.summary.averagePerDayPaise)}/day
                    </Text>
                  </View>
                </View>

                <View style={styles.todayRow}>
                  <Text style={styles.todayLabel}>Today</Text>
                  <Text style={styles.todayAmount}>
                    {formatPaiseToRupees(todaySpentPaise || '0')}
                  </Text>
                </View>

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
                    onSubmitEditing={() => addExpenseMutation.mutate()}
                  />
                  <TouchableOpacity
                    style={[styles.addBtn, isBusy && { opacity: 0.6 }]}
                    onPress={() => addExpenseMutation.mutate()}
                    disabled={isBusy}
                    activeOpacity={0.85}
                  >
                    {addExpenseMutation.isPending ? (
                      <ActivityIndicator size="small" color={theme.colors.textInverse} />
                    ) : (
                      <Plus size={18} color={theme.colors.textInverse} />
                    )}
                  </TouchableOpacity>
                </View>

                {error ? <Text style={styles.errorText}>{error}</Text> : null}
                {success ? (
                  <View style={styles.successRow}>
                    <CheckCircle2 size={13} color={theme.colors.primary} />
                    <Text style={styles.successText}>{success}</Text>
                  </View>
                ) : null}

                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={styles.openBtn}
                    onPress={() => router.push(`/tracker/${activeTracker.id}`)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.openBtnText}>View details</Text>
                    <ChevronRight size={14} color={theme.colors.primary} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.endBtn}
                    onPress={confirmEnd}
                    disabled={isBusy}
                    activeOpacity={0.8}
                  >
                    <Square size={12} color={theme.colors.expense} />
                    <Text style={styles.endBtnText}>End tracker</Text>
                  </TouchableOpacity>
                </View>
              </Card>
            ) : (
              <Card style={styles.startCard}>
                <View style={styles.startIcon}>
                  <Sparkles size={20} color={theme.colors.primary} />
                </View>
                <Text style={styles.startTitle}>Start a spending tracker</Text>
                <Text style={styles.startText}>
                  Open it whenever you spend, add the amount, and let it accumulate over days.
                  End it anytime to see the full summary.
                </Text>

                <TextInput
                  style={styles.nameInput}
                  placeholder="Tracker name (optional)"
                  placeholderTextColor={theme.colors.textMuted}
                  value={newName}
                  onChangeText={(text) => {
                    setNewName(text);
                    setError(null);
                  }}
                  editable={!isBusy}
                  maxLength={80}
                />

                {error ? <Text style={styles.errorText}>{error}</Text> : null}
                {success ? (
                  <View style={styles.successRow}>
                    <CheckCircle2 size={13} color={theme.colors.primary} />
                    <Text style={styles.successText}>{success}</Text>
                  </View>
                ) : null}

                <Button
                  title="Start tracking"
                  onPress={() => createMutation.mutate()}
                  loading={createMutation.isPending}
                  disabled={isBusy}
                  icon={<Play size={14} color={theme.colors.textInverse} />}
                  style={{ marginTop: 14 }}
                />
              </Card>
            )}

            {endedTrackers.length > 0 ? (
              <View style={styles.historyWrap}>
                <Text style={styles.sectionHeading}>Past trackers</Text>
                {endedTrackers.map((tracker) => (
                  <TouchableOpacity
                    key={tracker.id}
                    style={styles.historyCard}
                    activeOpacity={0.8}
                    onPress={() => router.push(`/tracker/${tracker.id}`)}
                  >
                    <View style={styles.historyIcon}>
                      <NotebookPen size={16} color={theme.colors.textSecondary} />
                    </View>
                    <View style={styles.historyInfo}>
                      <Text style={styles.historyName} numberOfLines={1}>
                        {tracker.name}
                      </Text>
                      <Text style={styles.historyMeta}>
                        {rangeLabel(tracker)} · {tracker.summary.durationDays}{' '}
                        {tracker.summary.durationDays === 1 ? 'day' : 'days'} ·{' '}
                        {tracker.summary.expenseCount}{' '}
                        {tracker.summary.expenseCount === 1 ? 'entry' : 'entries'}
                      </Text>
                    </View>
                    <View style={styles.historyRight}>
                      <Text style={styles.historyTotal}>
                        {formatPaiseToRupees(tracker.summary.totalPaise)}
                      </Text>
                      <ChevronRight size={14} color={theme.colors.textMuted} />
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}

            {!activeTracker && endedTrackers.length === 0 ? (
              <Text style={styles.emptyHint}>
                No trackers yet. Start one above to begin logging everyday spending.
              </Text>
            ) : null}
          </>
        )}
      </ScrollView>
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
      paddingHorizontal: 16,
      paddingBottom: 40,
    },
    loadingWrap: {
      paddingVertical: 80,
      alignItems: 'center',
    },
    guestCard: {
      marginTop: 8,
      padding: 24,
      borderRadius: 20,
      alignItems: 'center',
    },
    guestIcon: {
      width: 48,
      height: 48,
      borderRadius: 14,
      backgroundColor: theme.colors.primaryBg,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 14,
    },
    guestTitle: {
      fontSize: 20,
      fontWeight: '800',
      color: theme.colors.textPrimary,
      letterSpacing: -0.4,
      textAlign: 'center',
    },
    guestText: {
      fontSize: 13,
      lineHeight: 19,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      marginTop: 8,
    },
    activeCard: {
      marginTop: 4,
      padding: 18,
      borderRadius: 20,
    },
    activeTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    activePill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
      backgroundColor: theme.colors.primaryBg,
    },
    activePillText: {
      fontSize: 9.5,
      fontWeight: '800',
      color: theme.colors.primary,
      letterSpacing: 0.6,
    },
    rangeText: {
      fontSize: 11.5,
      fontWeight: '600',
      color: theme.colors.textMuted,
    },
    trackerName: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.colors.textSecondary,
      marginTop: 12,
    },
    activeTotal: {
      fontSize: 38,
      fontWeight: '800',
      color: theme.colors.textPrimary,
      letterSpacing: -1.2,
      marginTop: 2,
    },
    totalLabel: {
      fontSize: 11.5,
      fontWeight: '500',
      color: theme.colors.textMuted,
    },
    metaRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      marginTop: 14,
    },
    metaItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    metaText: {
      fontSize: 11.5,
      fontWeight: '600',
      color: theme.colors.textSecondary,
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
      fontSize: 14,
      fontWeight: '800',
      color: theme.colors.expense,
    },
    composer: {
      flexDirection: 'row',
      alignItems: 'center',
      height: 50,
      marginTop: 12,
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
    actionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 14,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    openBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
    },
    openBtnText: {
      fontSize: 12.5,
      fontWeight: '700',
      color: theme.colors.primary,
    },
    endBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 999,
      backgroundColor: theme.colors.expenseBg,
      borderWidth: 1,
      borderColor: 'rgba(225, 29, 72, 0.25)',
    },
    endBtnText: {
      fontSize: 11.5,
      fontWeight: '700',
      color: theme.colors.expense,
    },
    startCard: {
      marginTop: 4,
      padding: 20,
      borderRadius: 20,
    },
    startIcon: {
      width: 42,
      height: 42,
      borderRadius: 13,
      backgroundColor: theme.colors.primaryBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    startTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: theme.colors.textPrimary,
      letterSpacing: -0.4,
      marginTop: 12,
    },
    startText: {
      fontSize: 12.5,
      lineHeight: 18,
      color: theme.colors.textSecondary,
      marginTop: 6,
    },
    nameInput: {
      marginTop: 14,
      height: 46,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surfaceAlt,
      paddingHorizontal: 13,
      fontSize: 14,
      color: theme.colors.textPrimary,
      ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
    },
    historyWrap: {
      marginTop: 22,
    },
    sectionHeading: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.colors.textPrimary,
      letterSpacing: -0.2,
      marginBottom: 10,
    },
    historyCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 13,
      borderRadius: 14,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.surfaceBorder,
      marginBottom: 8,
    },
    historyIcon: {
      width: 34,
      height: 34,
      borderRadius: 10,
      backgroundColor: theme.colors.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 11,
    },
    historyInfo: {
      flex: 1,
      marginRight: 8,
    },
    historyName: {
      fontSize: 13.5,
      fontWeight: '700',
      color: theme.colors.textPrimary,
    },
    historyMeta: {
      fontSize: 10.5,
      fontWeight: '500',
      color: theme.colors.textMuted,
      marginTop: 2,
    },
    historyRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
    },
    historyTotal: {
      fontSize: 13.5,
      fontWeight: '800',
      color: theme.colors.textPrimary,
    },
    emptyHint: {
      fontSize: 12,
      color: theme.colors.textMuted,
      textAlign: 'center',
      marginTop: 20,
      lineHeight: 18,
    },
  });
