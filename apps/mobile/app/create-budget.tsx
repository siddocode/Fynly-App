import React, { useState } from 'react';
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
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Target, Calendar } from 'lucide-react-native';
import { api, rupeesToPaise } from '../lib/api';
import { theme } from '../lib/theme';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { BudgetPeriod } from '../types';

export default function CreateBudgetScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [name, setName] = useState('Monthly Spending Limit');
  const [period, setPeriod] = useState<BudgetPeriod>('MONTHLY');
  const [overallLimitRupees, setOverallLimitRupees] = useState('50000');
  const [categoryLimits, setCategoryLimits] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const { data: categories, isLoading: categoriesLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: api.getCategories,
  });

  const mutation = useMutation({
    mutationFn: () => {
      const overallPaise = rupeesToPaise(overallLimitRupees);
      if (overallPaise <= 0) {
        throw new Error('Please enter a budget limit greater than ₹0');
      }

      const categoryPayload = Object.entries(categoryLimits)
        .filter(([_, val]) => val && parseFloat(val) > 0)
        .map(([categoryId, val]) => ({
          categoryId,
          limitPaise: rupeesToPaise(val),
        }));

      return api.createBudget({
        name: name.trim() || 'Budget',
        period,
        limitPaise: overallPaise,
        categories: categoryPayload.length > 0 ? categoryPayload : undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      router.back();
    },
    onError: (err: any) => {
      setError(err.message || 'Failed to save budget');
    },
  });

  const handleCategoryLimitChange = (catId: string, text: string) => {
    setCategoryLimits((prev) => ({
      ...prev,
      [catId]: text,
    }));
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
            <Text style={styles.headerTitle}>Set Budget Limit</Text>
            <View style={{ width: 22 }} />
          </View>

          {/* Period Selector */}
          <View style={styles.periodRow}>
            {(['MONTHLY', 'WEEKLY', 'DAILY'] as BudgetPeriod[]).map((p) => (
              <TouchableOpacity
                key={p}
                style={[styles.periodBtn, period === p && styles.activePeriodBtn]}
                onPress={() => setPeriod(p)}
              >
                <Text
                  style={[
                    styles.periodBtnText,
                    period === p && styles.activePeriodBtnText,
                  ]}
                >
                  {p}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Overall Limit Card */}
          <Card style={styles.amountCard}>
            <Text style={styles.amountLabel}>Overall Budget Limit</Text>
            <View style={styles.amountInputRow}>
              <Text style={styles.currencySymbol}>₹</Text>
              <TextInput
                style={styles.amountInput}
                placeholder="0.00"
                placeholderTextColor={theme.colors.textMuted}
                value={overallLimitRupees}
                onChangeText={setOverallLimitRupees}
                keyboardType="decimal-pad"
              />
            </View>
          </Card>

          {error && (
            <Card style={styles.errorCard} variant="subtle">
              <Text style={styles.errorText}>{error}</Text>
            </Card>
          )}

          {/* Budget Name */}
          <Card style={styles.sectionCard}>
            <Text style={styles.inputLabel}>Budget Name</Text>
            <TextInput
              style={styles.textInput}
              value={name}
              onChangeText={setName}
              placeholder="e.g. October Allowance"
              placeholderTextColor={theme.colors.textMuted}
            />
          </Card>

          {/* Category Limits (Optional) */}
          <Card style={styles.sectionCard}>
            <View style={styles.categoryHeader}>
              <Target size={18} color={theme.colors.primary} />
              <Text style={styles.sectionTitle}>Category Allocations (Optional)</Text>
            </View>
            <Text style={styles.sectionSubtitle}>
              Set individual targets for specific categories to receive granular threshold warnings.
            </Text>

            {categoriesLoading ? (
              <ActivityIndicator size="small" color={theme.colors.primary} />
            ) : (
              <View style={styles.categoryList}>
                {categories?.map((cat) => (
                  <View key={cat.id} style={styles.categoryRow}>
                    <View style={styles.categoryInfo}>
                      <View
                        style={[
                          styles.catDot,
                          { backgroundColor: cat.color || theme.colors.primary },
                        ]}
                      />
                      <Text style={styles.catName}>{cat.name}</Text>
                    </View>

                    <View style={styles.catInputWrap}>
                      <Text style={styles.catPrefix}>₹</Text>
                      <TextInput
                        style={styles.catInput}
                        placeholder="Limit"
                        placeholderTextColor={theme.colors.textMuted}
                        value={categoryLimits[cat.id] || ''}
                        onChangeText={(txt) => handleCategoryLimitChange(cat.id, txt)}
                        keyboardType="decimal-pad"
                      />
                    </View>
                  </View>
                ))}
              </View>
            )}
          </Card>

          <Button
            title="Save Budget"
            onPress={() => mutation.mutate()}
            loading={mutation.isPending}
            style={{ marginTop: theme.spacing.md }}
          />
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
  periodRow: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surfaceSubtle,
    borderRadius: theme.borderRadius.md,
    padding: 4,
    marginBottom: theme.spacing.lg,
  },
  periodBtn: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    alignItems: 'center',
    borderRadius: theme.borderRadius.sm,
  },
  activePeriodBtn: {
    backgroundColor: theme.colors.surface,
  },
  periodBtnText: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    fontWeight: theme.typography.weights.semibold,
  },
  activePeriodBtnText: {
    color: theme.colors.primary,
    fontWeight: theme.typography.weights.bold,
  },
  amountCard: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xl,
    marginBottom: theme.spacing.lg,
  },
  amountLabel: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currencySymbol: {
    fontSize: 32,
    fontWeight: theme.typography.weights.extrabold,
    color: theme.colors.primary,
    marginRight: 6,
  },
  amountInput: {
    fontSize: 32,
    fontWeight: theme.typography.weights.extrabold,
    color: theme.colors.textPrimary,
    minWidth: 140,
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
  sectionCard: {
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
  },
  inputLabel: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  textInput: {
    backgroundColor: theme.colors.surfaceSubtle,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    color: theme.colors.textPrimary,
    fontSize: theme.typography.sizes.base,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
  },
  sectionSubtitle: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.md,
  },
  categoryList: {
    gap: theme.spacing.sm,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  categoryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  catDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  catName: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textPrimary,
  },
  catInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceSubtle,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
    paddingHorizontal: theme.spacing.sm,
    width: 110,
    height: 38,
  },
  catPrefix: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    marginRight: 4,
  },
  catInput: {
    flex: 1,
    color: theme.colors.textPrimary,
    fontSize: theme.typography.sizes.sm,
  },
});
