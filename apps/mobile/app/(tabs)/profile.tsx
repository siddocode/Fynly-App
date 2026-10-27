import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { User, LogIn, LogOut, Wallet, Shield, Bell, Plus } from 'lucide-react-native';
import { api, formatPaiseToRupees } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import { theme } from '../../lib/theme';
import { FinancialAccount } from '../../types';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Header } from '../../components/Header';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuth();

  const { data: profile } = useQuery({
    queryKey: ['me'],
    queryFn: api.getMe,
    enabled: isAuthenticated,
  });

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout },
    ]);
  };

  const accounts = profile?.accounts || [];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header title="Profile" subtitle="Account & Settings" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* User Card */}
        <Card style={styles.userCard}>
          <View style={styles.avatar}>
            <User size={28} color={theme.colors.primary} />
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>
              {isAuthenticated ? user?.name : 'Guest User'}
            </Text>
            <Text style={styles.userEmail}>
              {isAuthenticated ? user?.email : 'Not signed in'}
            </Text>
          </View>
          {isAuthenticated ? (
            <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
              <LogOut size={18} color={theme.colors.expense} />
            </TouchableOpacity>
          ) : (
            <Button
              title="Sign In"
              size="sm"
              onPress={() => router.push('/auth')}
              icon={<LogIn size={14} color={theme.colors.textInverse} />}
            />
          )}
        </Card>

        {/* Linked Accounts Section */}
        {isAuthenticated && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Financial Accounts</Text>
              <Text style={styles.accountCount}>{accounts.length} Active</Text>
            </View>

            <View style={styles.accountList}>
              {accounts.map((acc: FinancialAccount) => (
                <Card key={acc.id} style={styles.accountCard} variant="subtle">
                  <View style={styles.accountIcon}>
                    <Wallet size={18} color={acc.color || theme.colors.primary} />
                  </View>
                  <View style={styles.accountInfo}>
                    <Text style={styles.accountName}>{acc.name}</Text>
                    <Text style={styles.accountType}>{acc.type}</Text>
                  </View>
                  <Text style={styles.accountBalance}>
                    {formatPaiseToRupees(acc.balancePaise)}
                  </Text>
                </Card>
              ))}
            </View>
          </View>
        )}

        {/* Preferences & Security */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferences & Security</Text>
          <View style={styles.settingsList}>
            <Card style={styles.settingItem} variant="subtle">
              <View style={styles.settingRow}>
                <Bell size={18} color={theme.colors.alertAmber} />
                <Text style={styles.settingLabel}>Threshold Alerts</Text>
              </View>
              <Text style={styles.settingValue}>70%, 90%, 100%</Text>
            </Card>

            <Card style={styles.settingItem} variant="subtle">
              <View style={styles.settingRow}>
                <Shield size={18} color={theme.colors.primary} />
                <Text style={styles.settingLabel}>Data Security</Text>
              </View>
              <Text style={styles.settingValue}>256-bit Encrypted</Text>
            </Card>
          </View>
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
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing['4xl'],
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.xl,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: theme.colors.primarySubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
  },
  userEmail: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  logoutBtn: {
    padding: theme.spacing.sm,
  },
  section: {
    marginBottom: theme.spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  },
  sectionTitle: {
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
  },
  accountCount: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.primary,
    fontWeight: theme.typography.weights.semibold,
  },
  accountList: {
    gap: theme.spacing.sm,
  },
  accountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
  },
  accountIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  accountInfo: {
    flex: 1,
  },
  accountName: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textPrimary,
  },
  accountType: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    marginTop: 1,
  },
  accountBalance: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
  },
  settingsList: {
    gap: theme.spacing.sm,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  settingLabel: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textPrimary,
    fontWeight: theme.typography.weights.medium,
  },
  settingValue: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
  },
});
