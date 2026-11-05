import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeRouter } from '../../hooks/useSafeRouter';
import { useFocusEffect } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Target,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Calendar,
  Sliders,
  SlidersHorizontal,
  RotateCcw,
  Trash2,
  Tag,
  CheckCircle2,
  Sparkles,
  Layers,
  Check,
} from 'lucide-react-native';
import { api, formatPaiseToRupees } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import { useTheme, Theme } from '../../lib/theme';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Header } from '../../components/Header';
import { Budget, BudgetStatusLevel } from '../../types';

export default function BudgetsScreen() {
  const router = useSafeRouter();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();
  const { theme } = useTheme();
  const styles = React.useMemo(() => getStyles(theme), [theme]);

  const [selectedBudgetId, setSelectedBudgetId] = useState<string | null>(null);
  const [activatingBudgetId, setActivatingBudgetId] = useState<string | null>(null);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [budgetToDelete, setBudgetToDelete] = useState<Budget | null>(null);
  const [alsoDeleteTransactions, setAlsoDeleteTransactions] = useState(false);

  const {
    data: budgets = [],
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['budgets'],
    queryFn: api.getBudgets,
    enabled: isAuthenticated,
  });

  // Automatically refresh budgets whenever tab is focused
  useFocusEffect(
    React.useCallback(() => {
      if (isAuthenticated) {
        refetch();
      }
    }, [isAuthenticated, refetch])
  );

  // Current selected budget for full details (defaults to active or first)
  const currentBudget = React.useMemo(() => {
    if (!budgets || budgets.length === 0) return null;
    if (selectedBudgetId) {
      const found = budgets.find((b) => b.id === selectedBudgetId);
      if (found) return found;
    }
    return budgets.find((b) => b.isActive) || budgets[0];
  }, [budgets, selectedBudgetId]);

  // Activate budget mutation. No optimistic cache writes: we always re-read
  // the authoritative state from the server.
  const activateMutation = useMutation({
    mutationFn: (id: string) => api.activateBudget(id),
    onMutate: (id: string) => {
      setActivatingBudgetId(id);
      setSelectedBudgetId(id);
    },
    onSettled: async () => {
      setActivatingBudgetId(null);
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ['budgets'], type: 'all' }),
        queryClient.refetchQueries({ queryKey: ['dashboard'], type: 'all' }),
        queryClient.refetchQueries({ queryKey: ['insights'], type: 'all' }),
      ]);
    },
  });

  const handleActivate = (id: string) => {
    if (activatingBudgetId || activateMutation.isPending) return;
    activateMutation.mutate(id);
  };

  // Delete budget mutation
  const deleteMutation = useMutation({
    mutationFn: async ({ id, clearTransactions }: { id: string; clearTransactions?: boolean }) => {
      await api.deleteBudget(id, { clearTransactions });
    },
    onSuccess: async () => {
      setSelectedBudgetId(null);
      setDeleteModalVisible(false);
      setBudgetToDelete(null);
      setAlsoDeleteTransactions(false);
      await Promise.all([
        queryClient.resetQueries({ queryKey: ['budgets'] }),
        queryClient.resetQueries({ queryKey: ['dashboard'] }),
        queryClient.resetQueries({ queryKey: ['insights'] }),
        queryClient.resetQueries({ queryKey: ['transactions'] }),
      ]);
    },
  });

  const handleDeleteAndCreateNew = async () => {
    if (deleteMutation.isPending) return;
    const target = budgetToDelete || currentBudget;
    if (!target) return;
    try {
      await deleteMutation.mutateAsync({
        id: target.id,
        clearTransactions: alsoDeleteTransactions,
      });
      router.push({ pathname: '/create-budget', params: { reset: 'true' } });
    } catch {}
  };

  const handleDeleteCompletely = () => {
    if (deleteMutation.isPending) return;
    const target = budgetToDelete || currentBudget;
    if (target) {
      deleteMutation.mutate({
        id: target.id,
        clearTransactions: alsoDeleteTransactions,
      });
    }
  };

  const getStatusColor = (status: BudgetStatusLevel): string => {
    switch (status) {
      case 'EXCEEDED':
        return theme.colors.danger;
      case 'WARNING_90':
        return theme.colors.danger;
      case 'WARNING_70':
        return theme.colors.warning;
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
            title="New Plan"
            size="sm"
            onPress={() => {
              if (!isAuthenticated) {
                router.push('/auth');
              } else {
                router.push({ pathname: '/create-budget', params: { reset: 'true' } });
              }
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
            onRefresh={() => {
              refetch();
            }}
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
        ) : !currentBudget ? (
          <Card style={styles.emptyCard} variant="subtle">
            <Target size={40} color={theme.colors.accent} />
            <Text style={styles.emptyTitle}>No budget configured yet</Text>
            <Text style={styles.emptySubtitle}>
              Set a monthly spending limit to unlock dynamic safe-to-spend allowances and proactive threshold alerts on your homepage.
            </Text>
            <Button
              title="Create New Budget"
              onPress={() => router.push({ pathname: '/create-budget', params: { reset: 'true' } })}
              icon={<Plus size={16} color={theme.colors.textInverse} />}
              style={{ marginTop: theme.spacing.md }}
            />
          </Card>
        ) : (
          <>
            {/* Multiple Plans Switcher / Carousel */}
            {budgets.length > 0 && (
              <View style={styles.plansSection}>
                <View style={styles.plansSectionHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Layers size={16} color={theme.colors.primary} />
                    <Text style={styles.plansSectionTitle}>
                      Budget Plans ({budgets.length})
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.newPlanInlineBtn}
                    onPress={() => router.push({ pathname: '/create-budget', params: { reset: 'true' } })}
                    activeOpacity={0.7}
                  >
                    <Plus size={13} color={theme.colors.primary} />
                    <Text style={styles.newPlanInlineBtnText}>Add Plan</Text>
                  </TouchableOpacity>
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.plansScrollRow}
                >
                  {budgets.map((b) => {
                    const isSelected = currentBudget.id === b.id;
                    const isActivePlan = b.isActive;
                    const isActivatingThis = activatingBudgetId === b.id;
                    const daysRemaining = b.periodDetails?.remainingDays ?? 0;

                    return (
                      <View
                        key={b.id}
                        style={[
                          styles.planPillCard,
                          isSelected && styles.planPillCardSelected,
                        ]}
                      >
                        <View style={styles.planPillHeader}>
                          <TouchableOpacity
                            style={{ flex: 1, marginRight: 6 }}
                            onPress={() => setSelectedBudgetId(b.id)}
                            activeOpacity={0.7}
                          >
                            <Text
                              style={[
                                styles.planPillName,
                                isSelected && { color: theme.colors.textPrimary },
                              ]}
                              numberOfLines={1}
                            >
                              {b.name}
                            </Text>
                          </TouchableOpacity>

                          {isActivePlan ? (
                            <View style={styles.activePlanBadge}>
                              <View style={styles.activeDot} />
                              <Text style={styles.activePlanBadgeText}>Active</Text>
                            </View>
                          ) : (
                            <TouchableOpacity
                              style={[
                                styles.activatePlanBtn,
                                isActivatingThis && { opacity: 0.7 },
                              ]}
                              onPress={() => handleActivate(b.id)}
                              disabled={!!activatingBudgetId || deleteMutation.isPending}
                              activeOpacity={0.75}
                            >
                              {isActivatingThis ? (
                                <ActivityIndicator size="small" color={theme.colors.primary} />
                              ) : (
                                <Text style={styles.activatePlanBtnText}>Set Active</Text>
                              )}
                            </TouchableOpacity>
                          )}
                        </View>

                        <TouchableOpacity
                          onPress={() => setSelectedBudgetId(b.id)}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.planPillLimit}>
                            {formatPaiseToRupees(b.limitPaise)}
                            <Text style={styles.planPillPeriod}> / mo</Text>
                          </Text>
                          <View style={styles.planPillMetaRow}>
                            <Text style={styles.planPillSpent}>
                              {formatPaiseToRupees(b.spentPaise || '0')} spent
                            </Text>
                            <Text style={styles.planPillDays}>
                              {daysRemaining > 0 ? `${daysRemaining}d left` : 'Cycle ended'}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* Inactive Plan Notice & Toggle */}
            {!currentBudget.isActive && (
              <View style={styles.inactivePlanBanner}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inactivePlanTitle}>Inactive Budget Plan</Text>
                  <Text style={styles.inactivePlanSubtitle}>
                    This plan is saved. Activate it to display on your Homepage and track live expenses against it.
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.activateNowBtn}
                  onPress={() => handleActivate(currentBudget.id)}
                  disabled={!!activatingBudgetId || deleteMutation.isPending}
                  activeOpacity={0.75}
                >
                  {activatingBudgetId === currentBudget.id ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <CheckCircle2 size={14} color="#FFFFFF" />
                      <Text style={styles.activateNowBtnText}>Make Active</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {/* Overall Budget Allowance Card */}
            <Card style={styles.overviewCard}>
              <View style={styles.overviewHeader}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.budgetName}>{currentBudget.name}</Text>
                    {currentBudget.isActive && (
                      <View style={styles.homeActiveBadge}>
                        <View style={styles.activeDot} />
                        <Text style={styles.homeActiveBadgeText}>Active on Home</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.periodText}>
                    {currentBudget.period} • {currentBudget.periodDetails?.remainingDays ?? 0} days remaining
                  </Text>
                </View>

                <View
                  style={[
                    styles.statusPill,
                    { backgroundColor: `${getStatusColor(currentBudget.status)}20` },
                  ]}
                >
                  {currentBudget.status === 'ON_TRACK' ? (
                    <ShieldCheck size={14} color={getStatusColor(currentBudget.status)} />
                  ) : (
                    <ShieldAlert size={14} color={getStatusColor(currentBudget.status)} />
                  )}
                  <Text
                    style={[
                      styles.statusPillText,
                      { color: getStatusColor(currentBudget.status) },
                    ]}
                  >
                    {getStatusLabel(currentBudget.status)}
                  </Text>
                </View>
              </View>

              <View style={styles.amountCompareRow}>
                <View>
                  <Text style={styles.metricLabel}>Spent</Text>
                  <Text style={styles.spentAmount}>
                    {formatPaiseToRupees(currentBudget.spentPaise || '0')}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.metricLabel}>Budget Ceiling</Text>
                  <Text style={styles.limitAmount}>
                    {formatPaiseToRupees(currentBudget.limitPaise || '0')}
                  </Text>
                  {currentBudget.incomePaise && BigInt(currentBudget.incomePaise) > 0n ? (
                    <Text style={{ fontSize: 11, color: theme.colors.income, fontWeight: '700', marginTop: 2 }}>
                      +{formatPaiseToRupees(currentBudget.incomePaise)} income added
                    </Text>
                  ) : null}
                </View>
              </View>

              {/* Progress Bar */}
              <View style={styles.progressBarBackground}>
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width: `${Math.min(100, Math.max(0, currentBudget.usagePercentage || 0))}%`,
                      backgroundColor: getStatusColor(currentBudget.status),
                    },
                  ]}
                />
              </View>

              <View style={styles.progressFooter}>
                <Text style={styles.percentageText}>
                  {Math.round(currentBudget.usagePercentage || 0)}% spent
                </Text>
                <Text style={styles.remainingText}>
                  {BigInt(currentBudget.remainingPaise || '0') >= 0n
                    ? `${formatPaiseToRupees(currentBudget.remainingPaise || '0')} left`
                    : `${formatPaiseToRupees(BigInt(currentBudget.remainingPaise || '0') * -1n)} over budget`}
                </Text>
              </View>

              {/* Safe to Spend Widget */}
              <View style={styles.safeSpendBanner}>
                <View style={styles.safeSpendIcon}>
                  <Sliders size={18} color={theme.colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.safeSpendTitle}>Daily Safe-to-Spend</Text>
                  <Text style={styles.safeSpendDescription}>
                    Based on {currentBudget.periodDetails?.remainingDays ?? 0} days remaining in cycle
                  </Text>
                </View>
                <Text style={styles.safeSpendAmount}>
                  {formatPaiseToRupees(currentBudget.safeToSpendTodayPaise || '0')}
                  <Text style={styles.perDayText}>/day</Text>
                </Text>
              </View>

              {/* Planned Daily & Weekly Targets */}
              {(currentBudget.dailyLimitPaise || currentBudget.weeklyLimitPaise) && (
                <View style={styles.plannedLimitsRow}>
                  {currentBudget.dailyLimitPaise && (
                    <View style={styles.plannedLimitBadge}>
                      <Text style={styles.plannedLimitLabel}>Daily Pace Target:</Text>
                      <Text style={styles.plannedLimitValue}>
                        {formatPaiseToRupees(currentBudget.dailyLimitPaise)}/day
                      </Text>
                    </View>
                  )}
                  {currentBudget.weeklyLimitPaise && (
                    <View style={styles.plannedLimitBadge}>
                      <Text style={styles.plannedLimitLabel}>Weekly Target:</Text>
                      <Text style={styles.plannedLimitValue}>
                        {formatPaiseToRupees(currentBudget.weeklyLimitPaise)}/wk
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* Action Strip: Edit, Toggle Active, or Delete */}
              <View style={styles.actionControlsRow}>
                <TouchableOpacity
                  style={styles.actionButtonSecondary}
                  activeOpacity={0.75}
                  onPress={() =>
                    router.push({
                      pathname: '/create-budget',
                      params: { budgetId: currentBudget.id, reset: 'false' },
                    })
                  }
                >
                  <SlidersHorizontal size={14} color={theme.colors.primary} />
                  <Text style={styles.actionButtonSecondaryText} numberOfLines={1}>
                    Edit Plan
                  </Text>
                </TouchableOpacity>

                {!currentBudget.isActive ? (
                  <TouchableOpacity
                    style={styles.actionButtonActivate}
                    activeOpacity={0.75}
                    onPress={() => handleActivate(currentBudget.id)}
                    disabled={!!activatingBudgetId}
                  >
                    {activatingBudgetId === currentBudget.id ? (
                      <ActivityIndicator size="small" color={theme.colors.textInverse} />
                    ) : (
                      <>
                        <CheckCircle2 size={14} color={theme.colors.textInverse} />
                        <Text style={styles.actionButtonActivateText} numberOfLines={1}>
                          Set Active
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={styles.actionButtonAccent}
                    activeOpacity={0.75}
                    onPress={() =>
                      router.push({ pathname: '/create-budget', params: { reset: 'true' } })
                    }
                  >
                    <Plus size={14} color={theme.colors.accent} />
                    <Text style={styles.actionButtonAccentText} numberOfLines={1}>
                      New Plan
                    </Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[
                    styles.actionButtonDanger,
                    (!!activatingBudgetId || deleteMutation.isPending) && { opacity: 0.5 },
                  ]}
                  activeOpacity={0.75}
                  disabled={!!activatingBudgetId || deleteMutation.isPending}
                  onPress={() => {
                    setBudgetToDelete(currentBudget);
                    setDeleteModalVisible(true);
                  }}
                >
                  <Trash2 size={14} color={theme.colors.danger} />
                  <Text style={styles.actionButtonDangerText} numberOfLines={1}>
                    Delete
                  </Text>
                </TouchableOpacity>
              </View>
            </Card>

            {/* Category Allocations Section */}
            <View style={styles.categoriesSection}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Category Budgets</Text>
                <TouchableOpacity
                  style={styles.manageCategoryBtn}
                  activeOpacity={0.7}
                  onPress={() =>
                    router.push({
                      pathname: '/create-budget',
                      params: { budgetId: currentBudget.id, reset: 'false' },
                    })
                  }
                >
                  <SlidersHorizontal size={12} color={theme.colors.primary} />
                  <Text style={styles.manageText}>Adjust Limits</Text>
                </TouchableOpacity>
              </View>

              {(!currentBudget.categories || currentBudget.categories.length === 0) ? (
                <Card style={styles.emptyCategoryCard} variant="subtle">
                  <Text style={styles.emptyCatTitle}>No category limits configured</Text>
                  <Text style={styles.emptyCatSubtitle}>
                    Set individual targets for Food, Shopping, or Travel to prevent overspending in key areas.
                  </Text>
                </Card>
              ) : (
                <View style={styles.categoryList}>
                  {currentBudget.categories.map((cat) => {
                    const statusColor = getStatusColor(cat.status);
                    const catName = cat.category?.name || 'Category';
                    const catColor = cat.category?.color || theme.colors.primary;
                    const catSpent = formatPaiseToRupees(cat.spentPaise || '0');
                    const catLimit = formatPaiseToRupees(cat.limitPaise || '0');
                    const catUsage = Math.min(100, Math.max(0, cat.usagePercentage || 0));

                    return (
                      <Card key={cat.id} style={styles.catCard} variant="subtle">
                        <View style={styles.catCardHeader}>
                          <View style={styles.catInfoRow}>
                            <View
                              style={[
                                styles.catDot,
                                { backgroundColor: catColor },
                              ]}
                            />
                            <Text style={styles.catName}>{catName}</Text>
                          </View>
                          <Text style={[styles.catPercentage, { color: statusColor }]}>
                            {catUsage}%
                          </Text>
                        </View>

                        <View style={styles.catValuesRow}>
                          <Text style={styles.catSpent}>
                            {catSpent} spent
                          </Text>
                          <Text style={styles.catLimit}>
                            Limit: {catLimit}
                          </Text>
                        </View>

                        {/* Category Progress Bar */}
                        <View style={styles.catProgressBarBg}>
                          <View
                            style={[
                              styles.catProgressBarFill,
                              {
                                width: `${catUsage}%`,
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

      {/* Remove / Delete Confirmation Modal */}
      <Modal
        visible={deleteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Card style={styles.deleteModalCard}>
            <View style={styles.deleteModalIconWrap}>
              <Trash2 size={28} color={theme.colors.danger} />
            </View>

            <Text style={styles.deleteModalTitle}>Delete Budget Plan?</Text>
            <Text style={styles.deleteModalDescription}>
              This will permanently delete{' '}
              <Text style={{ fontWeight: '700', color: theme.colors.textPrimary }}>
                {budgetToDelete?.name || currentBudget?.name}
              </Text>
              . If this plan was active on your homepage, your remaining plans or "No Active Budget" will be displayed instead.
            </Text>

            {/* Clean Slate Option: Also clear month's transactions */}
            <TouchableOpacity
              style={styles.clearTxsToggleRow}
              onPress={() => setAlsoDeleteTransactions(!alsoDeleteTransactions)}
              activeOpacity={0.8}
            >
              <View style={[styles.checkboxBox, alsoDeleteTransactions && styles.checkboxBoxActive]}>
                {alsoDeleteTransactions && <Check size={14} color="#FFFFFF" />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.clearTxsToggleTitle}>
                  Clean Slate: Also delete this month's transactions
                </Text>
                <Text style={styles.clearTxsToggleDesc}>
                  {alsoDeleteTransactions
                    ? "✨ All expenses and income logged during this budget cycle will be permanently deleted, starting your next plan with ₹0 spent."
                    : "Retains your transaction history. If you create a new budget for this month, those transactions will be counted."}
                </Text>
              </View>
            </TouchableOpacity>

            <View style={styles.deleteModalButtons}>
              <Button
                title="Delete & Set Up New Plan"
                onPress={handleDeleteAndCreateNew}
                loading={deleteMutation.isPending}
                disabled={deleteMutation.isPending}
                icon={<RotateCcw size={16} color={theme.colors.textInverse} />}
                style={{ width: '100%' }}
              />

              <Button
                title="Delete Plan Completely"
                variant="danger"
                onPress={handleDeleteCompletely}
                loading={deleteMutation.isPending}
                disabled={deleteMutation.isPending}
                icon={<Trash2 size={16} color={theme.colors.textInverse} />}
                style={{ width: '100%' }}
              />

              <Button
                title="Cancel"
                variant="secondary"
                onPress={() => {
                  setDeleteModalVisible(false);
                  setBudgetToDelete(null);
                }}
                disabled={deleteMutation.isPending}
                style={{ width: '100%' }}
              />
            </View>
          </Card>
        </View>
      </Modal>
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
    },
    loadingWrapper: {
      paddingVertical: 40,
      alignItems: 'center',
    },
    emptyCard: {
      alignItems: 'center',
      paddingVertical: 40,
      paddingHorizontal: 16,
      gap: 12,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.colors.textPrimary,
      marginTop: 8,
    },
    emptySubtitle: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      maxWidth: 280,
    },
    plansSection: {
      marginBottom: 16,
    },
    plansSectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    plansSectionTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    newPlanInlineBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 6,
      backgroundColor: theme.colors.surfaceAlt,
    },
    newPlanInlineBtnText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.primary,
    },
    plansScrollRow: {
      gap: 10,
      paddingRight: 10,
    },
    planPillCard: {
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 12,
      padding: 12,
      minWidth: 180,
      maxWidth: 220,
    },
    planPillCardSelected: {
      borderColor: theme.colors.primary,
      borderWidth: 1.5,
      backgroundColor: `${theme.colors.primary}08`,
    },
    planPillHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      marginBottom: 6,
    },
    planPillName: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.colors.textSecondary,
      flex: 1,
    },
    activePlanBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: `${theme.colors.primary}20`,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 999,
    },
    activeDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.colors.primary,
    },
    activePlanBadgeText: {
      fontSize: 10,
      fontWeight: '700',
      color: theme.colors.primary,
    },
    activatePlanBtn: {
      backgroundColor: theme.colors.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
    },
    activatePlanBtnText: {
      fontSize: 10,
      fontWeight: '600',
      color: theme.colors.textSecondary,
    },
    planPillLimit: {
      fontSize: 16,
      fontWeight: '800',
      color: theme.colors.textPrimary,
    },
    planPillPeriod: {
      fontSize: 11,
      fontWeight: '500',
      color: theme.colors.textMuted,
    },
    planPillMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 4,
    },
    planPillSpent: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.colors.textSecondary,
    },
    planPillDays: {
      fontSize: 10.5,
      fontWeight: '500',
      color: theme.colors.textMuted,
    },
    inactivePlanBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.colors.warning,
      borderRadius: 12,
      padding: 12,
      marginBottom: 16,
      gap: 12,
    },
    inactivePlanTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.colors.warning,
    },
    inactivePlanSubtitle: {
      fontSize: 11,
      color: theme.colors.textSecondary,
      marginTop: 2,
      lineHeight: 15,
    },
    activateNowBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: theme.colors.primary,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
    },
    activateNowBtnText: {
      fontSize: 12,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    overviewCard: {
      padding: 20,
      marginBottom: 20,
      borderRadius: theme.borderRadius.lg,
    },
    overviewHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 16,
    },
    budgetName: {
      fontSize: 20,
      fontWeight: '800',
      letterSpacing: -0.4,
      color: theme.colors.textPrimary,
    },
    homeActiveBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: `${theme.colors.primary}18`,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 999,
    },
    homeActiveBadgeText: {
      fontSize: 10,
      fontWeight: '700',
      color: theme.colors.primary,
    },
    periodText: {
      fontSize: 12,
      color: theme.colors.textMuted,
      marginTop: 2,
    },
    statusPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
    },
    statusPillText: {
      fontSize: 11,
      fontWeight: '700',
    },
    amountCompareRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      marginBottom: 10,
    },
    metricLabel: {
      fontSize: 11,
      color: theme.colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      fontWeight: '600',
    },
    spentAmount: {
      fontSize: 26,
      fontWeight: '800',
      color: theme.colors.textPrimary,
      marginTop: 3,
      letterSpacing: -0.5,
    },
    limitAmount: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.colors.textSecondary,
      marginTop: 3,
    },
    progressBarBackground: {
      height: 9,
      backgroundColor: theme.colors.surfaceSubtle,
      borderRadius: 999,
      overflow: 'hidden',
      marginVertical: 6,
    },
    progressBarFill: {
      height: '100%',
      borderRadius: 999,
    },
    progressFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 4,
    },
    percentageText: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.colors.textSecondary,
    },
    remainingText: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.colors.textPrimary,
    },
    safeSpendBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.surfaceSubtle,
      borderRadius: 14,
      padding: 13,
      marginTop: 18,
      borderWidth: 1,
      borderColor: theme.colors.border,
      gap: 12,
    },
    safeSpendIcon: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: `${theme.colors.primary}18`,
      alignItems: 'center',
      justifyContent: 'center',
    },
    safeSpendTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.colors.textPrimary,
    },
    safeSpendDescription: {
      fontSize: 11,
      color: theme.colors.textMuted,
      marginTop: 1,
    },
    safeSpendAmount: {
      fontSize: 17,
      fontWeight: '800',
      color: theme.colors.primary,
    },
    perDayText: {
      fontSize: 11,
      color: theme.colors.textMuted,
      fontWeight: '400',
    },
    plannedLimitsRow: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 12,
      flexWrap: 'wrap',
    },
    plannedLimitBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: theme.colors.surfaceSubtle,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    plannedLimitLabel: {
      fontSize: 11,
      color: theme.colors.textSecondary,
      fontWeight: '500',
    },
    plannedLimitValue: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.colors.textPrimary,
    },
    actionControlsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 18,
      paddingTop: 14,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    actionButtonSecondary: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 9,
      paddingHorizontal: 10,
      borderRadius: 10,
      backgroundColor: theme.colors.surfaceSubtle,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    actionButtonSecondaryText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.primary,
    },
    actionButtonActivate: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 9,
      paddingHorizontal: 10,
      borderRadius: 10,
      backgroundColor: theme.colors.primary,
    },
    actionButtonActivateText: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.colors.textInverse,
    },
    actionButtonAccent: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 9,
      paddingHorizontal: 10,
      borderRadius: 10,
      backgroundColor: `${theme.colors.accent}12`,
      borderWidth: 1,
      borderColor: `${theme.colors.accent}40`,
    },
    actionButtonAccentText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.accent,
    },
    actionButtonDanger: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 9,
      paddingHorizontal: 10,
      borderRadius: 10,
      backgroundColor: `${theme.colors.danger}12`,
      borderWidth: 1,
      borderColor: `${theme.colors.danger}35`,
    },
    actionButtonDangerText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.danger,
    },
    categoriesSection: {
      marginTop: 4,
    },
    sectionHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '800',
      letterSpacing: -0.3,
      color: theme.colors.textPrimary,
    },
    manageCategoryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 8,
      backgroundColor: `${theme.colors.primary}12`,
    },
    manageText: {
      fontSize: 12,
      color: theme.colors.primary,
      fontWeight: '700',
    },
    emptyCategoryCard: {
      padding: 24,
      alignItems: 'center',
      borderRadius: theme.borderRadius.lg,
    },
    emptyCatTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.colors.textPrimary,
    },
    emptyCatSubtitle: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      marginTop: 4,
      lineHeight: 16,
    },
    categoryList: {
      gap: 10,
    },
    catCard: {
      padding: 14,
      borderRadius: 14,
    },
    catCardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 6,
    },
    catInfoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    catDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    catName: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.colors.textPrimary,
    },
    catPercentage: {
      fontSize: 13,
      fontWeight: '800',
    },
    catValuesRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    catSpent: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.textPrimary,
    },
    catLimit: {
      fontSize: 12,
      color: theme.colors.textMuted,
    },
    catProgressBarBg: {
      height: 6,
      backgroundColor: theme.colors.surfaceSubtle,
      borderRadius: 999,
      overflow: 'hidden',
    },
    catProgressBarFill: {
      height: '100%',
      borderRadius: 999,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.65)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    deleteModalCard: {
      width: '100%',
      maxWidth: 380,
      padding: 24,
      borderRadius: 20,
      alignItems: 'center',
    },
    deleteModalIconWrap: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: `${theme.colors.danger}15`,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    deleteModalTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: theme.colors.textPrimary,
      marginBottom: 8,
      textAlign: 'center',
    },
    deleteModalDescription: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      lineHeight: 19,
      marginBottom: 20,
    },
    deleteModalButtons: {
      width: '100%',
      gap: 10,
    },
    clearTxsToggleRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      backgroundColor: theme.colors.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 12,
      padding: 12,
      marginBottom: 18,
      gap: 10,
      width: '100%',
    },
    checkboxBox: {
      width: 20,
      height: 20,
      borderRadius: 5,
      borderWidth: 1.5,
      borderColor: theme.colors.textMuted,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 2,
    },
    checkboxBoxActive: {
      backgroundColor: theme.colors.danger,
      borderColor: theme.colors.danger,
    },
    clearTxsToggleTitle: {
      fontSize: 12.5,
      fontWeight: '700',
      color: theme.colors.textPrimary,
    },
    clearTxsToggleDesc: {
      fontSize: 11,
      color: theme.colors.textMuted,
      marginTop: 2,
      lineHeight: 15,
    },
  });
