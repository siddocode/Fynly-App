import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '../../components/Header';
import { Card } from '../../components/Card';
import { theme } from '../../lib/theme';
import { Target } from 'lucide-react-native';

export default function BudgetsScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header title="Budgets" subtitle="Limits & Threshold Alerts" />
      <View style={styles.content}>
        <Card style={styles.emptyCard} variant="subtle">
          <Target size={40} color={theme.colors.accent} />
          <Text style={styles.title}>Budget Management</Text>
          <Text style={styles.subtitle}>
            Daily, weekly, monthly and category budgets with 70%, 90%, 100% alerts unlock in Stage 4 & 5.
          </Text>
        </Card>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    padding: theme.spacing.lg,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: theme.spacing['3xl'],
    gap: theme.spacing.sm,
  },
  title: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
    marginTop: theme.spacing.sm,
  },
  subtitle: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    maxWidth: 280,
  },
});
