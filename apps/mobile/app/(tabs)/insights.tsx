import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeRouter } from '../../hooks/useSafeRouter';
import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp,
  TrendingDown,
  Repeat,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  Layers,
  CreditCard,
  ShieldCheck,
  Calendar,
  AlertCircle,
  ShoppingBag,
} from 'lucide-react-native';
import { api, formatPaiseToRupees } from '../../lib/api';
import { useTheme, Theme } from '../../lib/theme';
import { Header } from '../../components/Header';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { useAuth } from '../../hooks/useAuth';

export default function InsightsScreen() {
  const router = useSafeRouter();
  const { isAuthenticated } = useAuth();
  const { theme } = useTheme();
  const styles = React.useMemo(() => getStyles(theme), [theme]);
  const [refreshing, setRefreshing] = useState(false);

  const currentMonthCode = React.useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const [selectedMonthStr, setSelectedMonthStr] = useState<string>(currentMonthCode);

  const availableMonths = React.useMemo(() => {
    const list = [];
    const now = new Date();
    // 2 months in the future down to 4 months in the past
    for (let i = -2; i <= 4; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const code = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleString('en-IN', { month: 'short', year: 'numeric' });
      list.push({ code, label, isCurrent: i === 0 });
    }
    return list;
  }, []);

  // Queries for Insights Overview, Recurring Subscriptions, and Bank Sync Status
  const {
    data: overview,
    isLoading: isLoadingOverview,
    refetch: refetchOverview,
  } = useQuery({
    queryKey: ['insights-overview', selectedMonthStr],
    queryFn: () => api.getInsightsOverview(selectedMonthStr),
    enabled: isAuthenticated,
  });

  const {
    data: recurringData,
    isLoading: isLoadingRecurring,
    refetch: refetchRecurring,
  } = useQuery({
    queryKey: ['recurring-subscriptions'],
    queryFn: () => api.getRecurringSubscriptions(),
    enabled: isAuthenticated,
  });

  const {
    data: bankStatus,
    isLoading: isLoadingBank,
    refetch: refetchBank,
  } = useQuery({
    queryKey: ['bank-sync-status'],
    queryFn: () => api.getBankSyncStatus(),
    enabled: isAuthenticated,
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchOverview(), refetchRecurring(), refetchBank()]);
    setRefreshing(false);
  };

  const isLoading = isLoadingOverview || isLoadingRecurring || isLoadingBank;

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Header title="Insights" subtitle="Trends & Financial Intelligence" />
        <View style={styles.centerContainer}>
          <Card style={styles.authPromptCard} variant="subtle">
            <Zap size={44} color={theme.colors.primary} />
            <Text style={styles.authPromptTitle}>Financial Intelligence Locked</Text>
            <Text style={styles.authPromptDesc}>
              Sign in to unlock spending velocity, automated subscription detection, and multi-week trend forecasts.
            </Text>
            <Button
              title="Sign In to Fynly"
              onPress={() => router.push('/auth')}
              style={{ marginTop: theme.spacing.md }}
            />
          </Card>
        </View>
      </SafeAreaView>
    );
  }

  const summary = overview?.summary;
  const forecast = overview?.forecast;
  const period = overview?.period;
  const categories = overview?.categories || [];
  const topMerchants = overview?.topMerchants || [];
  const weeklyBreakdown = overview?.weeklyBreakdown || [];
  const subscriptions = recurringData?.subscriptions || [];
  const totalMonthlyCommitmentPaise = recurringData?.totalMonthlyCommitmentPaise || '0';

  // Calculate highest weekly spend for proportional bar heights
  const maxWeeklySpent = Math.max(
    ...weeklyBreakdown.map((w) => Number(w.spentPaise)),
    100000 // default minimum to avoid 0 div
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header
        title="Financial Intelligence"
        subtitle={period?.monthLabel || 'Analytics & Spending Trends'}
      />

      {/* Month Selector Bar */}
      <View style={styles.monthFilterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.monthFilterScroll}>
          {availableMonths.map((m) => {
            const isSel = selectedMonthStr === m.code;
            return (
              <TouchableOpacity
                key={m.code}
                style={[styles.monthFilterPill, isSel && styles.monthFilterPillActive]}
                onPress={() => setSelectedMonthStr(m.code)}
                activeOpacity={0.75}
              >
                <Text style={[styles.monthFilterPillText, isSel && styles.monthFilterPillTextActive]}>
                  {m.label}
                </Text>
                {m.isCurrent && (
                  <View style={[styles.monthFilterBadge, isSel && styles.monthFilterBadgeActive]}>
                    <Text style={[styles.monthFilterBadgeText, isSel && styles.monthFilterBadgeTextActive]}>
                      Now
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
          />
        }
      >
        {isLoading && !refreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={styles.loadingText}>Analyzing financial intelligence...</Text>
          </View>
        ) : (
          <>
            {/* 1. Month-over-Month & Savings Executive Summary */}
            <Card style={styles.summaryCard}>
              <View style={styles.cardHeader}>
                <View style={styles.summaryLeft}>
                  <Text style={styles.sectionOverline}>EXECUTIVE SUMMARY</Text>
                  <Text style={styles.mainSpendValue} numberOfLines={1} adjustsFontSizeToFit>
                    {formatPaiseToRupees(summary?.currentMonthSpentPaise || '0')}
                  </Text>
                  <Text style={styles.mainSpendLabel}>Total Spending This Month</Text>
                </View>

                {summary?.monthOverMonth && (
                  <View
                    style={[
                      styles.momPill,
                      summary.monthOverMonth.direction === 'DECREASED'
                        ? styles.momPillPositive
                        : styles.momPillNegative,
                    ]}
                  >
                    {summary.monthOverMonth.direction === 'DECREASED' ? (
                      <ArrowDownRight size={14} color={theme.colors.primary} />
                    ) : (
                      <ArrowUpRight size={14} color={theme.colors.expense} />
                    )}
                    <Text
                      style={[
                        styles.momPillText,
                        {
                          color:
                            summary.monthOverMonth.direction === 'DECREASED'
                              ? theme.colors.primary
                              : theme.colors.expense,
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {Math.abs(summary.monthOverMonth.percentageChange)}% vs last mo
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.divider} />

              <View style={styles.summaryMetricsRow}>
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel} numberOfLines={1}>Income Received</Text>
                  <Text style={[styles.metricValue, { color: theme.colors.income }]} numberOfLines={1} adjustsFontSizeToFit>
                    {formatPaiseToRupees(summary?.currentMonthIncomePaise || '0')}
                  </Text>
                </View>

                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel} numberOfLines={1}>Net Savings</Text>
                  <Text
                    style={[
                      styles.metricValue,
                      {
                        color:
                          BigInt(summary?.netSavingsPaise || '0') >= 0n
                            ? theme.colors.primary
                            : theme.colors.expense,
                      },
                    ]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    {formatPaiseToRupees(summary?.netSavingsPaise || '0')}
                  </Text>
                </View>

                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel} numberOfLines={1}>Savings Rate</Text>
                  <Text style={[styles.metricValue, { color: theme.colors.info }]} numberOfLines={1} adjustsFontSizeToFit>
                    {summary?.savingsRatePercentage || 0}%
                  </Text>
                </View>
              </View>
            </Card>

            {/* 2. Spending Velocity & Month-End Forecast */}
            <Card style={styles.forecastCard}>
              <View style={styles.sectionHeaderRow}>
                <View style={styles.sectionTitleWithIcon}>
                  <Zap size={18} color={theme.colors.warning} />
                  <Text style={styles.sectionTitle} numberOfLines={1}>Spending Velocity & Forecast</Text>
                </View>
                <Badge
                  label={`${period?.remainingDays || 0}d left`}
                  variant="muted"
                />
              </View>

              <View style={styles.forecastGrid}>
                <View style={styles.forecastMetric}>
                  <Text style={styles.forecastLabel} numberOfLines={1}>Daily Burn Rate</Text>
                  <Text style={styles.forecastValue} numberOfLines={1} adjustsFontSizeToFit>
                    {formatPaiseToRupees(forecast?.dailyBurnRatePaise || '0')}
                    <Text style={styles.unitText}>/day</Text>
                  </Text>
                </View>

                <View style={styles.forecastMetric}>
                  <Text style={styles.forecastLabel} numberOfLines={1}>Projected Month-End</Text>
                  <Text style={styles.forecastValue} numberOfLines={1} adjustsFontSizeToFit>
                    {formatPaiseToRupees(forecast?.projectedMonthEndSpendPaise || '0')}
                  </Text>
                </View>
              </View>

              {forecast?.budgetLimitPaise && (
                <View style={styles.forecastBudgetStatus}>
                  <Text style={styles.forecastStatusText}>
                    {forecast.isProjectedWithinBudget
                      ? `Projected to stay within budget by ${formatPaiseToRupees(
                          forecast.projectedVariancePaise || '0'
                        )}.`
                      : `Warning: At current velocity, projected to exceed budget by ${formatPaiseToRupees(
                          BigInt(forecast.projectedVariancePaise || '0') < 0n
                            ? (-BigInt(forecast.projectedVariancePaise || '0')).toString()
                            : forecast.projectedVariancePaise || '0'
                        )}.`}
                  </Text>
                </View>
              )}
            </Card>

            {/* 3. Weekly Spending Trajectory */}
            <Card style={styles.chartCard}>
              <View style={styles.sectionHeaderRow}>
                <View style={styles.sectionTitleWithIcon}>
                  <Calendar size={18} color={theme.colors.info} />
                  <Text style={styles.sectionTitle} numberOfLines={1}>Weekly Trajectory</Text>
                </View>
                <Text style={styles.chartSubtitle} numberOfLines={1}>Across month</Text>
              </View>

              <View style={styles.barChartContainer}>
                {weeklyBreakdown.map((week) => {
                  const spentNum = Number(week.spentPaise);
                  const barHeightRatio = Math.max(0.08, spentNum / maxWeeklySpent);
                  return (
                    <View key={week.weekIndex} style={styles.barColumn}>
                      <Text style={styles.barValueText} numberOfLines={1} adjustsFontSizeToFit>
                        {spentNum > 0 ? `₹${Math.round(spentNum / 100)}` : '₹0'}
                      </Text>
                      <View style={styles.barTrack}>
                        <View
                          style={[
                            styles.barFill,
                            {
                              height: `${Math.round(barHeightRatio * 100)}%`,
                              backgroundColor:
                                week.weekIndex === 1
                                  ? theme.colors.info
                                  : week.weekIndex === 2
                                  ? theme.colors.primary
                                  : week.weekIndex === 3
                                  ? theme.colors.warning
                                  : theme.colors.accent,
                            },
                          ]}
                        />
                      </View>
                      <Text style={styles.barLabel}>W{week.weekIndex}</Text>
                    </View>
                  );
                })}
              </View>
            </Card>

            {/* 4. Category Breakdown Distribution */}
            <Card style={styles.card}>
              <View style={styles.sectionHeaderRow}>
                <View style={styles.sectionTitleWithIcon}>
                  <Layers size={18} color={theme.colors.accent} />
                  <Text style={styles.sectionTitle} numberOfLines={1}>Category Distribution</Text>
                </View>
                <Text style={styles.categoryCountBadge}>{categories.length} categories</Text>
              </View>

              {/* Proportional distribution bar - shown only when spending > 0 */}
              {categories.length > 0 && BigInt(summary?.currentMonthSpentPaise || '0') > 0n && (
                <View style={styles.proportionalBarContainer}>
                  {categories.map((cat, idx) => (
                    <View
                      key={cat.id || idx}
                      style={[
                        styles.proportionalSegment,
                        {
                          flex: Math.max(cat.percentage, 2),
                          backgroundColor: cat.color || theme.colors.surfaceBorder,
                        },
                      ]}
                    />
                  ))}
                </View>
              )}

              {categories.length === 0 || BigInt(summary?.currentMonthSpentPaise || '0') === 0n ? (
                <Text style={styles.emptyText}>No expenses recorded for this month.</Text>
              ) : (
                <View style={styles.categoryList}>
                  {categories.map((cat) => (
                    <TouchableOpacity
                      key={cat.id}
                      style={styles.categoryRow}
                      onPress={() => router.push({ pathname: '/activity', params: { search: cat.name } })}
                      activeOpacity={0.75}
                    >
                      <View style={styles.categoryInfoLeft}>
                        <View
                          style={[
                            styles.colorDot,
                            { backgroundColor: cat.color || theme.colors.textMuted },
                          ]}
                        />
                        <Text style={styles.categoryName} numberOfLines={1}>
                          {cat.name}
                        </Text>
                        <Text style={styles.categoryCount}>({cat.count})</Text>
                      </View>

                      <View style={styles.categoryInfoRight}>
                        <Text style={styles.categoryAmount} numberOfLines={1} adjustsFontSizeToFit>
                          {formatPaiseToRupees(cat.spentPaise)}
                        </Text>
                        <Badge label={`${cat.percentage}%`} variant="muted" />
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </Card>

            {/* 5. Top Merchants */}
            <Card style={styles.card}>
              <View style={styles.sectionHeaderRow}>
                <View style={styles.sectionTitleWithIcon}>
                  <ShoppingBag size={18} color={theme.colors.expense} />
                  <Text style={styles.sectionTitle} numberOfLines={1}>Top Merchants</Text>
                </View>
                <Text style={styles.chartSubtitle} numberOfLines={1}>Highest destinations</Text>
              </View>

              {topMerchants.length === 0 ? (
                <Text style={styles.emptyText}>No merchant spending recorded yet.</Text>
              ) : (
                <View style={styles.merchantList}>
                  {topMerchants.map((merchant, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.merchantRow}
                      onPress={() => router.push({ pathname: '/activity', params: { search: merchant.name } })}
                      activeOpacity={0.75}
                    >
                      <View style={styles.merchantRankBadge}>
                        <Text style={styles.merchantRankText}>#{index + 1}</Text>
                      </View>
                      <View style={styles.merchantDetails}>
                        <Text style={styles.merchantName} numberOfLines={1}>{merchant.name}</Text>
                        <Text style={styles.merchantMeta} numberOfLines={1}>
                          {merchant.count} txn{merchant.count > 1 ? 's' : ''} •{' '}
                          {merchant.percentage}% of total
                        </Text>
                      </View>
                      <Text style={styles.merchantAmount} numberOfLines={1} adjustsFontSizeToFit>
                        {formatPaiseToRupees(merchant.spentPaise)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </Card>

            {/* 6. Detected Recurring Subscriptions & Bills */}
            <Card style={styles.card}>
              <View style={styles.sectionHeaderRow}>
                <View style={styles.sectionTitleWithIcon}>
                  <Repeat size={18} color={theme.colors.primary} />
                  <Text style={styles.sectionTitle} numberOfLines={1}>Recurring Subscriptions & Bills</Text>
                </View>
                <Badge
                  label={
                    BigInt(totalMonthlyCommitmentPaise) > 0n
                      ? `${formatPaiseToRupees(totalMonthlyCommitmentPaise)}/mo`
                      : '0 Active'
                  }
                  variant="success"
                />
              </View>

              <Text style={styles.subscriptionHelperText}>
                Detected automatically from periodic cadence and consistent amount heuristics.
              </Text>

              {subscriptions.length === 0 ? (
                <View style={styles.emptySubscriptionBox}>
                  <Repeat size={24} color={theme.colors.textMuted} />
                  <Text style={styles.emptySubscriptionText}>
                    No repeating subscriptions detected yet. Regular monthly payments will appear here automatically.
                  </Text>
                </View>
              ) : (
                <View style={styles.subscriptionList}>
                  {subscriptions.map((sub) => (
                    <View key={sub.id} style={styles.subscriptionItem}>
                      <View style={styles.subIconBadge}>
                        <Repeat size={16} color={theme.colors.primary} />
                      </View>

                      <View style={styles.subDetails}>
                        <View style={styles.subNameRow}>
                          <Text style={styles.subMerchantName} numberOfLines={1}>{sub.merchantName}</Text>
                          <Badge label={sub.cadence} variant="muted" />
                        </View>
                        <Text style={styles.subMeta} numberOfLines={1}>
                          Next due in {sub.daysUntilDue} day{sub.daysUntilDue === 1 ? '' : 's'} •{' '}
                          {sub.occurrencesCount} cycles verified
                        </Text>
                      </View>

                      <Text style={styles.subAmount} numberOfLines={1} adjustsFontSizeToFit>
                        {formatPaiseToRupees(sub.amountPaise)}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </Card>

            {/* 7. Bank Connectivity & RBI Account Aggregator Gateway */}
            <Card style={styles.bankCard}>
              <View style={styles.sectionHeaderRow}>
                <View style={styles.sectionTitleWithIcon}>
                  <ShieldCheck size={20} color={theme.colors.primary} />
                  <Text style={styles.sectionTitle} numberOfLines={1}>Bank Connectivity & AA</Text>
                </View>
                <Badge
                  label={bankStatus?.isConfigured ? 'Connected' : 'AA Ready'}
                  variant="success"
                />
              </View>

              <Text style={styles.bankStatusDesc}>
                {bankStatus?.message ||
                  'Fynly connects securely through the RBI Account Aggregator (AA) framework. We never request or store your bank passwords, net banking credentials, or UPI PINs.'}
              </Text>

              <View style={styles.supportedBanksRow}>
                {(bankStatus?.supportedInstitutions || []).slice(0, 4).map((inst) => (
                  <View key={inst.id} style={styles.bankChip}>
                    <CreditCard size={12} color={theme.colors.textSecondary} />
                    <Text style={styles.bankChipText} numberOfLines={1}>{inst.name}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.bankActionRow}>
                <Button
                  title="Import Bank Statement CSV"
                  variant="outline"
                  size="sm"
                  onPress={() => router.push('/import-statement')}
                  icon={<CreditCard size={14} color={theme.colors.primary} />}
                  style={{ flex: 1 }}
                />
              </View>
            </Card>
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
      padding: 16,
      paddingBottom: 48,
      gap: 16,
    },
    monthFilterContainer: {
      backgroundColor: theme.colors.background,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      paddingVertical: 10,
    },
    monthFilterScroll: {
      paddingHorizontal: 16,
      gap: 8,
    },
    monthFilterPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 10,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      flexShrink: 0,
    },
    monthFilterPillActive: {
      backgroundColor: theme.colors.primaryBg,
      borderColor: theme.colors.primary,
    },
    monthFilterPillText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.textSecondary,
    },
    monthFilterPillTextActive: {
      color: theme.colors.primary,
      fontWeight: '700',
    },
    monthFilterBadge: {
      backgroundColor: theme.colors.surfaceAlt,
      paddingHorizontal: 5,
      paddingVertical: 1,
      borderRadius: 4,
    },
    monthFilterBadgeActive: {
      backgroundColor: theme.colors.primary,
    },
    monthFilterBadgeText: {
      fontSize: 8.5,
      fontWeight: '800',
      color: theme.colors.textMuted,
    },
    monthFilterBadgeTextActive: {
      color: '#ffffff',
    },
    loadingContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 48,
      gap: 12,
    },
    loadingText: {
      fontSize: 13,
      fontWeight: '500',
      color: theme.colors.textSecondary,
    },
    centerContainer: {
      flex: 1,
      justifyContent: 'center',
      padding: 20,
    },
    authPromptCard: {
      alignItems: 'center',
      padding: 28,
      gap: 14,
      borderRadius: 20,
    },
    authPromptTitle: {
      fontSize: 20,
      fontWeight: '800',
      letterSpacing: -0.3,
      color: theme.colors.textPrimary,
      textAlign: 'center',
    },
    authPromptDesc: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
    },
    summaryCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: 20,
      padding: 20,
      borderWidth: 1,
      borderColor: theme.colors.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.16,
      shadowRadius: 12,
      elevation: 4,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    summaryLeft: {
      flex: 1,
      minWidth: 0,
      marginRight: 8,
    },
    sectionOverline: {
      fontSize: 11,
      fontWeight: '800',
      color: theme.colors.primary,
      letterSpacing: 1.2,
      marginBottom: 6,
      textTransform: 'uppercase',
    },
    mainSpendValue: {
      fontSize: 30,
      fontWeight: '800',
      letterSpacing: -0.8,
      color: theme.colors.textPrimary,
    },
    mainSpendLabel: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginTop: 3,
      fontWeight: '500',
    },
    momPill: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 9,
      paddingVertical: 5,
      borderRadius: 999,
      gap: 4,
      borderWidth: 1,
      flexShrink: 0,
    },
    momPillPositive: {
      backgroundColor: theme.colors.primaryBg,
      borderColor: 'rgba(16, 185, 129, 0.3)',
    },
    momPillNegative: {
      backgroundColor: theme.colors.dangerBg,
      borderColor: 'rgba(251, 113, 133, 0.3)',
    },
    momPillText: {
      fontSize: 10.5,
      fontWeight: '700',
    },
    divider: {
      height: 1,
      backgroundColor: theme.colors.border,
      marginVertical: 16,
      opacity: 0.8,
    },
    summaryMetricsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 6,
    },
    metricItem: {
      flex: 1,
      minWidth: 0,
      backgroundColor: theme.colors.surfaceAlt,
      paddingVertical: 10,
      paddingHorizontal: 6,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
      minHeight: 68,
      justifyContent: 'center',
    },
    metricLabel: {
      fontSize: 10,
      color: theme.colors.textSecondary,
      marginBottom: 3,
      fontWeight: '600',
    },
    metricValue: {
      fontSize: 13,
      fontWeight: '800',
      letterSpacing: -0.2,
    },
    forecastCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: 20,
      padding: 20,
      gap: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.12,
      shadowRadius: 8,
      elevation: 3,
    },
    sectionHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    sectionTitleWithIcon: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flex: 1,
      minWidth: 0,
      marginRight: 6,
    },
    sectionTitle: {
      fontSize: 15,
      fontWeight: '700',
      letterSpacing: -0.2,
      color: theme.colors.textPrimary,
      flexShrink: 1,
    },
    forecastGrid: {
      flexDirection: 'row',
      gap: 12,
      backgroundColor: theme.colors.surfaceAlt,
      padding: 14,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    forecastMetric: {
      flex: 1,
      minWidth: 0,
    },
    forecastLabel: {
      fontSize: 11,
      color: theme.colors.textSecondary,
      marginBottom: 4,
      fontWeight: '600',
    },
    forecastValue: {
      fontSize: 16,
      fontWeight: '800',
      letterSpacing: -0.3,
      color: theme.colors.textPrimary,
    },
    unitText: {
      fontSize: 11,
      color: theme.colors.textMuted,
      fontWeight: '500',
    },
    forecastBudgetStatus: {
      paddingTop: 2,
    },
    forecastStatusText: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      lineHeight: 18,
      fontWeight: '500',
    },
    chartCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: 20,
      padding: 20,
      gap: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.12,
      shadowRadius: 8,
      elevation: 3,
    },
    chartSubtitle: {
      fontSize: 11,
      color: theme.colors.textSecondary,
      fontWeight: '500',
      flexShrink: 0,
    },
    barChartContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      height: 140,
      paddingTop: 14,
    },
    barColumn: {
      flex: 1,
      alignItems: 'center',
      height: '100%',
      justifyContent: 'flex-end',
      paddingHorizontal: 2,
    },
    barValueText: {
      fontSize: 10,
      fontWeight: '600',
      color: theme.colors.textMuted,
      marginBottom: 6,
      textAlign: 'center',
      width: '100%',
    },
    barTrack: {
      width: 22,
      height: 86,
      backgroundColor: theme.colors.surfaceAlt,
      borderRadius: 8,
      justifyContent: 'flex-end',
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    barFill: {
      width: '100%',
      borderRadius: 7,
    },
    barLabel: {
      fontSize: 11,
      color: theme.colors.textSecondary,
      marginTop: 8,
      fontWeight: '700',
    },
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: 20,
      padding: 20,
      gap: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.12,
      shadowRadius: 8,
      elevation: 3,
    },
    categoryCountBadge: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      fontWeight: '600',
      flexShrink: 0,
    },
    proportionalBarContainer: {
      flexDirection: 'row',
      height: 10,
      borderRadius: 999,
      overflow: 'hidden',
      backgroundColor: theme.colors.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    proportionalSegment: {
      height: '100%',
    },
    categoryList: {
      gap: 10,
      marginTop: 4,
    },
    categoryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 6,
    },
    categoryInfoLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flex: 1,
      minWidth: 0,
      marginRight: 8,
    },
    colorDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      flexShrink: 0,
    },
    categoryName: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.colors.textPrimary,
      flexShrink: 1,
    },
    categoryCount: {
      fontSize: 11,
      color: theme.colors.textMuted,
      flexShrink: 0,
    },
    categoryInfoRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flexShrink: 0,
    },
    categoryAmount: {
      fontSize: 13,
      fontWeight: '800',
      letterSpacing: -0.2,
      color: theme.colors.textPrimary,
    },
    merchantList: {
      gap: 10,
    },
    merchantRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.surfaceAlt,
      padding: 12,
      borderRadius: 14,
      gap: 10,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    merchantRankBadge: {
      width: 28,
      height: 28,
      borderRadius: 8,
      backgroundColor: theme.colors.dangerBg,
      borderWidth: 1,
      borderColor: 'rgba(251, 113, 133, 0.25)',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    merchantRankText: {
      fontSize: 11,
      fontWeight: '800',
      color: theme.colors.danger,
    },
    merchantDetails: {
      flex: 1,
      minWidth: 0,
    },
    merchantName: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.colors.textPrimary,
    },
    merchantMeta: {
      fontSize: 11,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
    merchantAmount: {
      fontSize: 13,
      fontWeight: '800',
      letterSpacing: -0.2,
      color: theme.colors.textPrimary,
      flexShrink: 0,
    },
    subscriptionHelperText: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      lineHeight: 19,
      fontWeight: '500',
    },
    emptySubscriptionBox: {
      alignItems: 'center',
      paddingVertical: 24,
      gap: 10,
    },
    emptySubscriptionText: {
      fontSize: 13,
      color: theme.colors.textMuted,
      textAlign: 'center',
      maxWidth: 290,
      lineHeight: 20,
    },
    subscriptionList: {
      gap: 10,
    },
    subscriptionItem: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.surfaceAlt,
      padding: 12,
      borderRadius: 14,
      gap: 10,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    subIconBadge: {
      width: 32,
      height: 32,
      borderRadius: 8,
      backgroundColor: theme.colors.primaryBg,
      borderWidth: 1,
      borderColor: 'rgba(16, 185, 129, 0.25)',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    subDetails: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    subNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    subMerchantName: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.colors.textPrimary,
      flexShrink: 1,
    },
    subMeta: {
      fontSize: 11,
      color: theme.colors.textSecondary,
    },
    subAmount: {
      fontSize: 13,
      fontWeight: '800',
      letterSpacing: -0.2,
      color: theme.colors.textPrimary,
      flexShrink: 0,
    },
    bankCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: 20,
      padding: 20,
      gap: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.12,
      shadowRadius: 8,
      elevation: 3,
    },
    bankStatusDesc: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      lineHeight: 20,
      fontWeight: '500',
    },
    supportedBanksRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    bankChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: theme.colors.surfaceAlt,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.colors.border,
      flexShrink: 0,
      maxWidth: '48%',
    },
    bankChipText: {
      fontSize: 11,
      color: theme.colors.textSecondary,
      fontWeight: '600',
      flexShrink: 1,
    },
    bankActionRow: {
      flexDirection: 'row',
      marginTop: 4,
    },
    emptyText: {
      fontSize: 13,
      color: theme.colors.textMuted,
      textAlign: 'center',
      paddingVertical: 18,
    },
  });
