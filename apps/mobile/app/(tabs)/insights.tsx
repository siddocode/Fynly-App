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
import { useRouter } from 'expo-router';
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
  Sparkles,
  ShoppingBag,
} from 'lucide-react-native';
import { api, formatPaiseToRupees } from '../../lib/api';
import { theme } from '../../lib/theme';
import { Header } from '../../components/Header';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { useAuth } from '../../hooks/useAuth';

export default function InsightsScreen() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  // Queries for Insights Overview, Recurring Subscriptions, and Bank Sync Status
  const {
    data: overview,
    isLoading: isLoadingOverview,
    refetch: refetchOverview,
  } = useQuery({
    queryKey: ['insights-overview'],
    queryFn: () => api.getInsightsOverview(),
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
              Sign in to unlock spending velocity, AI-assisted subscription detection, and multi-week trend forecasts.
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
                <View>
                  <Text style={styles.sectionOverline}>EXECUTIVE SUMMARY</Text>
                  <Text style={styles.mainSpendValue}>
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
                    >
                      {Math.abs(summary.monthOverMonth.percentageChange)}% vs last mo
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.divider} />

              <View style={styles.summaryMetricsRow}>
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>Income Received</Text>
                  <Text style={[styles.metricValue, { color: theme.colors.income }]}>
                    {formatPaiseToRupees(summary?.currentMonthIncomePaise || '0')}
                  </Text>
                </View>

                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>Net Savings</Text>
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
                  >
                    {formatPaiseToRupees(summary?.netSavingsPaise || '0')}
                  </Text>
                </View>

                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>Savings Rate</Text>
                  <Text style={[styles.metricValue, { color: theme.colors.info }]}>
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
                  <Text style={styles.sectionTitle}>Spending Velocity & Forecast</Text>
                </View>
                <Badge
                  label={`${period?.remainingDays || 0} days remaining`}
                  variant="muted"
                />
              </View>

              <View style={styles.forecastGrid}>
                <View style={styles.forecastMetric}>
                  <Text style={styles.forecastLabel}>Daily Burn Rate</Text>
                  <Text style={styles.forecastValue}>
                    {formatPaiseToRupees(forecast?.dailyBurnRatePaise || '0')}
                    <Text style={styles.unitText}>/day</Text>
                  </Text>
                </View>

                <View style={styles.forecastMetric}>
                  <Text style={styles.forecastLabel}>Projected Month-End</Text>
                  <Text style={styles.forecastValue}>
                    {formatPaiseToRupees(forecast?.projectedMonthEndSpendPaise || '0')}
                  </Text>
                </View>
              </View>

              {forecast?.budgetLimitPaise && (
                <View style={styles.forecastBudgetStatus}>
                  <Text style={styles.forecastStatusText}>
                    {forecast.isProjectedWithinBudget
                      ? `🟢 Projected to stay within budget by ${formatPaiseToRupees(
                          forecast.projectedVariancePaise || '0'
                        )}.`
                      : `🔴 Warning: At current velocity, projected to exceed budget by ${formatPaiseToRupees(
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
                  <Text style={styles.sectionTitle}>Weekly Trajectory</Text>
                </View>
                <Text style={styles.chartSubtitle}>Across current month</Text>
              </View>

              <View style={styles.barChartContainer}>
                {weeklyBreakdown.map((week) => {
                  const spentNum = Number(week.spentPaise);
                  const barHeightRatio = Math.max(0.08, spentNum / maxWeeklySpent);
                  return (
                    <View key={week.weekIndex} style={styles.barColumn}>
                      <Text style={styles.barValueText}>
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
                  <Text style={styles.sectionTitle}>Category Distribution</Text>
                </View>
                <Text style={styles.categoryCountBadge}>{categories.length} categories</Text>
              </View>

              {/* Proportional distribution bar */}
              {categories.length > 0 && (
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

              {categories.length === 0 ? (
                <Text style={styles.emptyText}>No categorized expenses this month.</Text>
              ) : (
                <View style={styles.categoryList}>
                  {categories.map((cat) => (
                    <View key={cat.id} style={styles.categoryRow}>
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
                        <Text style={styles.categoryCount}>({cat.count} txns)</Text>
                      </View>

                      <View style={styles.categoryInfoRight}>
                        <Text style={styles.categoryAmount}>
                          {formatPaiseToRupees(cat.spentPaise)}
                        </Text>
                        <Badge label={`${cat.percentage}%`} variant="muted" />
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </Card>

            {/* 5. Top Merchants */}
            <Card style={styles.card}>
              <View style={styles.sectionHeaderRow}>
                <View style={styles.sectionTitleWithIcon}>
                  <ShoppingBag size={18} color={theme.colors.expense} />
                  <Text style={styles.sectionTitle}>Top Merchants</Text>
                </View>
                <Text style={styles.chartSubtitle}>Highest spending destinations</Text>
              </View>

              {topMerchants.length === 0 ? (
                <Text style={styles.emptyText}>No merchant spending recorded yet.</Text>
              ) : (
                <View style={styles.merchantList}>
                  {topMerchants.map((merchant, index) => (
                    <View key={index} style={styles.merchantRow}>
                      <View style={styles.merchantRankBadge}>
                        <Text style={styles.merchantRankText}>#{index + 1}</Text>
                      </View>
                      <View style={styles.merchantDetails}>
                        <Text style={styles.merchantName}>{merchant.name}</Text>
                        <Text style={styles.merchantMeta}>
                          {merchant.count} transaction{merchant.count > 1 ? 's' : ''} •{' '}
                          {merchant.percentage}% of total
                        </Text>
                      </View>
                      <Text style={styles.merchantAmount}>
                        {formatPaiseToRupees(merchant.spentPaise)}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </Card>

            {/* 6. Detected Recurring Subscriptions & Bills */}
            <Card style={styles.card}>
              <View style={styles.sectionHeaderRow}>
                <View style={styles.sectionTitleWithIcon}>
                  <Repeat size={18} color={theme.colors.primary} />
                  <Text style={styles.sectionTitle}>Recurring Subscriptions & Bills</Text>
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
                  <Sparkles size={24} color={theme.colors.textMuted} />
                  <Text style={styles.emptySubscriptionText}>
                    No repeating subscriptions detected yet. Regular monthly payments (like Netflix, rent, or broadband) will appear here automatically.
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
                          <Text style={styles.subMerchantName}>{sub.merchantName}</Text>
                          <Badge label={sub.cadence} variant="muted" />
                        </View>
                        <Text style={styles.subMeta}>
                          Next due in {sub.daysUntilDue} day{sub.daysUntilDue === 1 ? '' : 's'} •{' '}
                          {sub.occurrencesCount} cycles verified
                        </Text>
                      </View>

                      <Text style={styles.subAmount}>
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
                  <Text style={styles.sectionTitle}>Bank Connectivity & Open Banking</Text>
                </View>
                <Badge
                  label={bankStatus?.isConfigured ? 'AA Connected' : 'AA Ready'}
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
                    <Text style={styles.bankChipText}>{inst.name}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.bankActionRow}>
                <Button
                  title="Import Bank Statement (CSV)"
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing['4xl'],
    gap: theme.spacing.lg,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing['4xl'],
    gap: theme.spacing.md,
  },
  loadingText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: theme.spacing.xl,
  },
  authPromptCard: {
    alignItems: 'center',
    padding: theme.spacing['2xl'],
    gap: theme.spacing.md,
  },
  authPromptTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  authPromptDesc: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  summaryCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  sectionOverline: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.primary,
    letterSpacing: 1,
    marginBottom: theme.spacing.xs,
  },
  mainSpendValue: {
    fontSize: theme.typography.sizes['3xl'],
    fontWeight: theme.typography.weights.extrabold,
    color: theme.colors.textPrimary,
  },
  mainSpendLabel: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  momPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.full,
    gap: 4,
  },
  momPillPositive: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  momPillNegative: {
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
  },
  momPillText: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.bold,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.surfaceBorder,
    marginVertical: theme.spacing.md,
  },
  summaryMetricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metricItem: {
    flex: 1,
  },
  metricLabel: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    marginBottom: 4,
  },
  metricValue: {
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.bold,
  },
  forecastCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    borderColor: 'rgba(245, 158, 11, 0.25)',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  sectionTitle: {
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
  },
  forecastGrid: {
    flexDirection: 'row',
    gap: theme.spacing.lg,
    backgroundColor: theme.colors.surfaceSubtle,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
  },
  forecastMetric: {
    flex: 1,
  },
  forecastLabel: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textSecondary,
    marginBottom: 2,
  },
  forecastValue: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
  },
  unitText: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    fontWeight: theme.typography.weights.normal,
  },
  forecastBudgetStatus: {
    paddingTop: theme.spacing.xs,
  },
  forecastStatusText: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textSecondary,
    lineHeight: 18,
  },
  chartCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.lg,
    gap: theme.spacing.lg,
  },
  chartSubtitle: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
  },
  barChartContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 140,
    paddingTop: theme.spacing.md,
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
  },
  barValueText: {
    fontSize: 10,
    color: theme.colors.textMuted,
    marginBottom: 6,
  },
  barTrack: {
    width: 22,
    height: 90,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.sm,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    borderRadius: theme.borderRadius.sm,
  },
  barLabel: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textSecondary,
    marginTop: 8,
    fontWeight: theme.typography.weights.semibold,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  categoryCountBadge: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
  },
  proportionalBarContainer: {
    flexDirection: 'row',
    height: 8,
    borderRadius: theme.borderRadius.full,
    overflow: 'hidden',
    backgroundColor: theme.colors.surface,
  },
  proportionalSegment: {
    height: '100%',
  },
  categoryList: {
    gap: theme.spacing.sm,
    marginTop: theme.spacing.xs,
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
    gap: theme.spacing.sm,
    flex: 1,
  },
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  categoryName: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.textPrimary,
  },
  categoryCount: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
  },
  categoryInfoRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  categoryAmount: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
  },
  merchantList: {
    gap: theme.spacing.sm,
  },
  merchantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    gap: theme.spacing.md,
  },
  merchantRankBadge: {
    width: 28,
    height: 28,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: 'rgba(244, 63, 94, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  merchantRankText: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.expense,
  },
  merchantDetails: {
    flex: 1,
  },
  merchantName: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textPrimary,
  },
  merchantMeta: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  merchantAmount: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
  },
  subscriptionHelperText: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textSecondary,
    lineHeight: 18,
  },
  emptySubscriptionBox: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xl,
    gap: theme.spacing.sm,
  },
  emptySubscriptionText: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    textAlign: 'center',
    maxWidth: 280,
  },
  subscriptionList: {
    gap: theme.spacing.sm,
  },
  subscriptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    gap: theme.spacing.md,
  },
  subIconBadge: {
    width: 32,
    height: 32,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subDetails: {
    flex: 1,
    gap: 2,
  },
  subNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  subMerchantName: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textPrimary,
  },
  subMeta: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
  },
  subAmount: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
  },
  bankCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  bankStatusDesc: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textSecondary,
    lineHeight: 18,
  },
  supportedBanksRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
  },
  bankChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.full,
  },
  bankChipText: {
    fontSize: 10,
    color: theme.colors.textSecondary,
    fontWeight: theme.typography.weights.medium,
  },
  bankActionRow: {
    flexDirection: 'row',
    marginTop: theme.spacing.xs,
  },
  emptyText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
    textAlign: 'center',
    paddingVertical: theme.spacing.md,
  },
});
