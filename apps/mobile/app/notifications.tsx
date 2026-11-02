import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeRouter } from '../hooks/useSafeRouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Bell, ShieldAlert, ShieldCheck, CheckCheck, Trash2 } from 'lucide-react-native';
import { api } from '../lib/api';
import { useTheme, Theme } from '../lib/theme';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { NotificationEvent } from '../types';
import { sendLocalOSNotification } from '../lib/notificationService';

export default function NotificationsScreen() {
  const router = useSafeRouter();
  const queryClient = useQueryClient();
  const { theme } = useTheme();
  const styles = React.useMemo(() => getStyles(theme), [theme]);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['notifications'],
    queryFn: api.getNotifications,
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => api.markNotificationAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const clearReadMutation = useMutation({
    mutationFn: () => api.clearNotifications(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const notifications = data?.notifications || [];
  const unreadCount = data?.unreadCount || 0;

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'THRESHOLD_100':
        return <ShieldAlert size={20} color={theme.colors.alertRed} />;
      case 'THRESHOLD_90':
        return <ShieldAlert size={20} color={theme.colors.alertOrange} />;
      case 'THRESHOLD_70':
        return <Bell size={20} color={theme.colors.alertAmber} />;
      default:
        return <ShieldCheck size={20} color={theme.colors.primary} />;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <X size={22} color={theme.colors.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={styles.actionsRow}>
          {unreadCount > 0 && (
            <TouchableOpacity
              onPress={() => {
                if (!markReadMutation.isPending && !clearReadMutation.isPending) {
                  markReadMutation.mutate('all');
                }
              }}
              disabled={markReadMutation.isPending || clearReadMutation.isPending}
              style={[
                styles.headerActionBtn,
                (markReadMutation.isPending || clearReadMutation.isPending) && { opacity: 0.5 },
              ]}
              accessibilityLabel="Mark all as read"
            >
              <CheckCheck size={18} color={theme.colors.primary} />
            </TouchableOpacity>
          )}
          {notifications.some((n) => n.isRead) && (
            <TouchableOpacity
              onPress={() => {
                if (!markReadMutation.isPending && !clearReadMutation.isPending) {
                  clearReadMutation.mutate();
                }
              }}
              disabled={markReadMutation.isPending || clearReadMutation.isPending}
              style={[
                styles.headerActionBtn,
                (markReadMutation.isPending || clearReadMutation.isPending) && { opacity: 0.5 },
              ]}
              accessibilityLabel="Clear read notifications"
            >
              <Trash2 size={16} color={theme.colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
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
        {isLoading ? (
          <View style={styles.loadingWrapper}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        ) : notifications.length === 0 ? (
          <Card style={styles.emptyCard} variant="subtle">
            <Bell size={40} color={theme.colors.textMuted} />
            <Text style={styles.emptyTitle}>All caught up!</Text>
            <Text style={styles.emptySubtitle}>
              You have no active budget or system alerts right now.
            </Text>
            <Button
              title="Test Phone OS Notification"
              variant="outline"
              size="sm"
              onPress={() =>
                sendLocalOSNotification(
                  'Fynly Budget Notice',
                  'OS notification delivered successfully to this device!'
                )
              }
              style={{ marginTop: 16 }}
            />
          </Card>
        ) : (
          <View style={styles.list}>
            <TouchableOpacity
              onPress={() =>
                sendLocalOSNotification(
                  'Fynly Budget Alert (Test)',
                  'OS notification delivered successfully to this device!'
                )
              }
              style={styles.testBtnWrapper}
            >
              <Text style={styles.testBtnText}>Test Phone OS Notification Banner</Text>
            </TouchableOpacity>
            {notifications.map((notif: NotificationEvent) => {
              const formattedDate = new Date(notif.createdAt).toLocaleDateString('en-IN', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <TouchableOpacity
                  key={notif.id}
                  activeOpacity={0.8}
                  onPress={() => {
                    if (!notif.isRead) {
                      markReadMutation.mutate(notif.id);
                    }
                  }}
                >
                  <Card
                    style={[
                      styles.notifCard,
                      !notif.isRead && styles.unreadNotifCard,
                    ]}
                    variant="subtle"
                  >
                    <View style={styles.iconWrapper}>{getAlertIcon(notif.type)}</View>
                    <View style={styles.contentWrapper}>
                      <View style={styles.titleRow}>
                        <Text style={styles.title}>{notif.title}</Text>
                        {!notif.isRead && <View style={styles.unreadDot} />}
                      </View>
                      <Text style={styles.message}>{notif.message}</Text>
                      <Text style={styles.timeText}>{formattedDate}</Text>
                    </View>
                  </Card>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.surfaceBorder,
    },
    closeBtn: {
      padding: 6,
    },
    headerTitle: {
      fontSize: theme.typography.sizes.xl,
      fontWeight: theme.typography.weights.bold,
      color: theme.colors.textPrimary,
    },
    actionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    headerActionBtn: {
      padding: 6,
    },
    scrollContent: {
      padding: theme.spacing.lg,
    },
    loadingWrapper: {
      paddingVertical: theme.spacing['3xl'],
      alignItems: 'center',
    },
    emptyCard: {
      alignItems: 'center',
      paddingVertical: theme.spacing['3xl'],
      gap: theme.spacing.sm,
    },
    emptyTitle: {
      fontSize: theme.typography.sizes.lg,
      fontWeight: theme.typography.weights.bold,
      color: theme.colors.textPrimary,
      marginTop: theme.spacing.sm,
    },
    emptySubtitle: {
      fontSize: theme.typography.sizes.sm,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
    list: {
      gap: theme.spacing.sm,
    },
    notifCard: {
      flexDirection: 'row',
      padding: theme.spacing.md,
      gap: theme.spacing.md,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    unreadNotifCard: {
      borderColor: theme.colors.surfaceBorder,
      backgroundColor: theme.colors.surface,
    },
    iconWrapper: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.colors.surfaceSubtle,
      alignItems: 'center',
      justifyContent: 'center',
    },
    contentWrapper: {
      flex: 1,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    title: {
      fontSize: theme.typography.sizes.sm,
      fontWeight: theme.typography.weights.bold,
      color: theme.colors.textPrimary,
    },
    unreadDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.colors.primary,
    },
    message: {
      fontSize: theme.typography.sizes.xs,
      color: theme.colors.textSecondary,
      marginTop: 4,
      lineHeight: 18,
    },
    timeText: {
      fontSize: 10,
      color: theme.colors.textMuted,
      marginTop: 6,
    },
    testBtnWrapper: {
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      backgroundColor: theme.colors.surfaceSubtle,
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: theme.colors.surfaceBorder,
      alignItems: 'center',
      marginBottom: theme.spacing.sm,
    },
    testBtnText: {
      fontSize: theme.typography.sizes.xs,
      color: theme.colors.primary,
      fontWeight: theme.typography.weights.medium,
    },
  });
