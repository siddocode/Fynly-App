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
  Tag,
} from 'lucide-react-native';
import { api, formatPaiseToRupees } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import { theme } from '../../lib/theme';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Header } from '../../components/Header';

export default function HomeScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useAuth();

  // Fetch real profile data if authenticated
  const {
    data: profile,
    isLoading: profileLoading,
    refetch: refetchProfile,
    isRefetching: isRefetchingProfile,
  } = useQuery({
    queryKey: ['me'],
    queryFn: api.getMe,
    enabled: isAuthenticated,
  });

  // Fetch recent transactions
  const {
    data: transactionsData,
    isLoading: txLoading,
    refetch: refetchTx,
    isRefetching: isRefetchingTx,
  } = useQuery({
    queryKey: ['transactions', 'recent'],
    queryFn: () => api.getTransactions({ limit: 5 }),
    enabled: isAuthenticated,
  });

  const onRefresh = async () => {
    await Promise.all([
      refetchProfile(),
      refetchTx(),
      queryClient.invalidateQueries({ queryKey: ['health'] }),
    ]);
  };

  const isRefreshing = isRefetchingProfile || isRefetchingTx;
  const recentTransactions = transactionsData?.transactions || [];
  const totalBalancePaise = profile?.totalBalancePaise || '0';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
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
                {formatPaiseToRupees(0)}
              </Text>
            </View>
            <View style={styles.budgetStatusPill}>
              <ShieldCheck size={16} color={theme.colors.primary} />
              <Text style={styles.budgetStatusText}>On Track</Text>
            </View>
          </View>
        </Card>

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
    backgroundColor: theme.colors.primarySubtle,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.full,
  },
  budgetStatusText: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.primary,
    fontWeight: theme.typography.weights.semibold,
  },
  actionsContainer: {
    marginTop: theme.spacing.xl,
    paddingHorizontal: theme.spacing.lg,
  },
  sectionTitle: {
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.md,
  },
  actionGrid: {
    flexDirection: 'row',
    gap: theme.spacing.md,
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
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
