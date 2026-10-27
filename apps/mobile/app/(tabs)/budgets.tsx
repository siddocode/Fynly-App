import React from 'react';
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
  Target,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Calendar,
  Sparkles,
  Tag,
  AlertCircle,
} from 'lucide-react-native';
import { api, formatPaiseToRupees } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import { theme } from '../../lib/theme';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Header } from '../../components/Header';
import { BudgetStatusLevel } from '../../types';

export default function BudgetsScreen() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  const {
    data: budgets,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['budgets'],
    queryFn: api.getBudgets,
    enabled: isAuthenticated,
  });

  const activeBudget = budgets && budgets.length > 0 ? budgets[0] : null;

  const getStatusColor = (status: BudgetStatusLevel): string => {
    switch (status) {
      case 'EXCEEDED':
        return theme.colors.alertRed;
      case 'WARNING_90':
        return theme.colors.alertOrange;
      case 'WARNING_70':
        return theme.colors.alertAmber;
      default:
        return theme.colors.primary;
    }
  };

  const getStatusLabel = (status: BudgetStatusLevel): string => {
    switch (status) {
      case 'EXCEEDED':
        return 'Limit Exceeded';
      case 'WARNING_90':
        return '90% Warning';
      case 'WARNING_70':
        return '70% Warning';
      default:
        return 'On Track';
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header
        title="Budgets"
        subtitle="Spending Limits & Allowance"
        rightElement={
          <Button
            title={activeBudget ? 'Edit' : 'Set Limit'}
            size="sm"
            onPress={() => {
              if (!isAuthenticated) router.push('/auth');
              else router.push('/create-budget');
            }}
            icon={<Plus size={14} color={theme.colors.textInverse} />}
          />
        }
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={theme.colors.primary}
          />
        }
      >
        {!isAuthenticated ? (
          <Card style={styles.emptyCard} variant="subtle">
            <Target size={40} color={theme.colors.primary} />
            <Text style={styles.emptyTitle}>Sign in to view budgets</Text>
            <Text style={styles.emptySubtitle}>
              Control spending with monthly and category-specific targets and real-time threshold warnings.
            </Text>
            <Button
              title="Sign In / Register"
              onPress={() => router.push('/auth')}
              style={{ marginTop: theme.spacing.md }}
            />
          </Card>
        ) : isLoading ? (
          <View style={styles.loadingWrapper}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        ) : !activeBudget ? (
          <Card style={styles.emptyCard} variant="subtle">
            <Target size={40} color={theme.colors.accent} />
            <Text style={styles.emptyTitle}>No budget configured yet</Text>
            <Text style={styles.emptySubtitle}>
              Set a monthly spending limit to unlock dynamic safe-to-spend allowances and proactive threshold alerts.
            </Text>
            <Button
              title="Create First Budget"
              onPress={() => router.push('/create-budget')}
              style={{ marginTop: theme.spacing.md }}
            />
          </Card>
        ) : (
          <>
            {/* Overall Budget Allowance Card */}
            <Card style={styles.overviewCard}>
              <View style={styles.overviewHeader}>
                <View>
                  <Text style={styles.budgetName}>{activeBudget.name}</Text>
                  <Text style={styles.periodText}>
                    {activeBudget.period} • {activeBudget.periodDetails.remainingDays} days remaining
                  </Text>
                </View>
                <View
                  style={[
                    styles.statusPill,
                    { backgroundColor: `${getStatusColor(activeBudget.status)}20` },
                  ]}
                >
                  {activeBudget.status === 'ON_TRACK' ? (
                    <ShieldCheck size={14} color={getStatusColor(activeBudget.status)} />
                  ) : (
                    <ShieldAlert size={14} color={getStatusColor(activeBudget.status)} />
                  )}
                  <Text
                    style={[
                      styles.statusPillText,
                      { color: getStatusColor(activeBudget.status) },
                    ]}
                  >
                    {getStatusLabel(activeBudget.status)}
                  </Text>
                </View>
              </View>

              <View style={styles.amountCompareRow}>
                <View>
                  <Text style={styles.metricLabel}>Spent</Text>
                  <Text style={styles.spentAmount}>
                    {formatPaiseToRupees(activeBudget.spentPaise)}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.metricLabel}>Budget Limit</Text>
                  <Text style={styles.limitAmount}>
                    {formatPaiseToRupees(activeBudget.limitPaise)}
                  </Text>
                </View>
              </View>

              {/* Progress Bar */}
              <View style={styles.progressBarBackground}>
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width: `${Math.min(100, activeBudget.usagePercentage)}%`,
                      backgroundColor: getStatusColor(activeBudget.status),
                    },
                  ]}
                />
              </View>

              <View style={styles.progressFooter}>
                <Text style={styles.percentageText}>
                  {activeBudget.usagePercentage}% spent
                </Text>
                <Text style={styles.remainingText}>
                  {BigInt(activeBudget.remainingPaise) >= 0n
                    ? `${formatPaiseToRupees(activeBudget.remainingPaise)} left`
                    : `${formatPaiseToRupees(BigInt(activeBudget.remainingPaise) * -1n)} over budget`}
                </Text>
              </View>

              {/* Safe to Spend Widget */}
              <View style={styles.safeSpendBanner}>
                <View style={styles.safeSpendIcon}>
                  <Sparkles size={18} color={theme.colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.safeSpendTitle}>Daily Safe-to-Spend</Text>
                  <Text style={styles.safeSpendDescription}>
                    Based on {activeBudget.periodDetails.remainingDays} days remaining in this period
                  </Text>
                </View>
                <Text style={styles.safeSpendAmount}>
                  {formatPaiseToRupees(activeBudget.safeToSpendTodayPaise)}
                  <Text style={styles.perDayText}>/day</Text>
                </Text>
              </View>
            </Card>

            {/* Category Allocations Section */}
            <View style={styles.categoriesSection}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Category Budgets</Text>
                <TouchableOpacity onPress={() => router.push('/create-budget')}>
                  <Text style={styles.manageText}>Manage Limits</Text>
                </TouchableOpacity>
              </View>

              {activeBudget.categories.length === 0 ? (
                <Card style={styles.emptyCategoryCard} variant="subtle">
                  <Text style={styles.emptyCatTitle}>No category limits configured</Text>
                  <Text style={styles.emptyCatSubtitle}>
                    Set individual targets for Food, Shopping, or Travel to prevent overspending in key areas.
                  </Text>
                </Card>
              ) : (
                <View style={styles.categoryList}>
                  {activeBudget.categories.map((cat) => {
                    const statusColor = getStatusColor(cat.status);
                    return (
                      <Card key={cat.id} style={styles.catCard} variant="subtle">
                        <View style={styles.catCardHeader}>
                          <View style={styles.catInfoRow}>
                            <View
                              style={[
                                styles.catDot,
                                { backgroundColor: cat.category.color || theme.colors.primary },
                              ]}
                            />
                            <Text style={styles.catName}>{cat.category.name}</Text>
                          </View>
                          <Text style={[styles.catPercentage, { color: statusColor }]}>
                            {cat.usagePercentage}%
                          </Text>
                        </View>

                        <View style={styles.catAmountRow}>
                          <Text style={styles.catSpentText}>
                            {formatPaiseToRupees(cat.spentPaise)}
                          </Text>
                          <Text style={styles.catLimitText}>
                            of {formatPaiseToRupees(cat.limitPaise)}
                          </Text>
                        </View>

                        <View style={styles.catProgressBg}>
                          <View
                            style={[
                              styles.catProgressFill,
                              {
                                width: `${Math.min(100, cat.usagePercentage)}%`,
                                backgroundColor: statusColor,
                              },
                            ]}
                          />
                        </View>
                      </Card>
                    );
                  })}
                </View>
              )}
            </View>
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
  },
  loadingWrapper: {
    paddingVertical: theme.spacing['3xl'],
    alignItems: 'center',
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: theme.spacing['3xl'],
    paddingHorizontal: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  emptyTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
    marginTop: theme.spacing.sm,
  },
  emptySubtitle: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    maxWidth: 280,
  },
  overviewCard: {
    padding: theme.spacing.xl,
    backgroundColor: theme.colors.surface,
    marginBottom: theme.spacing.xl,
  },
  overviewHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.lg,
  },
  budgetName: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
  },
  periodText: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.full,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: theme.typography.weights.semibold,
  },
  amountCompareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  },
  metricLabel: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
  },
  spentAmount: {
    fontSize: theme.typography.sizes['2xl'],
    fontWeight: theme.typography.weights.extrabold,
    color: theme.colors.textPrimary,
    marginTop: 2,
  },
  limitAmount: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  progressBarBackground: {
    height: 10,
    backgroundColor: theme.colors.surfaceSubtle,
    borderRadius: theme.borderRadius.full,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: theme.borderRadius.full,
  },
  progressFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: theme.spacing.sm,
  },
  percentageText: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textSecondary,
    fontWeight: theme.typography.weights.medium,
  },
  remainingText: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textPrimary,
    fontWeight: theme.typography.weights.semibold,
  },
  safeSpendBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceSubtle,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginTop: theme.spacing.lg,
    gap: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
  },
  safeSpendIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.primarySubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  safeSpendTitle: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
  },
  safeSpendDescription: {
    fontSize: 10,
    color: theme.colors.textMuted,
    marginTop: 1,
  },
  safeSpendAmount: {
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.extrabold,
    color: theme.colors.primary,
  },
  perDayText: {
    fontSize: 10,
    fontWeight: theme.typography.weights.normal,
    color: theme.colors.textMuted,
  },
  categoriesSection: {
    gap: theme.spacing.md,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
  },
  manageText: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.primary,
    fontWeight: theme.typography.weights.semibold,
  },
  emptyCategoryCard: {
    padding: theme.spacing.lg,
    alignItems: 'center',
  },
  emptyCatTitle: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textPrimary,
  },
  emptyCatSubtitle: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginTop: 2,
  },
  categoryList: {
    gap: theme.spacing.sm,
  },
  catCard: {
    padding: theme.spacing.md,
  },
  catCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  catInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  catDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  catName: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textPrimary,
  },
  catPercentage: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.bold,
  },
  catAmountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginTop: 4,
    marginBottom: 8,
  },
  catSpentText: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
  },
  catLimitText: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
  },
  catProgressBg: {
    height: 6,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.full,
    overflow: 'hidden',
  },
  catProgressFill: {
    height: '100%',
    borderRadius: theme.borderRadius.full,
  },
});
