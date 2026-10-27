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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
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
import { theme } from '../../lib/theme';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Header } from '../../components/Header';
import { TransactionType } from '../../types';

export default function ActivityScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<TransactionType | undefined>(undefined);

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

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteTransaction(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['me'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });

  const handleDelete = (id: string, description: string) => {
    Alert.alert(
      'Delete Transaction',
      `Are you sure you want to delete "${description}"? The account balance will be reversed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteMutation.mutate(id),
        },
      ]
    );
  };

  const transactions = txData?.transactions || [];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header
        title="Activity"
        subtitle="Transactions & History"
        rightElement={
          <Button
            title="Add"
            size="sm"
            onPress={() => {
              if (!isAuthenticated) router.push('/auth');
              else router.push('/add-transaction');
            }}
            icon={<Plus size={14} color={theme.colors.textInverse} />}
          />
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
            onRefresh={refetch}
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
                      style={styles.deleteBtn}
                    >
                      <Trash2 size={14} color={theme.colors.textMuted} />
                    </TouchableOpacity>
                  </View>
                </Card>
              );
            })}
          </View>
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
  filterBar: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.sm,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.surfaceSubtle,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
    paddingHorizontal: theme.spacing.md,
    height: 42,
    marginBottom: theme.spacing.sm,
  },
  searchInput: {
    flex: 1,
    color: theme.colors.textPrimary,
    fontSize: theme.typography.sizes.sm,
  },
  pillRow: {
    flexDirection: 'row',
    marginHorizontal: -4,
  },
  pill: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
    marginHorizontal: 4,
  },
  activePill: {
    backgroundColor: theme.colors.primarySubtle,
    borderColor: theme.colors.primary,
  },
  pillText: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textSecondary,
    fontWeight: theme.typography.weights.medium,
  },
  activePillText: {
    color: theme.colors.primary,
    fontWeight: theme.typography.weights.bold,
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
  },
  emptyTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
  },
  emptySubtitle: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
  },
  txList: {
    gap: theme.spacing.sm,
  },
  txCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
  },
  txIconWrapper: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  txMain: {
    flex: 1,
  },
  txTitle: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semibold,
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
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  badgeText: {
    fontSize: 11,
    color: theme.colors.textSecondary,
  },
  rightSide: {
    alignItems: 'flex-end',
    gap: 6,
    marginLeft: theme.spacing.sm,
  },
  amount: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.bold,
  },
  deleteBtn: {
    padding: 2,
  },
});
