import React from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { PlusCircle, ArrowDownLeft, FileSpreadsheet, Server, Database, ShieldCheck } from 'lucide-react-native';
import { api, formatPaiseToRupees } from '../../lib/api';
import { theme } from '../../lib/theme';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Header } from '../../components/Header';

export default function HomeScreen() {
  const {
    data: health,
    isLoading: healthLoading,
    isError: healthError,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['health'],
    queryFn: api.getHealth,
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
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
        <Header
          title="Fynly"
          subtitle="Financial Clarity"
          rightElement={
            <Badge
              label={health ? 'API LIVE' : healthLoading ? 'CONNECTING...' : 'OFFLINE'}
              variant={health ? 'success' : 'warning'}
            />
          }
        />

        {/* Backend & DB Connection Status Card (Stage 2 Verification) */}
        <Card style={styles.systemCard} variant="subtle">
          <View style={styles.systemHeader}>
            <View style={styles.systemTitleRow}>
              <Server size={18} color={theme.colors.primary} />
              <Text style={styles.systemTitle}>System Foundation</Text>
            </View>
            <View style={styles.systemBadge}>
              <Database size={14} color={theme.colors.income} />
              <Text style={styles.systemBadgeText}>PostgreSQL (Neon)</Text>
            </View>
          </View>
          <View style={styles.systemDetails}>
            <Text style={styles.systemText}>
              Status:{' '}
              <Text style={{ color: health ? theme.colors.primary : theme.colors.alertAmber }}>
                {health ? 'Healthy & Connected' : healthLoading ? 'Checking...' : 'Retrying...'}
              </Text>
            </Text>
            {health && (
              <Text style={styles.systemSubtext}>
                Uptime: {health.uptimeSeconds}s | Env: {health.environment}
              </Text>
            )}
          </View>
        </Card>

        {/* Total Net Balance Card */}
        <Card style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Total Net Balance</Text>
          <Text style={styles.balanceAmount}>{formatPaiseToRupees(0)}</Text>

          <View style={styles.divider} />

          <View style={styles.safeSpendRow}>
            <View>
              <Text style={styles.safeSpendLabel}>Safe to Spend Today</Text>
              <Text style={styles.safeSpendValue}>{formatPaiseToRupees(0)}</Text>
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
              onPress={() => {}}
              variant="secondary"
              icon={<ArrowDownLeft size={16} color={theme.colors.expense} />}
              style={styles.actionBtn}
            />
            <Button
              title="Add Income"
              onPress={() => {}}
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

        {/* Recent Transactions Placeholder */}
        <View style={styles.transactionsSection}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Recent Transactions</Text>
            <Text style={styles.viewAllText}>View All</Text>
          </View>
          <Card style={styles.emptyCard} variant="subtle">
            <Text style={styles.emptyText}>No transactions recorded yet.</Text>
            <Text style={styles.emptySubtext}>
              Transactions added in Stage 3 will appear here in real-time.
            </Text>
          </Card>
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
    paddingBottom: theme.spacing['3xl'],
  },
  systemCard: {
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  systemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  systemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  systemTitle: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textPrimary,
  },
  systemBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.colors.incomeBg,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
  },
  systemBadgeText: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.income,
    fontWeight: theme.typography.weights.medium,
  },
  systemDetails: {
    marginTop: theme.spacing.xs,
  },
  systemText: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textSecondary,
  },
  systemSubtext: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    marginTop: 2,
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
});
