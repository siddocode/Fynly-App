import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeRouter } from '../../hooks/useSafeRouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  User,
  LogIn,
  LogOut,
  Wallet,
  Shield,
  Bell,
  Layers,
  Sun,
  Moon,
  ChevronRight,
  FileSpreadsheet,
  Trash2,
} from 'lucide-react-native';
import { api, formatPaiseToRupees } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import { useTheme, Theme } from '../../lib/theme';
import { FinancialAccount } from '../../types';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Header } from '../../components/Header';
import { CategoryManagerModal } from '../../components/CategoryManagerModal';

export default function ProfileScreen() {
  const router = useSafeRouter();
  const queryClient = useQueryClient();
  const { user, isAuthenticated, logout } = useAuth();
  const { theme, mode, setMode } = useTheme();
  const styles = React.useMemo(() => getStyles(theme), [theme]);
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [clearHistoryModalVisible, setClearHistoryModalVisible] = useState(false);

  const clearHistoryMutation = useMutation({
    mutationFn: (resetBalances: boolean) => api.clearTransactionHistory(resetBalances),
    onSuccess: () => {
      setClearHistoryModalVisible(false);
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      queryClient.invalidateQueries({ queryKey: ['insights'] });
      queryClient.invalidateQueries({ queryKey: ['me'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });

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
      <Header title="Profile & Settings" subtitle="Account, Preferences & Security" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* User Card */}
        <Card style={styles.userCard}>
          <View style={styles.avatar}>
            <User size={28} color={theme.colors.primary} />
            {isAuthenticated && <View style={styles.onlineBadge} />}
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>
              {isAuthenticated ? user?.name : 'Guest Account'}
            </Text>
            <Text style={styles.userEmail}>
              {isAuthenticated ? user?.email : 'Sign in to sync your data'}
            </Text>
          </View>
          {isAuthenticated ? (
            <TouchableOpacity
              onPress={handleLogout}
              style={styles.logoutBtn}
              activeOpacity={0.7}
            >
              <LogOut size={18} color={theme.colors.danger} />
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

        {/* Appearance Mode Section */}
        <View style={styles.section}>
          <Text style={styles.sectionOverline}>APPEARANCE</Text>
          <Card style={styles.appearanceCard}>
            <Text style={styles.appearanceDesc}>
              Choose your visual theme. Dark obsidian mode is calibrated for premium contrast and OLED battery efficiency.
            </Text>
            <View style={styles.toggleRow}>
              <TouchableOpacity
                onPress={() => setMode('light')}
                style={[
                  styles.toggleOption,
                  mode === 'light' && styles.toggleOptionActive,
                ]}
                activeOpacity={0.8}
              >
                <Sun
                  size={16}
                  color={mode === 'light' ? theme.colors.primary : theme.colors.textMuted}
                />
                <Text
                  style={[
                    styles.toggleOptionText,
                    mode === 'light' && styles.toggleOptionTextActive,
                  ]}
                >
                  Normal Mode
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setMode('dark')}
                style={[
                  styles.toggleOption,
                  mode === 'dark' && styles.toggleOptionActive,
                ]}
                activeOpacity={0.8}
              >
                <Moon
                  size={16}
                  color={mode === 'dark' ? theme.colors.primary : theme.colors.textMuted}
                />
                <Text
                  style={[
                    styles.toggleOptionText,
                    mode === 'dark' && styles.toggleOptionTextActive,
                  ]}
                >
                  Dark Obsidian
                </Text>
              </TouchableOpacity>
            </View>
          </Card>
        </View>

        {/* Linked Accounts Section */}
        {isAuthenticated && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionOverline}>FINANCIAL ACCOUNTS</Text>
              <Text style={styles.accountCount}>{accounts.length} Active</Text>
            </View>

            <View style={styles.accountList}>
              {accounts.map((acc: FinancialAccount) => (
                <Card key={acc.id} style={styles.accountCard}>
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

        {/* Preferences & System */}
        <View style={styles.section}>
          <Text style={styles.sectionOverline}>PREFERENCES & SECURITY</Text>
          <View style={styles.settingsList}>
            {isAuthenticated && (
              <TouchableOpacity
                onPress={() => setCategoryModalVisible(true)}
                activeOpacity={0.7}
              >
                <Card style={styles.settingItem}>
                  <View style={styles.settingRow}>
                    <View style={[styles.settingIconBox, { backgroundColor: 'rgba(56, 189, 248, 0.12)' }]}>
                      <Layers size={18} color={theme.colors.accent} />
                    </View>
                    <Text style={styles.settingLabel}>Manage Categories</Text>
                  </View>
                  <View style={styles.settingRight}>
                    <Text style={[styles.settingValue, { color: theme.colors.primary, fontWeight: '700' }]}>
                      Configure
                    </Text>
                    <ChevronRight size={16} color={theme.colors.textMuted} />
                  </View>
                </Card>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={() => router.push('/import-statement')}
              activeOpacity={0.7}
            >
              <Card style={styles.settingItem}>
                <View style={styles.settingRow}>
                  <View style={[styles.settingIconBox, { backgroundColor: theme.colors.primaryBg }]}>
                    <FileSpreadsheet size={18} color={theme.colors.primary} />
                  </View>
                  <Text style={styles.settingLabel}>Import Bank Statement (CSV)</Text>
                </View>
                <View style={styles.settingRight}>
                  <ChevronRight size={16} color={theme.colors.textMuted} />
                </View>
              </Card>
            </TouchableOpacity>

            <Card style={styles.settingItem}>
              <View style={styles.settingRow}>
                <View style={[styles.settingIconBox, { backgroundColor: theme.colors.warningBg }]}>
                  <Bell size={18} color={theme.colors.warning} />
                </View>
                <Text style={styles.settingLabel}>Threshold Alerts</Text>
              </View>
              <Text style={styles.settingValue}>70%, 90%, 100%</Text>
            </Card>

            <Card style={styles.settingItem}>
              <View style={styles.settingRow}>
                <View style={[styles.settingIconBox, { backgroundColor: theme.colors.primaryBg }]}>
                  <Shield size={18} color={theme.colors.primary} />
                </View>
                <Text style={styles.settingLabel}>Data Encryption</Text>
              </View>
              <Text style={[styles.settingValue, { color: theme.colors.primary, fontWeight: '700' }]}>
                AES-256 GCM
              </Text>
            </Card>

            {isAuthenticated && (
              <TouchableOpacity
                onPress={() => setClearHistoryModalVisible(true)}
                activeOpacity={0.7}
              >
                <Card style={[styles.settingItem, { borderColor: `${theme.colors.danger}40` }]}>
                  <View style={styles.settingRow}>
                    <View style={[styles.settingIconBox, { backgroundColor: `${theme.colors.danger}15` }]}>
                      <Trash2 size={18} color={theme.colors.danger} />
                    </View>
                    <View>
                      <Text style={[styles.settingLabel, { color: theme.colors.danger }]}>
                        Clear Transaction History
                      </Text>
                      <Text style={{ fontSize: 11, color: theme.colors.textMuted, marginTop: 1 }}>
                        Delete all past transactions or reset balances
                      </Text>
                    </View>
                  </View>
                  <ChevronRight size={16} color={theme.colors.danger} />
                </Card>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Clear History Confirmation Modal */}
      {clearHistoryModalVisible && (
        <View style={styles.modalOverlay}>
          <Card style={styles.clearModalCard}>
            <View style={styles.clearModalIconWrap}>
              <Trash2 size={28} color={theme.colors.danger} />
            </View>

            <Text style={styles.clearModalTitle}>Clear Transaction History?</Text>
            <Text style={styles.clearModalDescription}>
              This will permanently delete all transactions from your history. Choose how you would like to handle your accounts:
            </Text>

            <View style={styles.clearModalButtons}>
              <Button
                title="Clear & Reset Balances to ₹0"
                variant="danger"
                onPress={() => clearHistoryMutation.mutate(true)}
                loading={clearHistoryMutation.isPending}
                style={{ width: '100%' }}
              />

              <Button
                title="Clear Transactions Only"
                variant="secondary"
                onPress={() => clearHistoryMutation.mutate(false)}
                loading={clearHistoryMutation.isPending}
                style={{ width: '100%' }}
              />

              <Button
                title="Cancel"
                variant="outline"
                onPress={() => setClearHistoryModalVisible(false)}
                disabled={clearHistoryMutation.isPending}
                style={{ width: '100%' }}
              />
            </View>
          </Card>
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
      paddingBottom: 48,
    },
    userCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      marginBottom: 24,
      padding: 18,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.colors.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 10,
      elevation: 4,
    },
    avatar: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: theme.colors.primaryBg,
      borderWidth: 1.5,
      borderColor: 'rgba(16, 185, 129, 0.3)',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    },
    onlineBadge: {
      position: 'absolute',
      bottom: 2,
      right: 2,
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: theme.colors.primary,
      borderWidth: 2,
      borderColor: theme.colors.surface,
    },
    userInfo: {
      flex: 1,
    },
    userName: {
      fontSize: 19,
      fontWeight: '800',
      letterSpacing: -0.3,
      color: theme.colors.textPrimary,
    },
    userEmail: {
      fontSize: 13,
      fontWeight: '500',
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
    logoutBtn: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: theme.colors.dangerBg,
      borderWidth: 1,
      borderColor: 'rgba(251, 113, 133, 0.25)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    section: {
      marginBottom: 24,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    sectionOverline: {
      fontSize: 11,
      fontWeight: '800',
      color: theme.colors.textSecondary,
      letterSpacing: 1.2,
      marginBottom: 10,
      textTransform: 'uppercase',
    },
    accountCount: {
      fontSize: 12,
      color: theme.colors.primary,
      fontWeight: '700',
      marginBottom: 10,
    },
    appearanceCard: {
      padding: 16,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    appearanceDesc: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      marginBottom: 14,
      lineHeight: 19,
      fontWeight: '500',
    },
    toggleRow: {
      flexDirection: 'row',
      backgroundColor: theme.colors.surfaceAlt,
      borderRadius: 14,
      padding: 4,
      gap: 6,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    toggleOption: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      borderRadius: 10,
      gap: 8,
    },
    toggleOptionActive: {
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.12,
      shadowRadius: 4,
      elevation: 3,
    },
    toggleOptionText: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.colors.textMuted,
    },
    toggleOptionTextActive: {
      color: theme.colors.textPrimary,
      fontWeight: '700',
    },
    accountList: {
      gap: 10,
    },
    accountCard: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    accountIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: theme.colors.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 14,
    },
    accountInfo: {
      flex: 1,
    },
    accountName: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.colors.textPrimary,
    },
    accountType: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginTop: 2,
      fontWeight: '500',
    },
    accountBalance: {
      fontSize: 16,
      fontWeight: '800',
      letterSpacing: -0.3,
      color: theme.colors.textPrimary,
    },
    settingsList: {
      gap: 10,
    },
    settingItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    settingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: 1,
    },
    settingIconBox: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    settingLabel: {
      fontSize: 14,
      color: theme.colors.textPrimary,
      fontWeight: '600',
    },
    settingRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    settingValue: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      fontWeight: '600',
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
