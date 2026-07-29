import type { AppNotification } from '../types';

const DEVICE_NOTIFICATIONS_KEY = 'safekitchen-device-notifications';

let audioContext: AudioContext | null = null;

export type DeviceNotificationStatus =
  | 'enabled'
  | 'disabled'
  | 'denied'
  | 'unsupported';

export function getDeviceNotificationStatus(): DeviceNotificationStatus {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }

  if (Notification.permission === 'denied') return 'denied';

  return Notification.permission === 'granted' &&
    window.localStorage.getItem(DEVICE_NOTIFICATIONS_KEY) === 'enabled'
    ? 'enabled'
    : 'disabled';
}

export async function enableDeviceNotifications(): Promise<DeviceNotificationStatus> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }

  const permission = await Notification.requestPermission();

  if (permission !== 'granted') {
    window.localStorage.removeItem(DEVICE_NOTIFICATIONS_KEY);
    return permission === 'denied' ? 'denied' : 'disabled';
  }

  window.localStorage.setItem(DEVICE_NOTIFICATIONS_KEY, 'enabled');
  primeNotificationSound();
  return 'enabled';
}

export function disableDeviceNotifications() {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(DEVICE_NOTIFICATIONS_KEY);
  }
}

export function primeNotificationSound() {
  if (typeof window === 'undefined') return;

  const AudioContextConstructor =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;

  if (!AudioContextConstructor) return;

  audioContext ||= new AudioContextConstructor();
  void audioContext.resume().catch(() => undefined);
}

async function playNotificationSound() {
  if (typeof window === 'undefined') return;

  try {
    primeNotificationSound();
    if (!audioContext) return;

    await audioContext.resume();

    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const start = audioContext.currentTime;

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, start);
    oscillator.frequency.setValueAtTime(660, start + 0.12);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.16, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.28);

    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(start);
    oscillator.stop(start + 0.3);
  } catch {
    // Alguns navegadores bloqueiam áudio até a primeira interação do usuário.
  }
}

async function showBrowserNotification(notification: AppNotification) {
  if (
    typeof window === 'undefined' ||
    !('Notification' in window) ||
    Notification.permission !== 'granted'
  ) {
    return;
  }

  const options: NotificationOptions = {
    body: notification.message,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: `safekitchen-${notification.id}`,
    data: {
      link: notification.link || '/notificacoes',
    },
  };

  const registration = await navigator.serviceWorker?.getRegistration();

  if (registration) {
    await registration.showNotification(notification.title, options);
    return;
  }

  const browserNotification = new Notification(notification.title, options);
  browserNotification.onclick = () => {
    window.focus();
    window.location.assign(notification.link || '/notificacoes');
    browserNotification.close();
  };
}

export async function notifyDevice(notification: AppNotification) {
  if (getDeviceNotificationStatus() !== 'enabled') return;

  await Promise.allSettled([
    playNotificationSound(),
    showBrowserNotification(notification),
  ]);
}
