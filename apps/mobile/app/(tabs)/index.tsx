import React from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeRouter } from '../../hooks/useSafeRouter';
import { useFocusEffect } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  TrendingDown,
  TrendingUp,
  Tag,
  Target,
  Bell,
  Wallet,
  Calendar,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
  LogIn,
  Sparkles,
  ShieldCheck,
  Plus,
  Minus,
} from 'lucide-react-native';
import { api, formatPaiseToRupees } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import { useTheme, Theme } from '../../lib/theme';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Header } from '../../components/Header';
import { BudgetStatusLevel } from '../../types';

export default function HomeScreen() {
  const router = useSafeRouter();
  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useAuth();
  const { theme, isDark } = useTheme();
  const styles = React.useMemo(() => getStyles(theme, isDark), [theme, isDark]);

  // Fetch consolidated dashboard summary ONLY when logged in
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

  // Automatically refresh dashboard when Home tab is focused so activating budgets instantly reflects
  useFocusEffect(
    React.useCallback(() => {
      if (isAuthenticated) {
        refetchSummary();
      }
    }, [isAuthenticated, refetchSummary])
  );

  // Fetch notifications for unread badge ONLY when logged in
  const { data: notificationsData } = useQuery({
    queryKey: ['notifications'],
    queryFn: api.getNotifications,
    enabled: isAuthenticated,
  });
  const unreadCount = isAuthenticated ? (notificationsData?.unreadCount || 0) : 0;

  const onRefresh = async () => {
    if (!isAuthenticated) return;
    await Promise.all([
      refetchSummary(),
      queryClient.invalidateQueries({ queryKey: ['budgets'] }),
      queryClient.invalidateQueries({ queryKey: ['transactions'] }),
      queryClient.invalidateQueries({ queryKey: ['notifications'] }),
      queryClient.invalidateQueries({ queryKey: ['me'] }),
    ]);
  };

  const getStatusColor = (status?: BudgetStatusLevel): string => {
    switch (status) {
      case 'EXCEEDED':
      case 'WARNING_90':
        return theme.colors.expense;
      case 'WARNING_70':
        return theme.colors.alertAmber;
      default:
        return theme.colors.primary;
    }
  };

  // Only read user financial data when authenticated
  const totalBalancePaise = isAuthenticated ? (summary?.totalBalancePaise || '0') : '0';
  const todaySpentPaise = isAuthenticated ? (summary?.todaySpentPaise || '0') : '0';
  const budget = isAuthenticated ? summary?.budget : null;
  const dailyOverview = isAuthenticated ? summary?.dailyOverview : null;
  const recentTransactions = isAuthenticated ? (summary?.recentTransactions || []) : [];

  const currentMonthName = new Date().toLocaleString('en-IN', { month: 'long' });

  // Safe percentage helper
  const budgetUsagePercent = budget?.usagePercentage ?? 0;
  const budgetBarWidth = Math.min(100, Math.max(0, budgetUsagePercent));

  const dailyUsagePercent = dailyOverview?.usagePercentage ?? 0;
  const dailyBarWidth = Math.min(100, Math.max(0, dailyUsagePercent));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          isAuthenticated ? (
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={onRefresh}
              tintColor={theme.colors.primary}
            />
          ) : undefined
        }
      >
        <Header
          title={isAuthenticated ? `Hi, ${user?.name ? user.name.split(' ')[0] : 'there'}` : 'Fynly'}
          subtitle={isAuthenticated ? `${currentMonthName} Overview` : 'Smart Financial Clarity'}
          rightElement={
            !isAuthenticated ? (
              <Button
                title="Sign In"
                size="sm"
                onPress={() => router.push('/auth')}
                icon={<LogIn size={14} color={theme.colors.textInverse} />}
              />
            ) : (
              <TouchableOpacity
                onPress={() => router.push('/notifications')}
                style={styles.bellBtn}
                accessibilityLabel="Notifications"
              >
                <Bell size={20} color={theme.colors.textPrimary} />
                {unreadCount > 0 && (
                  <View style={styles.bellBadge}>
                    <Text style={styles.bellBadgeText}>
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            )
          }
        />

        {/* ================= GUEST EXPERIENCE (WHEN LOGGED OUT) ================= */}
        {!isAuthenticated && (
          <View style={styles.guestContainer}>
            <Card style={styles.guestHeroCard}>
              <View style={styles.guestIconBadge}>
                <Sparkles size={22} color={theme.colors.primary} />
              </View>
              <Text style={styles.guestHeroTitle}>Master Your Money</Text>
              <Text style={styles.guestHeroSubtitle}>
                Set clean monthly budgets, track daily allowances in real-time, and log expenses with one tap.
              </Text>
              <View style={styles.guestBtnGroup}>
                <Button
                  title="Sign In / Register"
                  onPress={() => router.push('/auth')}
                  style={styles.guestPrimaryBtn}
                />
              </View>
            </Card>

            <View style={styles.guestFeaturesRow}>
              <View style={styles.guestFeatureCard}>
                <Target size={18} color={theme.colors.accent} />
                <Text style={styles.guestFeatureTitle}>Smart Budgets</Text>
                <Text style={styles.guestFeatureDesc}>Set targets by category & stay on track</Text>
              </View>
              <View style={styles.guestFeatureCard}>
                <Calendar size={18} color={theme.colors.primary} />
                <Text style={styles.guestFeatureTitle}>Daily Pace</Text>
                <Text style={styles.guestFeatureDesc}>Know exactly what you can safely spend today</Text>
              </View>
            </View>
          </View>
        )}

        {/* ================= AUTHENTICATED FINANCIAL DASHBOARD ================= */}
        {isAuthenticated && (
          <>
            {/* 1. HERO TOTAL BUDGET CARD */}
            {budget ? (
              <TouchableOpacity
                activeOpacity={0.88}
                onPress={() => router.push('/budgets')}
                style={styles.heroCardTouchable}
              >
                <Card style={styles.heroCard}>
                  <View style={styles.heroHeaderRow}>
                    <View style={styles.heroBadge}>
                      <Target size={12} color={theme.colors.primary} />
                      <Text style={styles.heroBadgeText} numberOfLines={1}>
                        {budget.name || 'Monthly Budget'}
                      </Text>
                    </View>
                    <View style={styles.heroDaysPill}>
                      <Text style={styles.heroDaysPillText}>
                        {budget.remainingDays}d left
                      </Text>
                      <ChevronRight size={12} color={theme.colors.textMuted} />
                    </View>
                  </View>

                  <Text style={styles.heroLabel}>Total Monthly Budget</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                    <Text style={styles.heroAmount}>
                      {formatPaiseToRupees(budget.limitPaise)}
                    </Text>
                    {budget.incomePaise && BigInt(budget.incomePaise) > 0n ? (
                      <View style={styles.incomeBoostPill}>
                        <TrendingUp size={11} color={theme.colors.income} />
                        <Text style={styles.incomeBoostText}>
                          +{formatPaiseToRupees(budget.incomePaise)} income added
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  {/* Progress Line Bar */}
                  <View style={styles.progressContainer}>
                    <View style={styles.progressBarBg}>
                      <View
                        style={[
                          styles.progressBarFill,
                          {
                            width: `${budgetBarWidth}%`,
                            backgroundColor: getStatusColor(budget.status),
                          },
                        ]}
                      />
                    </View>
                    <View style={styles.progressMetaRow}>
                      <Text style={styles.progressSpentText}>
                        {formatPaiseToRupees(budget.spentPaise)} spent ({budgetUsagePercent}%)
                      </Text>
                      <Text style={styles.progressRemainingText}>
                        {formatPaiseToRupees(budget.remainingPaise)} left
                      </Text>
                    </View>
                  </View>
                </Card>
              </TouchableOpacity>
            ) : (
              <View style={styles.heroCardTouchable}>
                <Card style={styles.heroCard}>
                  <View style={styles.heroHeaderRow}>
                    <View style={styles.heroBadge}>
                      <Target size={12} color={theme.colors.primary} />
                      <Text style={styles.heroBadgeText}>No Active Budget</Text>
                    </View>
                  </View>

                  <Text style={styles.heroLabel}>Budget Management</Text>
                  <Text style={styles.noBudgetHeading}>Set a Monthly Budget</Text>
                  <Text style={styles.heroSubnote}>
                    Create a budget to unlock your daily safe-to-spend allowance, live spending pace, and income boosts.
                  </Text>

                  <TouchableOpacity
                    style={styles.setBudgetPrompt}
                    onPress={() => router.push({ pathname: '/create-budget', params: { reset: 'true' } })}
                    activeOpacity={0.8}
                  >
                    <View style={styles.setBudgetPromptLeft}>
                      <Sparkles size={16} color={theme.colors.primary} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.setBudgetPromptTitle}>Create Budget Plan</Text>
                        <Text style={styles.setBudgetPromptSubtitle}>
                          Choose a month &amp; spending limit
                        </Text>
                      </View>
                    </View>
                    <View style={styles.setBudgetBtn}>
                      <Text style={styles.setBudgetBtnText}>+ Set</Text>
                    </View>
                  </TouchableOpacity>
                </Card>
              </View>
            )}

            {/* 2. UNIFIED TODAY'S SPENDING HUB & ACTIONS */}
            <View style={styles.dailySectionWrap}>
              <Card
                style={[
                  styles.dailyHubCard,
                  dailyOverview?.isExceeded && styles.dailyCardExceeded,
                ]}
              >
                {/* Hub Header */}
                <View style={styles.dailyHeaderRow}>
                  <View style={styles.dailyTitleWrap}>
                    <Calendar
                      size={14}
                      color={dailyOverview?.isExceeded ? theme.colors.expense : theme.colors.primary}
                    />
                    <Text style={styles.dailySectionLabel}>
                      {dailyOverview && BigInt(dailyOverview.limitPaise || '0') > 0n
                        ? "Today's Spending Pace"
                        : "Today's Spending"}
                    </Text>
                  </View>

                  {dailyOverview && BigInt(dailyOverview.limitPaise || '0') > 0n ? (
                    dailyOverview.isExceeded ? (
                      <View style={styles.dailyStatusPillDanger}>
                        <AlertCircle size={10} color={theme.colors.expense} />
                        <Text style={styles.dailyStatusTextDanger}>
                          +{formatPaiseToRupees(dailyOverview.exceededByPaise)} over pace
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.dailyStatusPillSafe}>
                        <CheckCircle2 size={10} color={theme.colors.primary} />
                        <Text style={styles.dailyStatusTextSafe}>
                          {formatPaiseToRupees(dailyOverview.remainingPaise)} left today
                        </Text>
                      </View>
                    )
                  ) : null}
                </View>

                {/* Main Spending Row */}
                <View style={styles.dailyMainRow}>
                  <View>
                    <Text style={styles.dailySpentAmount}>
                      {formatPaiseToRupees(todaySpentPaise)}
                    </Text>
                    <Text style={styles.dailySpentSubtext}>spent today</Text>
                  </View>
                  {dailyOverview && BigInt(dailyOverview.limitPaise || '0') > 0n && (
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.dailyTargetPill}>
                        Target {formatPaiseToRupees(dailyOverview.limitPaise)} / day
                      </Text>
                      <Text style={styles.dailyTargetSubtext}>
                        from {budget ? budget.name : 'active plan'}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Daily Progress Line Bar */}
                {dailyOverview && BigInt(dailyOverview.limitPaise || '0') > 0n && (
                  <View style={styles.dailyProgressBarBg}>
                    <View
                      style={[
                        styles.dailyProgressBarFill,
                        {
                          width: `${dailyBarWidth}%`,
                          backgroundColor: dailyOverview.isExceeded
                            ? theme.colors.expense
                            : dailyUsagePercent > 85
                            ? theme.colors.alertAmber
                            : theme.colors.primary,
                        },
                      ]}
                    />
                  </View>
                )}

                {/* Connector Strip / Action Context Divider */}
                <View style={styles.actionConnectorStrip}>
                  <View style={styles.connectorLine} />
                  <Text style={styles.connectorText}>Quick Log for Today</Text>
                  <View style={styles.connectorLine} />
                </View>

                {/* Integrated Action Buttons: Add Expense & Add Income */}
                <View style={styles.integratedActionsRow}>
                  {/* Add Expense Button */}
                  <TouchableOpacity
                    style={[styles.integratedActionBtn, styles.expenseBtnBorder]}
                    onPress={() => router.push('/add-transaction?type=EXPENSE')}
                    activeOpacity={0.82}
                  >
                    <View style={styles.integratedActionHeader}>
                      <View style={[styles.actionIconPill, { backgroundColor: 'rgba(251, 113, 133, 0.15)' }]}>
                        <TrendingDown size={16} color={theme.colors.expense} />
                      </View>
                      <View style={styles.actionBadgeExpense}>
                        <Minus size={9} color={theme.colors.expense} />
                        <Text style={styles.actionBadgeTextExpense}>Expense</Text>
                      </View>
                    </View>
                    <Text style={styles.integratedActionTitle}>Add Expense</Text>
                    <Text style={styles.integratedActionSubtitle} numberOfLines={1}>
                      Deducts from today&apos;s pace
                    </Text>
                  </TouchableOpacity>

                  {/* Add Income Button */}
                  <TouchableOpacity
                    style={[styles.integratedActionBtn, styles.incomeBtnBorder]}
                    onPress={() => router.push('/add-transaction?type=INCOME')}
                    activeOpacity={0.82}
                  >
                    <View style={styles.integratedActionHeader}>
                      <View style={[styles.actionIconPill, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                        <TrendingUp size={16} color={theme.colors.income} />
                      </View>
                      <View style={styles.actionBadgeIncome}>
                        <Plus size={9} color={theme.colors.income} />
                        <Text style={styles.actionBadgeTextIncome}>Income</Text>
                      </View>
                    </View>
                    <Text style={styles.integratedActionTitle}>Add Income</Text>
                    <Text style={styles.integratedActionSubtitle} numberOfLines={1}>
                      Boosts month &amp; daily pace
                    </Text>
                  </TouchableOpacity>
                </View>
              </Card>

              {/* Secondary Shortcuts: Budgets & CSV Import */}
              <View style={styles.secondaryShortcutsRow}>
                <TouchableOpacity
                  style={styles.secondaryShortcutPill}
                  onPress={() => router.push('/budgets')}
                  activeOpacity={0.7}
                >
                  <Target size={14} color={theme.colors.accent} />
                  <Text style={styles.secondaryShortcutText}>Manage Budgets</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.secondaryShortcutPill}
                  onPress={() => router.push('/import-statement')}
                  activeOpacity={0.7}
                >
                  <FileSpreadsheet size={14} color={theme.colors.info} />
                  <Text style={styles.secondaryShortcutText}>Import Statement CSV</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* 4. RECENT TRANSACTIONS */}
            <View style={styles.transactionsWrap}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionHeading}>Recent Transactions</Text>
                {recentTransactions.length > 0 && (
                  <TouchableOpacity onPress={() => router.push('/activity')}>
                    <Text style={styles.viewAllLink}>View All</Text>
                  </TouchableOpacity>
                )}
              </View>

              {recentTransactions.length === 0 ? (
                <Card style={styles.emptyCard} variant="subtle">
                  <Text style={styles.emptyText}>No transactions recorded yet</Text>
                  <Text style={styles.emptySubtext}>
                    Tap &ldquo;Add Expense&rdquo; or &ldquo;Add Income&rdquo; above to log your first transaction.
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
                      <View key={tx.id} style={styles.txCard}>
                        <View
                          style={[
                            styles.txIconBox,
                            {
                              backgroundColor: isExpense
                                ? 'rgba(251, 113, 133, 0.10)'
                                : 'rgba(16, 185, 129, 0.10)',
                            },
                          ]}
                        >
                          {isExpense ? (
                            <TrendingDown size={16} color={theme.colors.expense} />
                          ) : (
                            <TrendingUp size={16} color={theme.colors.income} />
                          )}
                        </View>

                        <View style={styles.txInfo}>
                          <Text style={styles.txTitle} numberOfLines={1}>
                            {tx.merchantName || tx.description}
                          </Text>
                          <View style={styles.txMetaRow}>
                            <Text style={styles.txDate}>{formattedDate}</Text>
                            {tx.category ? (
                              <View style={styles.categoryBadge}>
                                <Tag size={9} color={tx.category.color || theme.colors.textMuted} />
                                <Text style={styles.categoryBadgeText}>{tx.category.name}</Text>
                              </View>
                            ) : null}
                          </View>
                        </View>

                        <Text
                          style={[
                            styles.txAmountText,
                            { color: isExpense ? theme.colors.expense : theme.colors.income },
                          ]}
                        >
                          {isExpense ? '-' : '+'}
                          {formatPaiseToRupees(tx.amountPaise)}
                        </Text>
                      </View>
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

const getStyles = (theme: Theme, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollContent: {
      paddingBottom: 40,
    },
    bellBtn: {
      position: 'relative',
      padding: 9,
      borderRadius: 999,
      backgroundColor: theme.colors.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    bellBadge: {
      position: 'absolute',
      top: -2,
      right: -2,
      backgroundColor: theme.colors.danger,
      minWidth: 16,
      height: 16,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 3,
    },
    bellBadgeText: {
      color: '#ffffff',
      fontSize: 9,
      fontWeight: '700',
    },

    // GUEST EXPERIENCE
    guestContainer: {
      paddingHorizontal: 16,
      marginTop: 8,
    },
    guestHeroCard: {
      padding: 24,
      borderRadius: 20,
      backgroundColor: theme.colors.surface,
      alignItems: 'center',
      textAlign: 'center',
      borderWidth: 1,
      borderColor: theme.colors.surfaceBorder,
    },
    guestIconBadge: {
      width: 48,
      height: 48,
      borderRadius: 14,
      backgroundColor: 'rgba(16, 185, 129, 0.12)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 14,
    },
    guestHeroTitle: {
      fontSize: 22,
      fontWeight: '800',
      letterSpacing: -0.5,
      color: theme.colors.textPrimary,
      textAlign: 'center',
    },
    guestHeroSubtitle: {
      fontSize: 13.5,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
      marginTop: 8,
      paddingHorizontal: 8,
    },
    guestBtnGroup: {
      width: '100%',
      marginTop: 20,
    },
    guestPrimaryBtn: {
      width: '100%',
    },
    guestFeaturesRow: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 14,
    },
    guestFeatureCard: {
      flex: 1,
      padding: 16,
      backgroundColor: theme.colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.colors.surfaceBorder,
    },
    guestFeatureTitle: {
      fontSize: 13.5,
      fontWeight: '700',
      color: theme.colors.textPrimary,
      marginTop: 8,
    },
    guestFeatureDesc: {
      fontSize: 11.5,
      color: theme.colors.textMuted,
      lineHeight: 16,
      marginTop: 4,
    },

    // 1. HERO TOTAL CARD
    heroCardTouchable: {
      marginHorizontal: 16,
    },
    heroCard: {
      padding: 20,
      backgroundColor: theme.colors.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.colors.surfaceBorder,
    },
    heroHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    heroBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 9,
      paddingVertical: 3.5,
      borderRadius: 999,
      backgroundColor: theme.colors.surfaceSubtle,
      borderWidth: 1,
      borderColor: theme.colors.border,
      maxWidth: '70%',
    },
    heroBadgeText: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.colors.textSecondary,
      letterSpacing: 0.2,
    },
    heroDaysPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
      backgroundColor: theme.colors.surfaceSubtle,
    },
    heroDaysPillText: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.colors.textMuted,
    },
    heroLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginTop: 4,
    },
    heroAmount: {
      fontSize: 34,
      fontWeight: '800',
      color: theme.colors.textPrimary,
      letterSpacing: -0.8,
    },
    incomeBoostPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
      backgroundColor: 'rgba(16, 185, 129, 0.12)',
      borderWidth: 1,
      borderColor: 'rgba(16, 185, 129, 0.25)',
    },
    incomeBoostText: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.colors.income,
    },
    noBudgetHeading: {
      fontSize: 22,
      fontWeight: '800',
      color: theme.colors.textPrimary,
      marginTop: 6,
      marginBottom: 4,
      letterSpacing: -0.4,
    },
    heroSubnote: {
      fontSize: 12.5,
      color: theme.colors.textSecondary,
      marginTop: 4,
      marginBottom: 6,
      lineHeight: 18,
    },
    progressContainer: {
      marginTop: 14,
    },
    progressBarBg: {
      height: 7,
      backgroundColor: theme.colors.surfaceAlt,
      borderRadius: 999,
      overflow: 'hidden',
    },
    progressBarFill: {
      height: '100%',
      borderRadius: 999,
    },
    progressMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 7,
    },
    progressSpentText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.textSecondary,
    },
    progressRemainingText: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.colors.primary,
    },
    heroFooterRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 14,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    heroFooterLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    heroFooterLabel: {
      fontSize: 11.5,
      color: theme.colors.textMuted,
      fontWeight: '500',
    },
    heroFooterValue: {
      fontSize: 12.5,
      fontWeight: '700',
      color: theme.colors.textSecondary,
    },

    // Set Budget Prompt inside Hero when no budget
    setBudgetPrompt: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: theme.colors.surfaceSubtle,
      borderRadius: 12,
      padding: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginTop: 16,
    },
    setBudgetPromptLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flex: 1,
      marginRight: 8,
    },
    setBudgetPromptTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.colors.textPrimary,
    },
    setBudgetPromptSubtitle: {
      fontSize: 11,
      color: theme.colors.textMuted,
      marginTop: 1,
    },
    setBudgetBtn: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: theme.colors.primaryBg,
      borderWidth: 1,
      borderColor: `${theme.colors.primary}40`,
    },
    setBudgetBtnText: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.colors.primary,
    },

    // 2. UNIFIED TODAY'S SPENDING HUB & ACTIONS
    dailySectionWrap: {
      marginTop: 12,
      paddingHorizontal: 16,
    },
    dailyHubCard: {
      padding: 18,
      backgroundColor: theme.colors.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.colors.surfaceBorder,
    },
    dailyCardExceeded: {
      borderColor: 'rgba(251, 113, 133, 0.35)',
    },
    dailyHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 6,
    },
    dailyTitleWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    dailySectionLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    dailyStatusPillSafe: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
      backgroundColor: 'rgba(16, 185, 129, 0.10)',
    },
    dailyStatusTextSafe: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.colors.primary,
    },
    dailyStatusPillDanger: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
      backgroundColor: 'rgba(251, 113, 133, 0.12)',
    },
    dailyStatusTextDanger: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.colors.expense,
    },
    dailyMainRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      marginTop: 4,
    },
    dailySpentAmount: {
      fontSize: 26,
      fontWeight: '800',
      color: theme.colors.textPrimary,
      letterSpacing: -0.5,
    },
    dailySpentSubtext: {
      fontSize: 11.5,
      fontWeight: '500',
      color: theme.colors.textMuted,
      marginTop: 1,
    },
    dailyTargetPill: {
      fontSize: 12.5,
      fontWeight: '700',
      color: theme.colors.textPrimary,
      letterSpacing: -0.2,
    },
    dailyTargetSubtext: {
      fontSize: 11,
      fontWeight: '500',
      color: theme.colors.textMuted,
      marginTop: 2,
    },
    dailyProgressBarBg: {
      height: 5,
      backgroundColor: theme.colors.surfaceAlt,
      borderRadius: 999,
      overflow: 'hidden',
      marginTop: 12,
    },
    dailyProgressBarFill: {
      height: '100%',
      borderRadius: 999,
    },
    actionConnectorStrip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginTop: 16,
      marginBottom: 12,
    },
    connectorLine: {
      flex: 1,
      height: 1,
      backgroundColor: theme.colors.border,
    },
    connectorText: {
      fontSize: 10.5,
      fontWeight: '700',
      color: theme.colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    integratedActionsRow: {
      flexDirection: 'row',
      gap: 10,
    },
    integratedActionBtn: {
      flex: 1,
      padding: 12,
      backgroundColor: theme.colors.surfaceAlt,
      borderRadius: 14,
      borderWidth: 1,
    },
    expenseBtnBorder: {
      borderColor: 'rgba(251, 113, 133, 0.30)',
    },
    incomeBtnBorder: {
      borderColor: 'rgba(16, 185, 129, 0.30)',
    },
    integratedActionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    actionIconPill: {
      width: 32,
      height: 32,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionBadgeExpense: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 999,
      backgroundColor: 'rgba(251, 113, 133, 0.14)',
    },
    actionBadgeTextExpense: {
      fontSize: 9.5,
      fontWeight: '700',
      color: theme.colors.expense,
    },
    actionBadgeIncome: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 999,
      backgroundColor: 'rgba(16, 185, 129, 0.14)',
    },
    actionBadgeTextIncome: {
      fontSize: 9.5,
      fontWeight: '700',
      color: theme.colors.income,
    },
    integratedActionTitle: {
      fontSize: 14.5,
      fontWeight: '800',
      color: theme.colors.textPrimary,
      letterSpacing: -0.2,
    },
    integratedActionSubtitle: {
      fontSize: 10.5,
      color: theme.colors.textMuted,
      marginTop: 2,
    },

    // Secondary shortcuts
    secondaryShortcutsRow: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 10,
    },
    secondaryShortcutPill: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 10,
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.surfaceBorder,
    },
    secondaryShortcutText: {
      fontSize: 11.5,
      fontWeight: '600',
      color: theme.colors.textSecondary,
    },

    // 4. RECENT TRANSACTIONS
    transactionsWrap: {
      marginTop: 20,
      paddingHorizontal: 16,
    },
    sectionHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    sectionHeading: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.colors.textPrimary,
      letterSpacing: -0.2,
    },
    viewAllLink: {
      fontSize: 12.5,
      fontWeight: '600',
      color: theme.colors.primary,
    },
    emptyCard: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 24,
      borderRadius: 14,
    },
    emptyText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.textSecondary,
    },
    emptySubtext: {
      fontSize: 12,
      color: theme.colors.textMuted,
      marginTop: 4,
      textAlign: 'center',
    },
    txList: {
      gap: 8,
    },
    txCard: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: 14,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.surfaceBorder,
    },
    txIconBox: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    txInfo: {
      flex: 1,
    },
    txTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.textPrimary,
      letterSpacing: -0.2,
    },
    txMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 2,
    },
    txDate: {
      fontSize: 11.5,
      color: theme.colors.textMuted,
    },
    categoryBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      paddingHorizontal: 5,
      paddingVertical: 1.5,
      borderRadius: 4,
      backgroundColor: theme.colors.surfaceSubtle,
    },
    categoryBadgeText: {
      fontSize: 10,
      fontWeight: '600',
      color: theme.colors.textSecondary,
    },
    txAmountText: {
      fontSize: 15,
      fontWeight: '700',
      letterSpacing: -0.3,
      marginLeft: 8,
    },
  });
