import React from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  PlusCircle,
  ArrowDownLeft,
  FileSpreadsheet,
  LogIn,
  TrendingDown,
  TrendingUp,
  ShieldCheck,
  ShieldAlert,
  Tag,
  Target,
  ArrowRight,
} from 'lucide-react-native';
import { api, formatPaiseToRupees } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import { theme } from '../../lib/theme';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Header } from '../../components/Header';
import { BudgetStatusLevel } from '../../types';

export default function HomeScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useAuth();

  // Fetch consolidated dashboard summary
  const {
    data: summary,
    isLoading: summaryLoading,
    refetch: refetchSummary,
    isRefetching,
  } = useQuery({
    queryKey: ['dashboard'],
    queryFn: api.getDashboardSummary,
    enabled: isAuthenticated,
  });

  const onRefresh = async () => {
    await Promise.all([
      refetchSummary(),
      queryClient.invalidateQueries({ queryKey: ['budgets'] }),
      queryClient.invalidateQueries({ queryKey: ['transactions'] }),
      queryClient.invalidateQueries({ queryKey: ['me'] }),
    ]);
  };

  const getStatusColor = (status?: BudgetStatusLevel): string => {
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

  const totalBalancePaise = summary?.totalBalancePaise || '0';
  const todaySpentPaise = summary?.todaySpentPaise || '0';
  const monthSpentPaise = summary?.monthSpentPaise || '0';
  const safeToSpendTodayPaise = summary?.safeToSpendTodayPaise || '0';
  const budget = summary?.budget;
  const recentTransactions = summary?.recentTransactions || [];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
          />
        }
      >
        <Header
          title={isAuthenticated ? `Hi, ${user?.name.split(' ')[0]}` : 'Fynly'}
          subtitle={isAuthenticated ? 'Your finances at a glance' : 'Financial Clarity'}
          rightElement={
            !isAuthenticated ? (
              <Button
                title="Sign In"
                size="sm"
                onPress={() => router.push('/auth')}
                icon={<LogIn size={14} color={theme.colors.textInverse} />}
              />
            ) : (
              <Badge label="ACTIVE" variant="success" />
            )
          }
        />

        {/* Guest Banner if not logged in */}
        {!isAuthenticated && (
          <Card style={styles.guestCard} variant="subtle">
            <Text style={styles.guestTitle}>Welcome to Fynly</Text>
            <Text style={styles.guestSubtext}>
              Sign in or create a free account to track accounts, record transactions, and analyze budgets.
            </Text>
            <Button
              title="Get Started"
              onPress={() => router.push('/auth')}
              style={{ marginTop: theme.spacing.md }}
            />
          </Card>
        )}

        {/* Total Net Balance Card */}
        <Card style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Total Net Balance</Text>
          <Text style={styles.balanceAmount}>
            {formatPaiseToRupees(totalBalancePaise)}
          </Text>

          <View style={styles.divider} />

          <View style={styles.safeSpendRow}>
            <View>
              <Text style={styles.safeSpendLabel}>Safe to Spend Today</Text>
              <Text style={styles.safeSpendValue}>
                {formatPaiseToRupees(safeToSpendTodayPaise)}
              </Text>
            </View>
            <View
              style={[
                styles.budgetStatusPill,
                { backgroundColor: `${getStatusColor(budget?.status)}20` },
              ]}
            >
              {budget?.status === 'EXCEEDED' || budget?.status === 'WARNING_90' || budget?.status === 'WARNING_70' ? (
                <ShieldAlert size={14} color={getStatusColor(budget?.status)} />
              ) : (
                <ShieldCheck size={14} color={theme.colors.primary} />
              )}
              <Text
                style={[
                  styles.budgetStatusText,
                  { color: getStatusColor(budget?.status) },
                ]}
              >
                {budget ? (budget.status === 'ON_TRACK' ? 'On Track' : budget.status) : 'Estimated'}
              </Text>
            </View>
          </View>
        </Card>

        {/* Monthly Budget Summary Widget */}
        {isAuthenticated && (
          <View style={styles.sectionWrap}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Spending & Budget</Text>
              <TouchableOpacity onPress={() => router.push('/budgets')}>
                <Text style={styles.linkText}>View Budgets</Text>
              </TouchableOpacity>
            </View>

            <Card style={styles.budgetWidget} variant="subtle">
              <View style={styles.statGrid}>
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>Spent Today</Text>
                  <Text style={styles.statAmount}>{formatPaiseToRupees(todaySpentPaise)}</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>This Month</Text>
                  <Text style={styles.statAmount}>{formatPaiseToRupees(monthSpentPaise)}</Text>
                </View>
              </View>

              {budget ? (
                <View style={styles.budgetProgressSection}>
                  <View style={styles.budgetBarHeader}>
                    <Text style={styles.budgetBarLabel}>Monthly Limit</Text>
                    <Text style={styles.budgetBarValues}>
                      {formatPaiseToRupees(budget.spentPaise)} / {formatPaiseToRupees(budget.limitPaise)}
                    </Text>
                  </View>
                  <View style={styles.progressBg}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${Math.min(100, budget.usagePercentage)}%`,
                          backgroundColor: getStatusColor(budget.status),
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.budgetDaysRemaining}>
                    {budget.remainingDays} days remaining in this cycle
                  </Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.setBudgetPrompt}
                  onPress={() => router.push('/create-budget')}
                >
                  <View style={styles.promptLeft}>
                    <Target size={16} color={theme.colors.primary} />
                    <Text style={styles.promptText}>Set a monthly budget to track spending</Text>
                  </View>
                  <ArrowRight size={14} color={theme.colors.primary} />
                </TouchableOpacity>
              )}
            </Card>
          </View>
        )}

        {/* Quick Action Shortcuts */}
        <View style={styles.actionsContainer}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionGrid}>
            <Button
              title="Add Expense"
              onPress={() => {
                if (!isAuthenticated) router.push('/auth');
                else router.push('/add-transaction?type=EXPENSE');
              }}
              variant="secondary"
              icon={<ArrowDownLeft size={16} color={theme.colors.expense} />}
              style={styles.actionBtn}
            />
            <Button
              title="Add Income"
              onPress={() => {
                if (!isAuthenticated) router.push('/auth');
                else router.push('/add-transaction?type=INCOME');
              }}
              variant="secondary"
              icon={<PlusCircle size={16} color={theme.colors.income} />}
              style={styles.actionBtn}
            />
          </View>
          <Button
            title="Import Bank Statement (CSV)"
            onPress={() => {}}
            variant="outline"
            icon={<FileSpreadsheet size={16} color={theme.colors.primary} />}
            style={styles.importBtn}
          />
        </View>

        {/* Recent Transactions Section */}
        <View style={styles.transactionsSection}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Recent Transactions</Text>
            {isAuthenticated && recentTransactions.length > 0 && (
              <TouchableOpacity onPress={() => router.push('/activity')}>
                <Text style={styles.viewAllText}>View All</Text>
              </TouchableOpacity>
            )}
          </View>

          {recentTransactions.length === 0 ? (
            <Card style={styles.emptyCard} variant="subtle">
              <Text style={styles.emptyText}>No transactions recorded yet.</Text>
              <Text style={styles.emptySubtext}>
                Tap &ldquo;Add Expense&rdquo; or &ldquo;Add Income&rdquo; above to record your first transaction.
              </Text>
            </Card>
          ) : (
            <View style={styles.txList}>
              {recentTransactions.map((tx) => {
                const isExpense = tx.type === 'EXPENSE';
                const formattedDate = new Date(tx.date).toLocaleDateString('en-IN', {
                  month: 'short',
                  day: 'numeric',
                });

                return (
                  <Card key={tx.id} style={styles.txCard} variant="subtle">
                    <View style={styles.txIconWrapper}>
                      {isExpense ? (
                        <TrendingDown size={18} color={theme.colors.expense} />
                      ) : (
                        <TrendingUp size={18} color={theme.colors.income} />
                      )}
                    </View>

                    <View style={styles.txDetails}>
                      <Text style={styles.txDescription} numberOfLines={1}>
                        {tx.merchantName || tx.description}
                      </Text>
                      <View style={styles.txSubRow}>
                        <Text style={styles.txDate}>{formattedDate}</Text>
                        {tx.category ? (
                          <View style={styles.categoryBadge}>
                            <Tag size={10} color={tx.category.color || theme.colors.textMuted} />
                            <Text style={styles.categoryBadgeText}>{tx.category.name}</Text>
                          </View>
                        ) : null}
                      </View>
                    </View>

                    <Text
                      style={[
                        styles.txAmount,
                        { color: isExpense ? theme.colors.expense : theme.colors.income },
                      ]}
                    >
                      {isExpense ? '-' : '+'}
                      {formatPaiseToRupees(tx.amountPaise)}
                    </Text>
                  </Card>
                );
              })}
            </View>
          )}
        </View>
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
    paddingBottom: theme.spacing['4xl'],
  },
  guestCard: {
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
    padding: theme.spacing.lg,
  },
  guestTitle: {
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
  },
  guestSubtext: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  balanceCard: {
    marginHorizontal: theme.spacing.lg,
    padding: theme.spacing.xl,
    backgroundColor: theme.colors.surface,
  },
  balanceLabel: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    fontWeight: theme.typography.weights.medium,
  },
  balanceAmount: {
    fontSize: theme.typography.sizes['3xl'],
    fontWeight: theme.typography.weights.extrabold,
    color: theme.colors.textPrimary,
    marginTop: theme.spacing.xs,
    letterSpacing: -0.5,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.surfaceBorder,
    marginVertical: theme.spacing.md,
  },
  safeSpendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  safeSpendLabel: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textSecondary,
  },
  safeSpendValue: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.primary,
    marginTop: 2,
  },
  budgetStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.full,
  },
  budgetStatusText: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.semibold,
  },
  sectionWrap: {
    marginTop: theme.spacing.xl,
    paddingHorizontal: theme.spacing.lg,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  sectionTitle: {
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
  },
  linkText: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.primary,
    fontWeight: theme.typography.weights.semibold,
  },
  budgetWidget: {
    padding: theme.spacing.lg,
  },
  statGrid: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statBox: {
    flex: 1,
  },
  statDivider: {
    width: 1,
    height: 36,
    backgroundColor: theme.colors.surfaceBorder,
    marginHorizontal: theme.spacing.md,
  },
  statLabel: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
  },
  statAmount: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
    marginTop: 2,
  },
  budgetProgressSection: {
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.surfaceBorder,
  },
  budgetBarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  budgetBarLabel: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textSecondary,
  },
  budgetBarValues: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
  },
  progressBg: {
    height: 6,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: theme.borderRadius.full,
  },
  budgetDaysRemaining: {
    fontSize: 10,
    color: theme.colors.textMuted,
    marginTop: 4,
    textAlign: 'right',
  },
  setBudgetPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.surfaceBorder,
  },
  promptLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  promptText: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.primary,
    fontWeight: theme.typography.weights.medium,
  },
  actionsContainer: {
    marginTop: theme.spacing.xl,
    paddingHorizontal: theme.spacing.lg,
  },
  actionGrid: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginTop: theme.spacing.sm,
  },
  actionBtn: {
    flex: 1,
  },
  importBtn: {
    marginTop: theme.spacing.md,
  },
  transactionsSection: {
    marginTop: theme.spacing.xl,
    paddingHorizontal: theme.spacing.lg,
  },
  viewAllText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.primary,
    fontWeight: theme.typography.weights.semibold,
  },
  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing['2xl'],
    marginTop: theme.spacing.sm,
  },
  emptyText: {
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.textSecondary,
  },
  emptySubtext: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    marginTop: 4,
    textAlign: 'center',
  },
  txList: {
    marginTop: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  txCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
  },
  txIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  txDetails: {
    flex: 1,
  },
  txDescription: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textPrimary,
  },
  txSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  txDate: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  categoryBadgeText: {
    fontSize: 11,
    color: theme.colors.textSecondary,
  },
  txAmount: {
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.bold,
    marginLeft: theme.spacing.sm,
  },
});
