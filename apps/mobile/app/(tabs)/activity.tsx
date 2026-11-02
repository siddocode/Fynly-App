import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeRouter } from '../../hooks/useSafeRouter';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  Plus,
  TrendingDown,
  TrendingUp,
  ArrowLeftRight,
  Trash2,
  Tag,
  Wallet,
} from 'lucide-react-native';
import { api, formatPaiseToRupees } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import { useTheme, Theme } from '../../lib/theme';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Header } from '../../components/Header';
import { TransactionType } from '../../types';

export default function ActivityScreen() {
  const router = useSafeRouter();
  const localParams = useLocalSearchParams<{ search?: string; categoryId?: string }>();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();
  const { theme } = useTheme();
  const styles = React.useMemo(() => getStyles(theme), [theme]);

  const [searchQuery, setSearchQuery] = useState(localParams.search || '');
  const [selectedType, setSelectedType] = useState<TransactionType | undefined>(undefined);
  const [clearModalVisible, setClearModalVisible] = useState(false);

  React.useEffect(() => {
    if (localParams.search !== undefined) {
      setSearchQuery(localParams.search);
    }
  }, [localParams.search]);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const {
    data: txData,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['transactions', { search: searchQuery, type: selectedType }],
    queryFn: () =>
      api.getTransactions({
        search: searchQuery.trim() || undefined,
        type: selectedType,
      }),
    enabled: isAuthenticated,
  });

  useFocusEffect(
    React.useCallback(() => {
      if (isAuthenticated) {
        refetch();
      }
    }, [isAuthenticated, refetch])
  );

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteTransaction(id),
    onMutate: (id: string) => {
      setDeletingId(id);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ['transactions'], type: 'all' }),
        queryClient.refetchQueries({ queryKey: ['dashboard'], type: 'all' }),
        queryClient.refetchQueries({ queryKey: ['budgets'], type: 'all' }),
        queryClient.refetchQueries({ queryKey: ['insights'], type: 'all' }),
        queryClient.refetchQueries({ queryKey: ['me'], type: 'all' }),
        queryClient.refetchQueries({ queryKey: ['accounts'], type: 'all' }),
      ]);
    },
    onSettled: () => {
      setDeletingId(null);
    },
  });

  const clearHistoryMutation = useMutation({
    mutationFn: (resetBalances: boolean) => api.clearTransactionHistory(resetBalances),
    onSuccess: async () => {
      setClearModalVisible(false);
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ['transactions'], type: 'all' }),
        queryClient.refetchQueries({ queryKey: ['dashboard'], type: 'all' }),
        queryClient.refetchQueries({ queryKey: ['budgets'], type: 'all' }),
        queryClient.refetchQueries({ queryKey: ['insights'], type: 'all' }),
        queryClient.refetchQueries({ queryKey: ['me'], type: 'all' }),
        queryClient.refetchQueries({ queryKey: ['accounts'], type: 'all' }),
      ]);
    },
  });

  const handleDelete = (id: string, description: string) => {
    if (deletingId || deleteMutation.isPending) return;

    if (Platform.OS === 'web') {
      const confirmed = window.confirm(
        `Are you sure you want to delete "${description}"? The account balance will be reversed.`
      );
      if (confirmed) {
        deleteMutation.mutate(id);
      }
    } else {
      Alert.alert(
        'Delete Transaction',
        `Are you sure you want to delete "${description}"? The account balance will be reversed.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => {
              if (!deletingId && !deleteMutation.isPending) {
                deleteMutation.mutate(id);
              }
            },
          },
        ]
      );
    }
  };

  const transactions = txData?.transactions || [];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header
        title="Activity"
        subtitle="Transactions & History"
        rightElement={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {isAuthenticated && transactions.length > 0 && (
              <TouchableOpacity
                style={styles.clearBtn}
                onPress={() => setClearModalVisible(true)}
                activeOpacity={0.75}
              >
                <Trash2 size={13} color={theme.colors.danger} />
                <Text style={styles.clearBtnText}>Clear</Text>
              </TouchableOpacity>
            )}
            <Button
              title="Add"
              size="sm"
              onPress={() => {
                if (!isAuthenticated) router.push('/auth');
                else router.push('/add-transaction');
              }}
              icon={<Plus size={14} color={theme.colors.textInverse} />}
            />
          </View>
        }
      />

      <View style={styles.filterBar}>
        {/* Search Input */}
        <View style={styles.searchBox}>
          <Search size={16} color={theme.colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by merchant, note..."
            placeholderTextColor={theme.colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Filter Pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillRow}>
          <TouchableOpacity
            style={[styles.pill, selectedType === undefined && styles.activePill]}
            onPress={() => setSelectedType(undefined)}
          >
            <Text style={[styles.pillText, selectedType === undefined && styles.activePillText]}>
              All
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.pill, selectedType === 'EXPENSE' && styles.activePill]}
            onPress={() => setSelectedType(selectedType === 'EXPENSE' ? undefined : 'EXPENSE')}
          >
            <Text
              style={[styles.pillText, selectedType === 'EXPENSE' && styles.activePillText]}
            >
              Expenses
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.pill, selectedType === 'INCOME' && styles.activePill]}
            onPress={() => setSelectedType(selectedType === 'INCOME' ? undefined : 'INCOME')}
          >
            <Text
              style={[styles.pillText, selectedType === 'INCOME' && styles.activePillText]}
            >
              Income
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.pill, selectedType === 'TRANSFER' && styles.activePill]}
            onPress={() => setSelectedType(selectedType === 'TRANSFER' ? undefined : 'TRANSFER')}
          >
            <Text
              style={[styles.pillText, selectedType === 'TRANSFER' && styles.activePillText]}
            >
              Transfers
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

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
            <Text style={styles.emptyTitle}>Sign in to view history</Text>
            <Text style={styles.emptySubtitle}>
              Your complete transaction ledger and statements will appear here.
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
        ) : transactions.length === 0 ? (
          <Card style={styles.emptyCard} variant="subtle">
            <Text style={styles.emptyTitle}>No transactions found</Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery
                ? `No transactions matched "${searchQuery}"`
                : 'Start tracking by recording your first transaction.'}
            </Text>
            <Button
              title="Add Transaction"
              onPress={() => router.push('/add-transaction')}
              style={{ marginTop: theme.spacing.md }}
            />
          </Card>
        ) : (
          <View style={styles.txList}>
            {transactions.map((tx) => {
              const isExpense = tx.type === 'EXPENSE';
              const isIncome = tx.type === 'INCOME';
              const formattedDate = new Date(tx.date).toLocaleDateString('en-IN', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              });

              return (
                <Card key={tx.id} style={styles.txCard} variant="subtle">
                  <View style={styles.txIconWrapper}>
                    {isExpense ? (
                      <TrendingDown size={18} color={theme.colors.expense} />
                    ) : isIncome ? (
                      <TrendingUp size={18} color={theme.colors.income} />
                    ) : (
                      <ArrowLeftRight size={18} color={theme.colors.transfer} />
                    )}
                  </View>

                  <View style={styles.txMain}>
                    <Text style={styles.txTitle} numberOfLines={1}>
                      {tx.merchantName || tx.description}
                    </Text>

                    <View style={styles.metaRow}>
                      <Text style={styles.dateText}>{formattedDate}</Text>
                      {tx.account ? (
                        <View style={styles.badgeRow}>
                          <Wallet size={11} color={theme.colors.textMuted} />
                          <Text style={styles.badgeText}>{tx.account.name}</Text>
                        </View>
                      ) : null}
                      {tx.category ? (
                        <View style={styles.badgeRow}>
                          <Tag size={11} color={tx.category.color || theme.colors.textMuted} />
                          <Text style={styles.badgeText}>{tx.category.name}</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>

                  <View style={styles.rightSide}>
                    <Text
                      style={[
                        styles.amount,
                        {
                          color: isExpense
                            ? theme.colors.expense
                            : isIncome
                            ? theme.colors.income
                            : theme.colors.transfer,
                        },
                      ]}
                    >
                      {isExpense ? '-' : isIncome ? '+' : ''}
                      {formatPaiseToRupees(tx.amountPaise)}
                    </Text>

                    <TouchableOpacity
                      onPress={() => handleDelete(tx.id, tx.merchantName || tx.description)}
                      style={[styles.deleteBtn, !!deletingId && { opacity: 0.5 }]}
                      disabled={!!deletingId || deleteMutation.isPending}
                      activeOpacity={0.7}
                    >
                      {deletingId === tx.id ? (
                        <ActivityIndicator size="small" color={theme.colors.danger} />
                      ) : (
                        <Trash2 size={14} color={theme.colors.textMuted} />
                      )}
                    </TouchableOpacity>
                  </View>
                </Card>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Clear History Confirmation Modal */}
      {clearModalVisible && (
        <View style={styles.modalOverlay}>
          <Card style={styles.clearModalCard}>
            <View style={styles.clearModalIconWrap}>
              <Trash2 size={28} color={theme.colors.danger} />
            </View>

            <Text style={styles.clearModalTitle}>Clear Transaction History?</Text>
            <Text style={styles.clearModalDescription}>
              This will permanently delete all {transactions.length} transactions from your history. Choose how you want to handle your account balances:
            </Text>

            <View style={styles.clearModalButtons}>
              <Button
                title="Clear & Reset Balances to ₹0"
                variant="danger"
                onPress={() => {
                  if (!clearHistoryMutation.isPending) clearHistoryMutation.mutate(true);
                }}
                loading={clearHistoryMutation.isPending}
                disabled={clearHistoryMutation.isPending}
                style={{ width: '100%' }}
              />

              <Button
                title="Clear Transactions Only"
                variant="secondary"
                onPress={() => {
                  if (!clearHistoryMutation.isPending) clearHistoryMutation.mutate(false);
                }}
                loading={clearHistoryMutation.isPending}
                disabled={clearHistoryMutation.isPending}
                style={{ width: '100%' }}
              />

              <Button
                title="Cancel"
                variant="outline"
                onPress={() => setClearModalVisible(false)}
                disabled={clearHistoryMutation.isPending}
                style={{ width: '100%' }}
              />
            </View>
          </Card>
        </View>
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
    filterBar: {
      paddingHorizontal: 16,
      paddingBottom: 8,
    },
    searchBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: theme.colors.surfaceSubtle,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: 14,
      height: 44,
      marginBottom: 10,
    },
    searchInput: {
      flex: 1,
      color: theme.colors.textPrimary,
      fontSize: 14,
      fontWeight: '500',
    },
    pillRow: {
      flexDirection: 'row',
      marginHorizontal: -4,
    },
    pill: {
      paddingHorizontal: 15,
      paddingVertical: 7,
      borderRadius: 999,
      backgroundColor: theme.colors.surfaceSubtle,
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginHorizontal: 4,
    },
    activePill: {
      backgroundColor: theme.colors.primaryBg,
      borderColor: theme.colors.primary,
    },
    pillText: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      fontWeight: '600',
    },
    activePillText: {
      color: theme.colors.primary,
      fontWeight: '700',
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
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.colors.textPrimary,
    },
    emptySubtitle: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      marginTop: 4,
    },
    txList: {
      gap: 8,
    },
    txCard: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: theme.borderRadius.md,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    txIconWrapper: {
      width: 42,
      height: 42,
      borderRadius: 12,
      backgroundColor: theme.colors.surfaceSubtle,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 13,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    txMain: {
      flex: 1,
    },
    txTitle: {
      fontSize: 14.5,
      fontWeight: '700',
      letterSpacing: -0.2,
      color: theme.colors.textPrimary,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 3,
      flexWrap: 'wrap',
    },
    dateText: {
      fontSize: 11,
      color: theme.colors.textMuted,
      fontWeight: '500',
    },
    badgeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
    },
    badgeText: {
      fontSize: 11,
      color: theme.colors.textSecondary,
      fontWeight: '500',
    },
    rightSide: {
      alignItems: 'flex-end',
      gap: 6,
      marginLeft: 8,
    },
    amount: {
      fontSize: 16,
      fontWeight: '800',
      letterSpacing: -0.3,
    },
    deleteBtn: {
      padding: 4,
    },
    clearBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: `${theme.colors.danger}15`,
      paddingHorizontal: 9,
      paddingVertical: 6,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: `${theme.colors.danger}30`,
    },
    clearBtnText: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.colors.danger,
    },
    modalOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.65)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
      zIndex: 999,
    },
    clearModalCard: {
      width: '100%',
      maxWidth: 380,
      padding: 24,
      borderRadius: 20,
      alignItems: 'center',
    },
    clearModalIconWrap: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: `${theme.colors.danger}15`,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    clearModalTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: theme.colors.textPrimary,
      marginBottom: 8,
      textAlign: 'center',
    },
    clearModalDescription: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      lineHeight: 18,
      marginBottom: 20,
    },
    clearModalButtons: {
      width: '100%',
      gap: 10,
    },
  });
