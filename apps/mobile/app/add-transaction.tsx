import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, AlertTriangle, ArrowDownLeft, PlusCircle, ArrowLeftRight, Check } from 'lucide-react-native';
import { api, rupeesToPaise } from '../lib/api';
import { theme } from '../lib/theme';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { TransactionType } from '../types';

export default function AddTransactionScreen() {
  const router = useRouter();
  const searchParams = useLocalSearchParams<{ type?: string }>();
  const queryClient = useQueryClient();

  const initialType: TransactionType =
    searchParams.type === 'INCOME'
      ? 'INCOME'
      : searchParams.type === 'TRANSFER'
      ? 'TRANSFER'
      : 'EXPENSE';

  const [type, setType] = useState<TransactionType>(initialType);
  const [amountStr, setAmountStr] = useState('');
  const [description, setDescription] = useState('');
  const [merchantName, setMerchantName] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [selectedToAccountId, setSelectedToAccountId] = useState<string>('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch Accounts & Categories
  const { data: accounts, isLoading: accountsLoading } = useQuery({
    queryKey: ['accounts'],
    queryFn: api.getAccounts,
  });

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: api.getCategories,
  });

  // Set default account when loaded
  useEffect(() => {
    if (accounts && accounts.length > 0 && !selectedAccountId) {
      setSelectedAccountId(accounts[0].id);
      if (accounts.length > 1) {
        setSelectedToAccountId(accounts[1].id);
      }
    }
  }, [accounts, selectedAccountId]);

  const mutation = useMutation({
    mutationFn: (payload: { allowDuplicate?: boolean }) => {
      const amountPaise = rupeesToPaise(amountStr);
      if (amountPaise <= 0) {
        throw new Error('Please enter a valid amount greater than ₹0');
      }
      if (!description.trim()) {
        throw new Error('Description is required');
      }
      if (!selectedAccountId) {
        throw new Error('Please select an account');
      }

      return api.createTransaction({
        accountId: selectedAccountId,
        toAccountId: type === 'TRANSFER' ? selectedToAccountId : undefined,
        categoryId: selectedCategoryId || undefined,
        type,
        amountPaise,
        description: description.trim(),
        merchantName: merchantName.trim() || undefined,
        notes: notes.trim() || undefined,
        allowDuplicate: payload.allowDuplicate || false,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['me'] });
      router.back();
    },
    onError: (err: any) => {
      if (err.status === 409) {
        setDuplicateWarning(
          'An identical transaction on this date was detected. Tap below to confirm and add anyway.'
        );
      } else {
        setErrorMessage(err.message || 'Failed to save transaction');
      }
    },
  });

  const handleSave = (allowDuplicate = false) => {
    setErrorMessage(null);
    setDuplicateWarning(null);
    mutation.mutate({ allowDuplicate });
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
              <X size={22} color={theme.colors.textSecondary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Add Transaction</Text>
            <View style={{ width: 22 }} />
          </View>

          {/* Type Selector */}
          <View style={styles.typeSelector}>
            <TouchableOpacity
              style={[
                styles.typeBtn,
                type === 'EXPENSE' && { backgroundColor: theme.colors.expenseBg, borderColor: theme.colors.expense },
              ]}
              onPress={() => setType('EXPENSE')}
            >
              <ArrowDownLeft
                size={16}
                color={type === 'EXPENSE' ? theme.colors.expense : theme.colors.textMuted}
              />
              <Text
                style={[
                  styles.typeBtnText,
                  type === 'EXPENSE' && { color: theme.colors.expense, fontWeight: '700' },
                ]}
              >
                Expense
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.typeBtn,
                type === 'INCOME' && { backgroundColor: theme.colors.incomeBg, borderColor: theme.colors.income },
              ]}
              onPress={() => setType('INCOME')}
            >
              <PlusCircle
                size={16}
                color={type === 'INCOME' ? theme.colors.income : theme.colors.textMuted}
              />
              <Text
                style={[
                  styles.typeBtnText,
                  type === 'INCOME' && { color: theme.colors.income, fontWeight: '700' },
                ]}
              >
                Income
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.typeBtn,
                type === 'TRANSFER' && { backgroundColor: theme.colors.transferBg, borderColor: theme.colors.transfer },
              ]}
              onPress={() => setType('TRANSFER')}
            >
              <ArrowLeftRight
                size={16}
                color={type === 'TRANSFER' ? theme.colors.transfer : theme.colors.textMuted}
              />
              <Text
                style={[
                  styles.typeBtnText,
                  type === 'TRANSFER' && { color: theme.colors.transfer, fontWeight: '700' },
                ]}
              >
                Transfer
              </Text>
            </TouchableOpacity>
          </View>

          {/* Amount Input */}
          <Card style={styles.amountCard}>
            <Text style={styles.amountPrefix}>₹</Text>
            <TextInput
              style={styles.amountInput}
              placeholder="0.00"
              placeholderTextColor={theme.colors.textMuted}
              value={amountStr}
              onChangeText={setAmountStr}
              keyboardType="decimal-pad"
              autoFocus
            />
          </Card>

          {/* Duplicate Warning Alert */}
          {duplicateWarning && (
            <Card style={styles.warningCard} variant="subtle">
              <View style={styles.warningHeader}>
                <AlertTriangle size={20} color={theme.colors.alertAmber} />
                <Text style={styles.warningTitle}>Duplicate Notice</Text>
              </View>
              <Text style={styles.warningText}>{duplicateWarning}</Text>
              <Button
                title="Confirm & Add Anyway"
                onPress={() => handleSave(true)}
                variant="outline"
                size="sm"
                style={{ marginTop: theme.spacing.sm }}
              />
            </Card>
          )}

          {errorMessage && (
            <Card style={styles.errorCard} variant="subtle">
              <Text style={styles.errorText}>{errorMessage}</Text>
            </Card>
          )}

          {/* Form Fields */}
          <Card style={styles.formCard}>
            {/* Account Selector */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Account</Text>
              {accountsLoading ? (
                <ActivityIndicator size="small" color={theme.colors.primary} />
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillScroll}>
                  {accounts?.map((acc) => (
                    <TouchableOpacity
                      key={acc.id}
                      style={[
                        styles.accountPill,
                        selectedAccountId === acc.id && styles.activeAccountPill,
                      ]}
                      onPress={() => setSelectedAccountId(acc.id)}
                    >
                      <Text
                        style={[
                          styles.accountPillText,
                          selectedAccountId === acc.id && styles.activeAccountPillText,
                        ]}
                      >
                        {acc.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>

            {/* If Transfer, show destination account */}
            {type === 'TRANSFER' && (
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Destination Account</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillScroll}>
                  {accounts
                    ?.filter((a) => a.id !== selectedAccountId)
                    .map((acc) => (
                      <TouchableOpacity
                        key={acc.id}
                        style={[
                          styles.accountPill,
                          selectedToAccountId === acc.id && styles.activeAccountPill,
                        ]}
                        onPress={() => setSelectedToAccountId(acc.id)}
                      >
                        <Text
                          style={[
                            styles.accountPillText,
                            selectedToAccountId === acc.id && styles.activeAccountPillText,
                          ]}
                        >
                          {acc.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                </ScrollView>
              </View>
            )}

            {/* Description */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Description</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Swiggy Order, Petrol, Rent"
                placeholderTextColor={theme.colors.textMuted}
                value={description}
                onChangeText={setDescription}
              />
            </View>

            {/* Merchant / Payee */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Merchant / Payee (Optional)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Starbucks, Amazon, Shell"
                placeholderTextColor={theme.colors.textMuted}
                value={merchantName}
                onChangeText={setMerchantName}
              />
            </View>

            {/* Category Selector */}
            {type !== 'TRANSFER' && (
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Category</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillScroll}>
                  {categories?.map((cat) => {
                    const isSelected = selectedCategoryId === cat.id;
                    return (
                      <TouchableOpacity
                        key={cat.id}
                        style={[
                          styles.categoryPill,
                          isSelected && { borderColor: cat.color || theme.colors.primary, backgroundColor: theme.colors.surfaceSubtle },
                        ]}
                        onPress={() => setSelectedCategoryId(isSelected ? null : cat.id)}
                      >
                        <View style={[styles.categoryDot, { backgroundColor: cat.color || theme.colors.primary }]} />
                        <Text
                          style={[
                            styles.categoryPillText,
                            isSelected && { color: theme.colors.textPrimary, fontWeight: '700' },
                          ]}
                        >
                          {cat.name}
                        </Text>
                        {isSelected && <Check size={12} color={theme.colors.primary} style={{ marginLeft: 4 }} />}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* Notes */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Notes (Optional)</Text>
              <TextInput
                style={[styles.textInput, { height: 64, textAlignVertical: 'top' }]}
                placeholder="Add receipt note or remarks..."
                placeholderTextColor={theme.colors.textMuted}
                value={notes}
                onChangeText={setNotes}
                multiline
              />
            </View>

            <Button
              title="Save Transaction"
              onPress={() => handleSave(false)}
              loading={mutation.isPending}
              style={{ marginTop: theme.spacing.md }}
            />
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.lg,
  },
  closeBtn: {
    padding: 6,
  },
  headerTitle: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
  },
  typeSelector: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  typeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
    backgroundColor: theme.colors.surface,
  },
  typeBtnText: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    fontWeight: theme.typography.weights.semibold,
  },
  amountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xl,
    marginBottom: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
  },
  amountPrefix: {
    fontSize: 36,
    fontWeight: theme.typography.weights.extrabold,
    color: theme.colors.primary,
    marginRight: 6,
  },
  amountInput: {
    fontSize: 36,
    fontWeight: theme.typography.weights.extrabold,
    color: theme.colors.textPrimary,
    minWidth: 120,
  },
  warningCard: {
    borderColor: theme.colors.alertAmber,
    borderWidth: 1,
    marginBottom: theme.spacing.lg,
  },
  warningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  warningTitle: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.alertAmber,
  },
  warningText: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textSecondary,
  },
  errorCard: {
    borderColor: theme.colors.error,
    borderWidth: 1,
    marginBottom: theme.spacing.lg,
  },
  errorText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.error,
  },
  formCard: {
    padding: theme.spacing.xl,
  },
  fieldGroup: {
    marginBottom: theme.spacing.lg,
  },
  fieldLabel: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
    fontWeight: theme.typography.weights.medium,
  },
  textInput: {
    backgroundColor: theme.colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    color: theme.colors.textPrimary,
    fontSize: theme.typography.sizes.base,
  },
  pillScroll: {
    flexDirection: 'row',
    marginHorizontal: -4,
  },
  accountPill: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
    marginHorizontal: 4,
  },
  activeAccountPill: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primarySubtle,
  },
  accountPillText: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textSecondary,
  },
  activeAccountPillText: {
    color: theme.colors.primary,
    fontWeight: theme.typography.weights.bold,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
    marginHorizontal: 4,
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  categoryPillText: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textSecondary,
  },
});
