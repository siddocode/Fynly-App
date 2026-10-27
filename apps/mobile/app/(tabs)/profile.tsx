import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '../../components/Header';
import { Card } from '../../components/Card';
import { theme } from '../../lib/theme';
import { User, Bell, Shield, Database } from 'lucide-react-native';

export default function ProfileScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header title="Profile" subtitle="Accounts & Settings" />
      <View style={styles.content}>
        <Card style={styles.userCard}>
          <View style={styles.avatar}>
            <User size={28} color={theme.colors.primary} />
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>Guest User</Text>
            <Text style={styles.userEmail}>Auth system unlocks in Stage 3</Text>
          </View>
        </Card>

        <View style={styles.settingsSection}>
          <Card style={styles.settingItem} variant="subtle">
            <View style={styles.settingRow}>
              <Database size={20} color={theme.colors.income} />
              <Text style={styles.settingLabel}>Linked Accounts</Text>
            </View>
            <Text style={styles.settingBadge}>0 Active</Text>
          </Card>

          <Card style={styles.settingItem} variant="subtle">
            <View style={styles.settingRow}>
              <Bell size={20} color={theme.colors.alertAmber} />
              <Text style={styles.settingLabel}>Threshold Alerts</Text>
            </View>
            <Text style={styles.settingBadge}>70%, 90%, 100%</Text>
          </Card>

          <Card style={styles.settingItem} variant="subtle">
            <View style={styles.settingRow}>
              <Shield size={20} color={theme.colors.primary} />
              <Text style={styles.settingLabel}>Data Privacy & Export</Text>
            </View>
            <Text style={styles.settingBadge}>Encrypted</Text>
          </Card>
        </View>
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
  settingsSection: {
    gap: theme.spacing.md,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  settingLabel: {
    fontSize: theme.typography.sizes.base,
    color: theme.colors.textPrimary,
    fontWeight: theme.typography.weights.medium,
  },
  settingBadge: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
  },
});
