import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Plus, Trash2, Check, Tag, Layers, AlertCircle } from 'lucide-react-native';
import { api, rupeesToPaise } from '../lib/api';
import { useTheme, Theme } from '../lib/theme';
import { Button } from './Button';
import { Category } from '../types';

interface CategoryManagerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectCategory?: (category: Category, initialLimitRupees?: string) => void;
  maxAllowedLimitRupees?: number;
}

const PALETTE = [
  '#10B981', // Emerald
  '#6366F1', // Indigo
  '#F59E0B', // Amber
  '#EC4899', // Pink
  '#8B5CF6', // Purple
  '#06B6D4', // Cyan
  '#F97316', // Orange
  '#14B8A6', // Teal
  '#E11D48', // Rose
  '#3B82F6', // Blue
];

export const CategoryManagerModal: React.FC<CategoryManagerModalProps> = ({
  visible,
  onClose,
  onSelectCategory,
  maxAllowedLimitRupees,
}) => {
  const { theme } = useTheme();
  const styles = React.useMemo(() => getStyles(theme), [theme]);
  const queryClient = useQueryClient();
  const bodyScrollRef = React.useRef<React.ComponentRef<typeof ScrollView>>(null);
  const [activeTab, setActiveTab] = useState<'CREATE' | 'MANAGE'>('CREATE');

  // Form State
  const [name, setName] = useState('');
  const [selectedColor, setSelectedColor] = useState(PALETTE[0]);
  const [initialMoney, setInitialMoney] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deletingCatId, setDeletingCatId] = useState<string | null>(null);

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: api.getCategories,
    enabled: visible,
  });

  const parsedMoney = parseFloat(initialMoney) || 0;
  const isBufferLimited = maxAllowedLimitRupees !== undefined;
  const isLimitAlreadyReached = isBufferLimited && maxAllowedLimitRupees <= 0;
  const isMoneyExceeded = isBufferLimited && parsedMoney > maxAllowedLimitRupees;

  const createMutation = useMutation({
    mutationFn: () => {
      if (!name.trim()) {
        throw new Error('Please enter a category name');
      }
      if (isMoneyExceeded) {
        throw new Error(
          `Limit reached! Cannot allocate more than available buffer of ₹${maxAllowedLimitRupees.toLocaleString('en-IN')}`
        );
      }
      if (isLimitAlreadyReached && parsedMoney > 0) {
        throw new Error(
          'Overall budget limit reached! Cannot allocate money to new categories without increasing your monthly budget ceiling.'
        );
      }

      const limitPaise = parsedMoney > 0 ? rupeesToPaise(parsedMoney) : undefined;

      return api.createCategory({
        name: name.trim(),
        color: selectedColor,
        icon: 'Tag',
        limitPaise,
      });
    },
    onSuccess: (newCat) => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['insights'] });
      const savedMoney = initialMoney.trim();
      setName('');
      setInitialMoney('');
      setErrorMessage(null);
      if (onSelectCategory) {
        onSelectCategory(newCat, savedMoney);
        onClose();
      } else {
        setActiveTab('MANAGE');
      }
    },
    onError: (err: any) => {
      setErrorMessage(err.message || 'Failed to create category');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteCategory(id),
    onMutate: (id) => {
      setDeletingCatId(id);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ['categories'], type: 'all' }),
        queryClient.refetchQueries({ queryKey: ['budgets'], type: 'all' }),
        queryClient.refetchQueries({ queryKey: ['dashboard'], type: 'all' }),
        queryClient.refetchQueries({ queryKey: ['insights'], type: 'all' }),
      ]);
    },
    onSettled: () => {
      setDeletingCatId(null);
    },
    onError: (err: any) => {
      setErrorMessage(err.message || 'Failed to delete category');
    },
  });

  const handleCreate = () => {
    if (createMutation.isPending || !!deletingCatId) return;
    setErrorMessage(null);
    createMutation.mutate();
  };

  const handleDelete = (cat: Category) => {
    if (deletingCatId || deleteMutation.isPending || createMutation.isPending) return;

    const isDefault = cat.isDefault;
    const confirmMessage = isDefault
      ? `Are you sure you want to delete default category "${cat.name}"? Transactions using it will become uncategorized.`
      : `Are you sure you want to delete "${cat.name}"? Transactions assigned to it will remain intact but will be uncategorized.`;

    if (Platform.OS === 'web') {
      const confirmed = window.confirm(confirmMessage);
      if (confirmed) {
        deleteMutation.mutate(cat.id);
      }
    } else {
      Alert.alert(
        isDefault ? 'Delete Default Category' : 'Delete Category',
        confirmMessage,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => {
              if (!deletingCatId && !deleteMutation.isPending) {
                deleteMutation.mutate(cat.id);
              }
            },
          },
        ]
      );
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardWrap}
        >
          <View style={styles.sheetContainer}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerTitleRow}>
                <Layers size={20} color={theme.colors.primary} />
                <Text style={styles.headerTitle}>Category Manager</Text>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <X size={20} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Tab Bar */}
            <View style={styles.tabBar}>
              <TouchableOpacity
                style={[styles.tabBtn, activeTab === 'CREATE' && styles.activeTabBtn]}
                onPress={() => setActiveTab('CREATE')}
              >
                <Plus size={16} color={activeTab === 'CREATE' ? theme.colors.primary : theme.colors.textMuted} />
                <Text style={[styles.tabBtnText, activeTab === 'CREATE' && styles.activeTabBtnText]}>
                  Create Category
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tabBtn, activeTab === 'MANAGE' && styles.activeTabBtn]}
                onPress={() => setActiveTab('MANAGE')}
              >
                <Tag size={16} color={activeTab === 'MANAGE' ? theme.colors.primary : theme.colors.textMuted} />
                <Text style={[styles.tabBtnText, activeTab === 'MANAGE' && styles.activeTabBtnText]}>
                  Manage & Delete
                </Text>
              </TouchableOpacity>
            </View>

            {/* Global Error Banner */}
            {errorMessage && (
              <View style={styles.errorBanner}>
                <AlertCircle size={14} color={theme.colors.danger} style={{ marginTop: 1 }} />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            )}

            {/* Tab 1: Create */}
            {activeTab === 'CREATE' && (
              <ScrollView
                ref={bodyScrollRef}
                style={styles.bodyScroll}
                contentContainerStyle={{ paddingBottom: 240 }}
                keyboardShouldPersistTaps="handled"
                automaticallyAdjustKeyboardInsets={true}
              >
                <Text style={styles.label}>Category Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Gaming, Subscriptions, Fitness..."
                  placeholderTextColor={theme.colors.textMuted}
                  value={name}
                  onChangeText={setName}
                  maxLength={40}
                  autoFocus
                />

                {/* Money / Initial Spending Limit Allocation */}
                <View style={{ marginTop: 16 }}>
                  <View style={styles.labelRow}>
                    <Text style={styles.label}>Allocate Money / Limit (₹)</Text>
                    <Text style={styles.optionalPill}>Optional</Text>
                  </View>
                  <View
                    style={[
                      styles.moneyInputWrap,
                      isMoneyExceeded && styles.moneyInputWrapError,
                    ]}
                  >
                    <Text
                      style={[
                        styles.moneyPrefix,
                        isMoneyExceeded && { color: theme.colors.danger },
                      ]}
                    >
                      ₹
                    </Text>
                    <TextInput
                      style={styles.moneyInput}
                      placeholder="0.00"
                      placeholderTextColor={theme.colors.textMuted}
                      value={initialMoney}
                      onChangeText={(val) => {
                        setInitialMoney(val);
                        setErrorMessage(null);
                      }}
                      onFocus={() => {
                        bodyScrollRef.current?.scrollTo({ y: 140, animated: true });
                      }}
                      keyboardType="decimal-pad"
                    />
                  </View>

                  {/* Limit warnings */}
                  {isLimitAlreadyReached ? (
                    <View style={styles.limitWarningBox}>
                      <Text style={styles.limitWarningText}>
                        🔴 Budget limit reached! Total monthly target is fully allocated. You cannot assign money to new categories.
                      </Text>
                    </View>
                  ) : isMoneyExceeded ? (
                    <View style={styles.limitWarningBox}>
                      <Text style={styles.limitWarningText}>
                        🔴 Limit exceeded! Cannot allocate more than available buffer of ₹{maxAllowedLimitRupees?.toLocaleString('en-IN')}.
                      </Text>
                    </View>
                  ) : isBufferLimited && maxAllowedLimitRupees > 0 ? (
                    <Text style={styles.helperText}>
                      Available budget buffer: ₹{maxAllowedLimitRupees.toLocaleString('en-IN')}
                    </Text>
                  ) : (
                    <Text style={styles.helperText}>
                      Sets a spending limit for this category in your active budget.
                    </Text>
                  )}
                </View>

                <Text style={[styles.label, { marginTop: 16 }]}>Choose Color</Text>
                <View style={styles.colorPaletteGrid}>
                  {PALETTE.map((color) => {
                    const isSelected = selectedColor === color;
                    return (
                      <TouchableOpacity
                        key={color}
                        style={[
                          styles.colorCircle,
                          { backgroundColor: color },
                          isSelected && styles.selectedColorCircle,
                        ]}
                        onPress={() => setSelectedColor(color)}
                      >
                        {isSelected && <Check size={16} color="#FFFFFF" />}
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Preview */}
                <Text style={[styles.label, { marginTop: 16 }]}>Preview</Text>
                <View style={styles.previewBox}>
                  <View style={[styles.categoryDot, { backgroundColor: selectedColor }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.previewText}>{name.trim() || 'Category Name'}</Text>
                    {parsedMoney > 0 && (
                      <Text style={styles.previewSubtext}>
                        ₹{parsedMoney.toLocaleString('en-IN')} allocated
                      </Text>
                    )}
                  </View>
                </View>

                <Button
                  title="Create Category"
                  onPress={handleCreate}
                  disabled={isMoneyExceeded || (isLimitAlreadyReached && parsedMoney > 0)}
                  loading={createMutation.isPending}
                  style={{ marginTop: 24 }}
                  icon={<Plus size={18} color={theme.colors.textInverse} />}
                />
              </ScrollView>
            )}

            {/* Tab 2: Manage & Delete */}
            {activeTab === 'MANAGE' && (
              <ScrollView
                style={styles.bodyScroll}
                contentContainerStyle={{ paddingBottom: 40 }}
                keyboardShouldPersistTaps="handled"
              >
                <Text style={styles.manageHelpText}>
                  Manage all categories. You can delete any category (including default ones). Transactions using a deleted category will become uncategorized.
                </Text>

                {isLoading ? (
                  <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginTop: 20 }} />
                ) : (
                  <View style={styles.categoryList}>
                    {categories.map((cat) => (
                      <View key={cat.id} style={styles.categoryItemRow}>
                        <View style={styles.categoryItemLeft}>
                          <View style={[styles.categoryDot, { backgroundColor: cat.color || theme.colors.primary }]} />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.categoryItemName} numberOfLines={1}>{cat.name}</Text>
                            <Text style={styles.categoryItemType}>
                              {cat.isDefault ? 'Standard Default' : 'Custom Category'}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.categoryItemRight}>
                          {cat.isDefault && (
                            <View style={styles.systemBadge}>
                              <Text style={styles.systemBadgeText}>Default</Text>
                            </View>
                          )}
                          <TouchableOpacity
                            style={[
                              styles.deleteIconBtn,
                              (!!deletingCatId || deleteMutation.isPending) && { opacity: 0.5 },
                            ]}
                            onPress={() => handleDelete(cat)}
                            disabled={!!deletingCatId || deleteMutation.isPending}
                            accessibilityLabel={`Delete ${cat.name}`}
                          >
                            {deletingCatId === cat.id ? (
                              <ActivityIndicator size="small" color={theme.colors.alertRed} />
                            ) : (
                              <Trash2 size={16} color={theme.colors.alertRed} />
                            )}
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const getStyles = (theme: Theme) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.65)',
      justifyContent: 'flex-end',
    },
    keyboardWrap: {
      width: '100%',
      maxHeight: '92%',
    },
    sheetContainer: {
      backgroundColor: theme.colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      borderTopWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 28,
      maxHeight: '100%',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingBottom: 14,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    headerTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.colors.textPrimary,
    },
    closeBtn: {
      padding: 6,
      borderRadius: 999,
      backgroundColor: theme.colors.surfaceAlt,
    },
    tabBar: {
      flexDirection: 'row',
      backgroundColor: theme.colors.surfaceAlt,
      borderRadius: 10,
      padding: 4,
      marginVertical: 14,
      gap: 4,
    },
    tabBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 8,
      borderRadius: 8,
      gap: 6,
    },
    activeTabBtn: {
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    tabBtnText: {
      fontSize: 13,
      color: theme.colors.textMuted,
      fontWeight: '500',
    },
    activeTabBtnText: {
      color: theme.colors.textPrimary,
      fontWeight: '600',
    },
    errorBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.dangerBg,
      padding: 10,
      borderRadius: 8,
      marginBottom: 10,
      gap: 8,
    },
    errorText: {
      color: theme.colors.danger,
      fontSize: 12,
      flex: 1,
    },
    bodyScroll: {
      maxHeight: 460,
    },
    labelRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    label: {
      fontSize: 11,
      color: theme.colors.textSecondary,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    optionalPill: {
      fontSize: 11,
      color: theme.colors.textMuted,
    },
    input: {
      backgroundColor: theme.colors.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      color: theme.colors.textPrimary,
      fontSize: 15,
    },
    moneyInputWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 10,
      paddingHorizontal: 14,
      height: 48,
    },
    moneyInputWrapError: {
      borderColor: theme.colors.danger,
      backgroundColor: theme.colors.dangerBg,
    },
    moneyPrefix: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.textSecondary,
      marginRight: 6,
    },
    moneyInput: {
      flex: 1,
      color: theme.colors.textPrimary,
      fontSize: 16,
      fontWeight: '600',
      paddingVertical: 0,
    },
    limitWarningBox: {
      marginTop: 6,
      padding: 8,
      borderRadius: 6,
      backgroundColor: theme.colors.dangerBg,
    },
    limitWarningText: {
      color: theme.colors.danger,
      fontSize: 12,
      fontWeight: '600',
      lineHeight: 16,
    },
    helperText: {
      fontSize: 12,
      color: theme.colors.textMuted,
      marginTop: 6,
    },
    colorPaletteGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      marginTop: 8,
    },
    colorCircle: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
    },
    selectedColorCircle: {
      borderWidth: 3,
      borderColor: '#FFFFFF',
    },
    previewBox: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 12,
      borderRadius: 10,
      gap: 10,
      marginTop: 8,
    },
    previewText: {
      color: theme.colors.textPrimary,
      fontSize: 15,
      fontWeight: '600',
    },
    previewSubtext: {
      fontSize: 12,
      color: theme.colors.primary,
      marginTop: 2,
      fontWeight: '500',
    },
    categoryDot: {
      width: 12,
      height: 12,
      borderRadius: 6,
    },
    manageHelpText: {
      fontSize: 12,
      color: theme.colors.textMuted,
      marginBottom: 14,
      lineHeight: 18,
    },
    categoryList: {
      gap: 8,
    },
    categoryItemRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: theme.colors.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 10,
    },
    categoryItemLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flex: 1,
    },
    categoryItemRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    categoryItemName: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.textPrimary,
    },
    categoryItemType: {
      fontSize: 11,
      color: theme.colors.textMuted,
      marginTop: 2,
    },
    deleteIconBtn: {
      padding: 8,
      borderRadius: 8,
      backgroundColor: theme.colors.dangerBg,
    },
    systemBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
      backgroundColor: theme.colors.surfaceSubtle,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    systemBadgeText: {
      fontSize: 11,
      color: theme.colors.textMuted,
      fontWeight: '600',
    },
  });
