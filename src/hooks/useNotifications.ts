import { useState, useEffect, useCallback, useRef } from 'react';

const STORAGE_KEY = 'barberflow_notifications_enabled';

export type NotificationPermission = 'default' | 'granted' | 'denied';

export interface UseNotificationsReturn {
  enabled: boolean;
  permission: NotificationPermission;
  supported: boolean;
  setEnabled: (val: boolean) => void;
  requestPermission: () => Promise<NotificationPermission>;
  notify: (title: string, options?: NotificationOptions) => void;
}

export function useNotifications(): UseNotificationsReturn {
  const supported = typeof window !== 'undefined' && 'Notification' in window;

  const [permission, setPermission] = useState<NotificationPermission>(
    supported ? (Notification.permission as NotificationPermission) : 'denied'
  );

  const [enabled, setEnabledState] = useState<boolean>(() => {
    if (!supported) return false;
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === null ? false : stored === 'true';
  });

  // Refs so notify() always reads the latest values without re-creating itself
  const enabledRef = useRef(enabled);
  useEffect(() => { enabledRef.current = enabled; }, [enabled]);

  const setEnabled = useCallback((val: boolean) => {
    enabledRef.current = val;
    setEnabledState(val);
    localStorage.setItem(STORAGE_KEY, String(val));
  }, []);

  const requestPermission = useCallback(async (): Promise<NotificationPermission> => {
    if (!supported) return 'denied';
    const result = await Notification.requestPermission();
    setPermission(result as NotificationPermission);
    if (result === 'granted') setEnabled(true);
    return result as NotificationPermission;
  }, [supported, setEnabled]);

  // Stable reference — reads live values via refs and Notification.permission directly
  const notify = useCallback((title: string, options?: NotificationOptions) => {
    if (!supported) return;
    if (!enabledRef.current) return;
    if (Notification.permission !== 'granted') return;
    try {
      new Notification(title, {
        icon: 'https://oyepfoizulceyyxozgwv.supabase.co/storage/v1/object/public/prova%20real/ChatGPT%20Image%208%20de%20jun.%20de%202026,%2019_42_41.png',
        ...options,
      });
    } catch (e) {
      console.error('[notify]', e);
    }
  }, [supported]);

  return { enabled, permission, supported, setEnabled, requestPermission, notify };
}
