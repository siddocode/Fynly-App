import { useRouter as useExpoRouter } from 'expo-router';
import { useCallback } from 'react';

// Global navigation timestamp and lock across the entire mobile application
let globalLastNavTime = 0;
let isNavigating = false;
const NAV_THROTTLE_MS = 220;

function resolveRoute(route: any): { resolvedRoute: any; isTab: boolean } {
  if (typeof route === 'string') {
    const rawPath = route.split('?')[0];
    if (rawPath === '/budgets' || rawPath === 'budgets') {
      return { resolvedRoute: route.replace('/budgets', '/(tabs)/budgets'), isTab: true };
    }
    if (rawPath === '/activity' || rawPath === 'activity') {
      return { resolvedRoute: route.replace('/activity', '/(tabs)/activity'), isTab: true };
    }
    if (rawPath === '/insights' || rawPath === 'insights') {
      return { resolvedRoute: route.replace('/insights', '/(tabs)/insights'), isTab: true };
    }
    if (rawPath === '/profile' || rawPath === 'profile') {
      return { resolvedRoute: route.replace('/profile', '/(tabs)/profile'), isTab: true };
    }
    if (rawPath === '/' || rawPath === '/(tabs)') {
      return { resolvedRoute: '/(tabs)', isTab: true };
    }
    return { resolvedRoute: route, isTab: false };
  }

  if (route && typeof route === 'object' && route.pathname) {
    const path = route.pathname;
    if (path === '/budgets' || path === 'budgets') {
      return { resolvedRoute: { ...route, pathname: '/(tabs)/budgets' }, isTab: true };
    }
    if (path === '/activity' || path === 'activity') {
      return { resolvedRoute: { ...route, pathname: '/(tabs)/activity' }, isTab: true };
    }
    if (path === '/insights' || path === 'insights') {
      return { resolvedRoute: { ...route, pathname: '/(tabs)/insights' }, isTab: true };
    }
    if (path === '/profile' || path === 'profile') {
      return { resolvedRoute: { ...route, pathname: '/(tabs)/profile' }, isTab: true };
    }
    if (path === '/' || path === '/(tabs)') {
      return { resolvedRoute: { ...route, pathname: '/(tabs)' }, isTab: true };
    }
  }

  return { resolvedRoute: route, isTab: false };
}

/**
 * Hook providing responsive, safe navigation that automatically routes tab destinations
 * to `navigate` instead of crashing `push`, while preventing double-tap screen stacking.
 */
export function useSafeRouter() {
  const router = useExpoRouter();

  const push = useCallback(
    (...args: Parameters<typeof router.push>) => {
      const now = Date.now();
      if (isNavigating || now - globalLastNavTime < NAV_THROTTLE_MS) {
        return;
      }
      globalLastNavTime = now;
      isNavigating = true;

      try {
        const { resolvedRoute, isTab } = resolveRoute(args[0]);
        if (isTab) {
          router.navigate(resolvedRoute as any, args[1]);
        } else {
          router.push(resolvedRoute as any, args[1]);
        }
      } catch {
        // Fallback directly to router
        try {
          router.push(...args);
        } catch {}
      } finally {
        setTimeout(() => {
          isNavigating = false;
        }, NAV_THROTTLE_MS);
      }
    },
    [router]
  );

  const replace = useCallback(
    (...args: Parameters<typeof router.replace>) => {
      const now = Date.now();
      if (isNavigating || now - globalLastNavTime < NAV_THROTTLE_MS) {
        return;
      }
      globalLastNavTime = now;
      isNavigating = true;

      try {
        const { resolvedRoute } = resolveRoute(args[0]);
        router.replace(resolvedRoute as any, args[1]);
      } catch {
        try {
          router.replace(...args);
        } catch {}
      } finally {
        setTimeout(() => {
          isNavigating = false;
        }, NAV_THROTTLE_MS);
      }
    },
    [router]
  );

  const navigate = useCallback(
    (...args: Parameters<typeof router.navigate>) => {
      const now = Date.now();
      if (isNavigating || now - globalLastNavTime < NAV_THROTTLE_MS) {
        return;
      }
      globalLastNavTime = now;
      isNavigating = true;

      try {
        const { resolvedRoute } = resolveRoute(args[0]);
        router.navigate(resolvedRoute as any, args[1]);
      } catch {
        try {
          router.navigate(...args);
        } catch {}
      } finally {
        setTimeout(() => {
          isNavigating = false;
        }, NAV_THROTTLE_MS);
      }
    },
    [router]
  );

  const canGoBack = useCallback(() => {
    try {
      return typeof router.canGoBack === 'function' ? router.canGoBack() : false;
    } catch {
      return false;
    }
  }, [router]);

  const back = useCallback(
    (...args: Parameters<typeof router.back>) => {
      const now = Date.now();
      if (now - globalLastNavTime < 180) {
        return;
      }
      globalLastNavTime = now;
      try {
        if (typeof router.canGoBack === 'function' && router.canGoBack()) {
          router.back(...args);
        } else {
          router.replace('/(tabs)');
        }
      } catch {
        try {
          router.replace('/(tabs)');
        } catch {}
      }
    },
    [router]
  );

  return {
    ...router,
    push,
    replace,
    navigate,
    back,
    canGoBack,
  };
}
