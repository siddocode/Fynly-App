import { Platform } from 'react-native';

// Safely obtain reference to expo-notifications without causing top-level runtime crashes
let NotificationsModule: typeof import('expo-notifications') | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  NotificationsModule = require('expo-notifications');
} catch (err) {
  // Graceful no-op if module cannot be resolved
}

const isWebPlatform = (): boolean => {
  try {
    return Platform?.OS === 'web' || (typeof window !== 'undefined' && typeof document !== 'undefined');
  } catch {
    return false;
  }
};

let isHandlerConfigured = false;

function ensureNotificationHandler() {
  if (isHandlerConfigured || isWebPlatform() || !NotificationsModule) return;
  try {
    if (typeof NotificationsModule.setNotificationHandler === 'function') {
      NotificationsModule.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });
      isHandlerConfigured = true;
    }
  } catch {
    // In Expo Go or mock test environments, handler registration may be unsupported
  }
}

/**
 * Initializes notification permissions and Android channels.
 * Completely safe across Web, Android, iOS, and Expo Go.
 */
export async function initNotifications(): Promise<boolean> {
  try {
    if (isWebPlatform()) {
      if (typeof window !== 'undefined' && 'Notification' in window) {
        if (Notification.permission === 'default') {
          const perm = await Notification.requestPermission();
          return perm === 'granted';
        }
        return Notification.permission === 'granted';
      }
      return false;
    }

    if (!NotificationsModule) {
      return false;
    }

    ensureNotificationHandler();

    // Android/iOS native permission request
    if (typeof NotificationsModule.getPermissionsAsync === 'function') {
      try {
        const { status: existingStatus } = await NotificationsModule.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted' && typeof NotificationsModule.requestPermissionsAsync === 'function') {
          const { status } = await NotificationsModule.requestPermissionsAsync();
          finalStatus = status;
        }

        if (finalStatus !== 'granted') {
          return false;
        }
      } catch {
        // Permissions lookup may be restricted in certain Expo Go runtime sandbox profiles
      }
    }

    // Android 8.0+ channel setup
    // Note: Expo Go on Android does not register NotificationsChannelsProvider for guest apps.
    // In full development builds or production APKs, this registers the channel cleanly.
    if (Platform?.OS === 'android' && typeof NotificationsModule.setNotificationChannelAsync === 'function') {
      try {
        await NotificationsModule.setNotificationChannelAsync('default', {
          name: 'Fynly Budget & Transaction Alerts',
          importance: NotificationsModule.AndroidImportance?.HIGH ?? 4,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#059669',
          sound: 'default',
        });
      } catch {
        // Expected in Expo Go on Android since NotificationsChannelsProvider is not exposed to guest sandboxes
      }
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Sends a real-time OS-level notification banner & sound to the device.
 */
export async function sendLocalOSNotification(
  title: string,
  body: string,
  data: Record<string, any> = {}
): Promise<void> {
  try {
    if (isWebPlatform()) {
      if (typeof window !== 'undefined' && 'Notification' in window) {
        if (Notification.permission === 'granted') {
          new Notification(title, {
            body,
            data,
            icon: '/icon.png',
          });
        } else if (Notification.permission !== 'denied') {
          const perm = await Notification.requestPermission();
          if (perm === 'granted') {
            new Notification(title, {
              body,
              data,
              icon: '/icon.png',
            });
          }
        }
      }
      return;
    }

    if (!NotificationsModule) {
      return;
    }

    ensureNotificationHandler();

    if (typeof NotificationsModule.scheduleNotificationAsync === 'function') {
      await NotificationsModule.scheduleNotificationAsync({
        content: {
          title,
          body,
          data,
          sound: true,
          priority: NotificationsModule.AndroidNotificationPriority?.HIGH ?? 'high',
        },
        trigger: null, // deliver immediately
      });
    }
  } catch {
    // If local OS scheduling is not permitted by Expo Go sandbox, the in-app notification center handles it
  }
}

/**
 * Fires a high-priority budget threshold OS banner.
 */
export async function sendBudgetThresholdOSNotification(
  type: 'THRESHOLD_70' | 'THRESHOLD_90' | 'THRESHOLD_100',
  budgetName: string,
  percentage: number
): Promise<void> {
  let title = 'Budget Notice';
  let body = `You have used ${percentage}% of your ${budgetName} budget.`;

  if (type === 'THRESHOLD_100') {
    title = 'Budget Limit Exceeded';
    body = `You have spent 100% of your ${budgetName} budget allowance.`;
  } else if (type === 'THRESHOLD_90') {
    title = 'Budget Alert (90% Reached)';
    body = `Warning: ${budgetName} spending has reached ${percentage}%.`;
  } else if (type === 'THRESHOLD_70') {
    title = 'Budget Advisory (70% Reached)';
    body = `Advisory: ${budgetName} has consumed ${percentage}% of its allowance.`;
  }

  await sendLocalOSNotification(title, body, { type, budgetName, percentage });
}
