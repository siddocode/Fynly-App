import React, { useState, useEffect, useRef } from 'react';
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
  Keyboard,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { useSafeRouter } from '../hooks/useSafeRouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  X,
  AlertTriangle,
  ArrowDownLeft,
  PlusCircle,
  ArrowLeftRight,
  Check,
  Plus,
  Settings2,
} from 'lucide-react-native';
import { api, rupeesToPaise } from '../lib/api';
import { useTheme, Theme } from '../lib/theme';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { CategoryManagerModal } from '../components/CategoryManagerModal';
import { TransactionType } from '../types';
import { sendLocalOSNotification } from '../lib/notificationService';

export default function AddTransactionScreen() {
  const router = useSafeRouter();
  const searchParams = useLocalSearchParams<{ type?: string }>();
  const queryClient = useQueryClient();
  const { theme } = useTheme();
  const styles = React.useMemo(() => getStyles(theme), [theme]);

  const initialType: TransactionType =
    searchParams.type === 'INCOME'
      ? 'INCOME'
      : searchParams.type === 'TRANSFER'
      ? 'TRANSFER'
      : 'EXPENSE';

  const [type, setType] = useState<TransactionType>(initialType);
  const [amountStr, setAmountStr] = useState('');
  const [description, setDescription] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [selectedToAccountId, setSelectedToAccountId] = useState<string>('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);

  const scrollViewRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const descriptionInputRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const notesInputRef = useRef<React.ComponentRef<typeof TextInput>>(null);

  const isDismissedRef = useRef(false);
  const safeDismiss = React.useCallback(() => {
    if (isDismissedRef.current) return;
    isDismissedRef.current = true;
    if (typeof router.canGoBack === 'function' && router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  }, [router]);

  const scrollToOffset = (y: number) => {
    scrollViewRef.current?.scrollTo({ y, animated: true });
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({ y, animated: true });
    }, 150);
  };

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
      if (!selectedAccountId) {
        throw new Error('Please select an account');
      }

      const fallbackCat = categories?.find(
        (c) => c.slug === 'other' || c.name.toLowerCase() === 'other'
      ) || categories?.[0];

      const effectiveCategoryId =
        selectedCategoryId || (type === 'EXPENSE' ? fallbackCat?.id : undefined);

      const selectedCat = categories?.find((c) => c.id === effectiveCategoryId);
      const effectiveDescription =
        description.trim() ||
        selectedCat?.name ||
        (type === 'INCOME' ? 'Income' : type === 'TRANSFER' ? 'Transfer' : 'General Expense');

      return api.createTransaction({
        accountId: selectedAccountId,
        toAccountId: type === 'TRANSFER' ? selectedToAccountId : undefined,
        categoryId: effectiveCategoryId || undefined,
        type,
        amountPaise,
        description: effectiveDescription,
        notes: notes.trim() || undefined,
        allowDuplicate: true,
      });
    },
    onMutate: async () => {
      // Optimistic cache update so Home Screen and Budgets screen reflect immediately
      await Promise.all([
        queryClient.cancelQueries({ queryKey: ['dashboard'] }),
        queryClient.cancelQueries({ queryKey: ['budgets'] }),
      ]);
      const previousDashboard = queryClient.getQueryData<any>(['dashboard']);
      if (previousDashboard) {
        const addedPaise = BigInt(rupeesToPaise(amountStr) || 0);
        let updatedTodaySpent = BigInt(previousDashboard.todaySpentPaise || '0');
        let updatedTotalBalance = BigInt(previousDashboard.totalBalancePaise || '0');
        let updatedBudget = previousDashboard.budget ? { ...previousDashboard.budget } : null;
        let updatedSafeToSpend = previousDashboard.safeToSpendTodayPaise
          ? BigInt(previousDashboard.safeToSpendTodayPaise)
          : null;

        if (type === 'EXPENSE') {
          updatedTodaySpent += addedPaise;
          updatedTotalBalance -= addedPaise;
          if (updatedSafeToSpend !== null) {
            updatedSafeToSpend = updatedSafeToSpend > addedPaise ? updatedSafeToSpend - addedPaise : 0n;
          }
          if (updatedBudget) {
            const currentSpent = BigInt(updatedBudget.spentPaise || '0') + addedPaise;
            const limit = BigInt(updatedBudget.limitPaise || '0');
            const remaining = limit > currentSpent ? limit - currentSpent : 0n;
            const pct = limit > 0n ? Number((currentSpent * 10000n) / limit) / 100 : 100;
            updatedBudget.spentPaise = currentSpent.toString();
            updatedBudget.remainingPaise = remaining.toString();
            updatedBudget.usagePercentage = Math.round(pct);
          }
        } else if (type === 'INCOME') {
          updatedTotalBalance += addedPaise;
        }

        queryClient.setQueryData(['dashboard'], {
          ...previousDashboard,
          todaySpentPaise: updatedTodaySpent.toString(),
          totalBalancePaise: updatedTotalBalance.toString(),
          safeToSpendTodayPaise: updatedSafeToSpend !== null ? updatedSafeToSpend.toString() : previousDashboard.safeToSpendTodayPaise,
          budget: updatedBudget,
        });
      }
      return { previousDashboard };
    },
    onSuccess: async () => {
      const fallbackCat = categories?.find(
        (c) => c.slug === 'other' || c.name.toLowerCase() === 'other'
      ) || categories?.[0];
      const effCat = categories?.find((c) => c.id === (selectedCategoryId || fallbackCat?.id));
      const effDesc = description.trim() || effCat?.name || (type === 'INCOME' ? 'Income' : type === 'TRANSFER' ? 'Transfer' : 'General Expense');
      const formatted = amountStr ? `₹${parseFloat(amountStr).toFixed(2)}` : 'Transaction';
      sendLocalOSNotification(
        type === 'EXPENSE' ? 'Expense Recorded' : type === 'INCOME' ? 'Income Added' : 'Transfer Recorded',
        `${formatted} - ${effDesc}`
      );
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ['dashboard'], type: 'all' }),
        queryClient.refetchQueries({ queryKey: ['budgets'], type: 'all' }),
        queryClient.refetchQueries({ queryKey: ['transactions'], type: 'all' }),
        queryClient.refetchQueries({ queryKey: ['accounts'], type: 'all' }),
        queryClient.refetchQueries({ queryKey: ['insights'], type: 'all' }),
        queryClient.refetchQueries({ queryKey: ['insights-overview'], type: 'all' }),
        queryClient.refetchQueries({ queryKey: ['notifications'], type: 'all' }),
        queryClient.refetchQueries({ queryKey: ['me'], type: 'all' }),
      ]);
      safeDismiss();
    },
    onError: (err: any, _vars, context) => {
      if (context?.previousDashboard) {
        queryClient.setQueryData(['dashboard'], context.previousDashboard);
      }
      if (err.status === 409) {
        setDuplicateWarning(
          'An identical transaction on this date was detected. Tap below to confirm and add anyway.'
        );
      } else {
        setErrorMessage(err.message || 'Failed to save transaction');
      }
    },
  });

  const isProcessing = mutation.isPending;

  useEffect(() => {
    const backAction = () => {
      if (isProcessing) {
        return true;
      }
      safeDismiss();
      return true;
    };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [isProcessing, safeDismiss]);

  const handleSave = (allowDuplicate = false) => {
    if (isProcessing) return;
    setErrorMessage(null);
    setDuplicateWarning(null);
    mutation.mutate({ allowDuplicate });
  };

  const getAccentColor = () => {
    switch (type) {
      case 'INCOME':
        return theme.colors.primary;
      case 'TRANSFER':
        return theme.colors.accent;
      default:
        return theme.colors.expense;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 70 : 0}
      >
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 360 }]}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets={true}
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
        >
          {/* Clean Header */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={safeDismiss}
              disabled={isProcessing}
              style={[styles.closeBtn, isProcessing && { opacity: 0.4 }]}
              accessibilityLabel="Close"
            >
              <X size={22} color={theme.colors.textSecondary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>
              {type === 'EXPENSE' ? 'Add Expense' : type === 'INCOME' ? 'Add Income' : 'Transfer Money'}
            </Text>
            <View style={{ width: 32 }} />
          </View>

          {/* Interactive Form Wrapped and Locked During Processing */}
          <View pointerEvents={isProcessing ? 'none' : 'auto'} style={{ opacity: isProcessing ? 0.6 : 1 }}>
            {/* Type Segment Control */}
            <View style={styles.typeSelector}>
              <TouchableOpacity
                style={[
                  styles.typeBtn,
                  type === 'EXPENSE' && { backgroundColor: theme.colors.dangerBg, borderColor: theme.colors.danger },
                ]}
                onPress={() => setType('EXPENSE')}
                activeOpacity={0.8}
                disabled={isProcessing}
              >
                <ArrowDownLeft
                  size={16}
                  color={type === 'EXPENSE' ? theme.colors.danger : theme.colors.textMuted}
                />
                <Text
                  style={[
                    styles.typeBtnText,
                    type === 'EXPENSE' && { color: theme.colors.danger, fontWeight: '700' },
                  ]}
                >
                  Expense
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.typeBtn,
                  type === 'INCOME' && { backgroundColor: theme.colors.primaryBg, borderColor: theme.colors.primary },
                ]}
                onPress={() => setType('INCOME')}
                activeOpacity={0.8}
                disabled={isProcessing}
              >
                <PlusCircle
                  size={16}
                  color={type === 'INCOME' ? theme.colors.primary : theme.colors.textMuted}
                />
                <Text
                  style={[
                    styles.typeBtnText,
                    type === 'INCOME' && { color: theme.colors.primary, fontWeight: '700' },
                  ]}
                >
                  Income
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.typeBtn,
                  type === 'TRANSFER' && { backgroundColor: theme.colors.surfaceAlt, borderColor: theme.colors.accent },
                ]}
                onPress={() => setType('TRANSFER')}
                activeOpacity={0.8}
                disabled={isProcessing}
              >
                <ArrowLeftRight
                  size={16}
                  color={type === 'TRANSFER' ? theme.colors.accent : theme.colors.textMuted}
                />
                <Text
                  style={[
                    styles.typeBtnText,
                    type === 'TRANSFER' && { color: theme.colors.accent, fontWeight: '700' },
                  ]}
                >
                  Transfer
                </Text>
              </TouchableOpacity>
            </View>

            {/* Amount Hero Card */}
            <Card style={styles.amountCard}>
              <Text style={[styles.amountPrefix, { color: getAccentColor() }]}>₹</Text>
              <TextInput
                style={styles.amountInput}
                placeholder="0.00"
                placeholderTextColor={theme.colors.textMuted}
                value={amountStr}
                onChangeText={setAmountStr}
                keyboardType="decimal-pad"
                returnKeyType="next"
                blurOnSubmit={false}
                editable={!isProcessing}
                onFocus={() => scrollToOffset(0)}
                onSubmitEditing={() => {
                  descriptionInputRef.current?.focus();
                }}
                autoFocus
              />
            </Card>

            {/* Duplicate Warning Alert */}
            {duplicateWarning && (
              <Card style={styles.warningCard} variant="subtle">
                <View style={styles.warningHeader}>
                  <AlertTriangle size={18} color={theme.colors.warning} />
                  <Text style={styles.warningTitle}>Duplicate Notice</Text>
                </View>
                <Text style={styles.warningText}>{duplicateWarning}</Text>
                <Button
                  title="Confirm & Add Anyway"
                  onPress={() => handleSave(true)}
                  variant="outline"
                  size="sm"
                  disabled={isProcessing}
                  style={{ marginTop: theme.spacing.sm }}
                />
              </Card>
            )}

            {errorMessage && (
              <Card style={styles.errorCard} variant="subtle">
                <Text style={styles.errorText}>{errorMessage}</Text>
              </Card>
            )}

            {/* Account Selector */}
            <View style={styles.fieldSection}>
              <Text style={styles.fieldLabel}>
                {type === 'TRANSFER'
                  ? 'From Account'
                  : type === 'INCOME'
                  ? 'Deposit Into Account'
                  : 'Paid From Account'}
              </Text>
              {accountsLoading ? (
                <ActivityIndicator size="small" color={theme.colors.primary} />
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillScroll}>
                  {accounts?.map((acc) => {
                    const isSelected = selectedAccountId === acc.id;
                    return (
                      <TouchableOpacity
                        key={acc.id}
                        style={[
                          styles.accountPill,
                          isSelected && styles.activeAccountPill,
                        ]}
                        onPress={() => setSelectedAccountId(acc.id)}
                        activeOpacity={0.75}
                        disabled={isProcessing}
                      >
                        <Text
                          style={[
                            styles.accountPillText,
                            isSelected && styles.activeAccountPillText,
                          ]}
                        >
                          {acc.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
            </View>

            {/* Transfer Destination Account */}
            {type === 'TRANSFER' && (
              <View style={styles.fieldSection}>
                <Text style={styles.fieldLabel}>To Account (Receiving)</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillScroll}>
                  {accounts
                    ?.filter((a) => a.id !== selectedAccountId)
                    .map((acc) => {
                      const isSelected = selectedToAccountId === acc.id;
                      return (
                        <TouchableOpacity
                          key={acc.id}
                          style={[
                            styles.accountPill,
                            isSelected && styles.activeAccountPill,
                          ]}
                          onPress={() => setSelectedToAccountId(acc.id)}
                          activeOpacity={0.75}
                          disabled={isProcessing}
                        >
                          <Text
                            style={[
                              styles.accountPillText,
                              isSelected && styles.activeAccountPillText,
                            ]}
                          >
                            {acc.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                </ScrollView>
              </View>
            )}

            {/* Category Selector (Only for Expense and Income) */}
            {type !== 'TRANSFER' && (
              <View style={styles.fieldSection}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.fieldLabel}>Category (Optional)</Text>
                  <TouchableOpacity
                    style={styles.manageCategoryBtn}
                    onPress={() => setCategoryModalVisible(true)}
                    activeOpacity={0.7}
                    disabled={isProcessing}
                  >
                    <Settings2 size={12} color={theme.colors.primary} />
                    <Text style={styles.manageCategoryText}>Manage</Text>
                  </TouchableOpacity>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillScroll}>
                  <TouchableOpacity
                    style={styles.addCategoryPill}
                    onPress={() => setCategoryModalVisible(true)}
                    activeOpacity={0.75}
                    disabled={isProcessing}
                  >
                    <Plus size={13} color={theme.colors.primary} />
                    <Text style={styles.addCategoryPillText}>New</Text>
                  </TouchableOpacity>
                  {categories?.map((cat) => {
                    const isSelected = selectedCategoryId === cat.id;
                    return (
                      <TouchableOpacity
                        key={cat.id}
                        style={[
                          styles.categoryPill,
                          isSelected && {
                            borderColor: cat.color || theme.colors.primary,
                            backgroundColor: theme.colors.surfaceSubtle,
                          },
                        ]}
                        onPress={() => setSelectedCategoryId(isSelected ? null : cat.id)}
                        activeOpacity={0.75}
                        disabled={isProcessing}
                      >
                        <View
                          style={[
                            styles.categoryDot,
                            { backgroundColor: cat.color || theme.colors.primary },
                          ]}
                        />
                        <Text
                          style={[
                            styles.categoryPillText,
                            isSelected && { color: theme.colors.textPrimary, fontWeight: '700' },
                          ]}
                        >
                          {cat.name}
                        </Text>
                        {isSelected && (
                          <Check size={12} color={theme.colors.primary} style={{ marginLeft: 4 }} />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* Simple Details: ONLY Description & Notes (Both Optional) */}
            <Card style={styles.detailsCard}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Description (Optional)</Text>
                <TextInput
                  ref={descriptionInputRef}
                  style={styles.textInput}
                  placeholder={
                    type === 'INCOME'
                      ? 'e.g. Salary, Dividend, Cash Gift'
                      : type === 'TRANSFER'
                      ? 'e.g. ATM Cash Withdrawal'
                      : 'e.g. Lunch, Groceries, Petrol, Coffee'
                  }
                  placeholderTextColor={theme.colors.textMuted}
                  value={description}
                  onChangeText={setDescription}
                  editable={!isProcessing}
                  onFocus={() => scrollToOffset(180)}
                  returnKeyType="next"
                  blurOnSubmit={false}
                  onSubmitEditing={() => notesInputRef.current?.focus()}
                />
              </View>

              <View style={[styles.inputGroup, { marginBottom: 0 }]}>
                <Text style={styles.inputLabel}>Notes (Optional)</Text>
                <TextInput
                  ref={notesInputRef}
                  style={[styles.textInput, { height: 56, textAlignVertical: 'top' }]}
                  placeholder="Add receipt note or remarks..."
                  placeholderTextColor={theme.colors.textMuted}
                  value={notes}
                  onChangeText={setNotes}
                  editable={!isProcessing}
                  onFocus={() => scrollToOffset(280)}
                  multiline
                  returnKeyType="done"
                  blurOnSubmit={true}
                  onSubmitEditing={() => Keyboard.dismiss()}
                />
              </View>
            </Card>

            {/* Action Button */}
            <Button
              title={`Save ${type === 'EXPENSE' ? 'Expense' : type === 'INCOME' ? 'Income' : 'Transfer'}`}
              onPress={() => handleSave(false)}
              loading={isProcessing}
              disabled={isProcessing}
              style={{ marginTop: 20 }}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Classy Processing Overlay */}
      {isProcessing && (
        <View style={styles.savingOverlay}>
          <View style={styles.savingCard}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
            <Text style={styles.savingText}>
              {type === 'INCOME'
                ? 'Recording Income...'
                : type === 'TRANSFER'
                ? 'Transferring Funds...'
                : 'Saving Expense...'}
            </Text>
          </View>
        </View>
      )}

      <CategoryManagerModal
        visible={categoryModalVisible}
        onClose={() => setCategoryModalVisible(false)}
      />
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
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16,
      paddingTop: 4,
    },
    closeBtn: {
      padding: 6,
      borderRadius: 8,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.colors.textPrimary,
    },
    typeSelector: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 14,
    },
    typeBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 11,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    typeBtnText: {
      fontSize: 13,
      color: theme.colors.textMuted,
      fontWeight: '600',
    },
    amountCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 22,
      marginBottom: 16,
      backgroundColor: theme.colors.surface,
      borderRadius: 14,
    },
    amountPrefix: {
      fontSize: 34,
      fontWeight: '800',
      marginRight: 6,
    },
    amountInput: {
      fontSize: 34,
      fontWeight: '800',
      color: theme.colors.textPrimary,
      minWidth: 120,
      ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
    },
    warningCard: {
      borderColor: theme.colors.warning,
      borderWidth: 1,
      marginBottom: 14,
    },
    warningHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 4,
    },
    warningTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.colors.warning,
    },
    warningText: {
      fontSize: 12,
      color: theme.colors.textSecondary,
    },
    errorCard: {
      borderColor: theme.colors.danger,
      borderWidth: 1,
      marginBottom: 14,
    },
    errorText: {
      fontSize: 13,
      color: theme.colors.danger,
    },
    fieldSection: {
      marginBottom: 16,
    },
    sectionHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    fieldLabel: {
      fontSize: 12.5,
      fontWeight: '600',
      color: theme.colors.textSecondary,
      marginBottom: 8,
    },
    pillScroll: {
      flexDirection: 'row',
      marginHorizontal: -4,
    },
    accountPill: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginHorizontal: 4,
    },
    activeAccountPill: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.primaryBg,
    },
    accountPillText: {
      fontSize: 12.5,
      color: theme.colors.textSecondary,
    },
    activeAccountPillText: {
      color: theme.colors.primary,
      fontWeight: '700',
    },
    categoryPill: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginHorizontal: 4,
    },
    categoryDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginRight: 6,
    },
    categoryPillText: {
      fontSize: 12.5,
      color: theme.colors.textSecondary,
    },
    manageCategoryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      backgroundColor: theme.colors.primaryBg,
      borderWidth: 1,
      borderColor: `${theme.colors.primary}30`,
    },
    manageCategoryText: {
      fontSize: 11.5,
      color: theme.colors.primary,
      fontWeight: '700',
    },
    addCategoryPill: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: theme.colors.primaryBg,
      borderWidth: 1,
      borderColor: theme.colors.primary,
      borderStyle: 'dashed',
      marginHorizontal: 4,
      gap: 4,
    },
    addCategoryPillText: {
      fontSize: 12.5,
      color: theme.colors.primary,
      fontWeight: '600',
    },
    detailsCard: {
      padding: 16,
      borderRadius: 14,
      backgroundColor: theme.colors.surface,
    },
    inputGroup: {
      marginBottom: 14,
    },
    inputLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.textSecondary,
      marginBottom: 6,
    },
    textInput: {
      backgroundColor: theme.colors.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 10,
      paddingHorizontal: 13,
      paddingVertical: 10,
      color: theme.colors.textPrimary,
      fontSize: 14.5,
      ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
    },
    savingOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.45)',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
    },
    savingCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: theme.colors.surface,
      paddingHorizontal: 20,
      paddingVertical: 14,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.colors.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 10,
      elevation: 8,
    },
    savingText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.textPrimary,
    },
  });
