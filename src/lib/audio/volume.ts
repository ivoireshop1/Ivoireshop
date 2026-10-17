export const DEFAULT_NOTIFICATION_VOLUME_PERCENT = 80;
export const CUSTOMER_VOLUME_STORAGE_KEY = "ivoire-notification-volume";
export const ADMIN_VOLUME_STORAGE_KEY = "ivoire-admin-notification-volume";
export const SOUND_SETTINGS_EVENT = "ivoire-sound-settings";

export function clampNotificationVolume(value: unknown) {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_NOTIFICATION_VOLUME_PERCENT;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

export function percentToElementVolume(percent: unknown) {
  return clampNotificationVolume(percent) / 100;
}

export function volumeStorageKey(audience: "admin" | "customer") {
  return audience === "admin" ? ADMIN_VOLUME_STORAGE_KEY : CUSTOMER_VOLUME_STORAGE_KEY;
}

export function readStoredVolumePercent(audience: "admin" | "customer") {
  if (typeof window === "undefined") return DEFAULT_NOTIFICATION_VOLUME_PERCENT;
  try {
    return clampNotificationVolume(window.localStorage.getItem(volumeStorageKey(audience)));
  } catch {
    return DEFAULT_NOTIFICATION_VOLUME_PERCENT;
  }
}

export function writeStoredVolumePercent(audience: "admin" | "customer", percent: unknown) {
  const next = clampNotificationVolume(percent);
  if (typeof window === "undefined") return next;
  try {
    window.localStorage.setItem(volumeStorageKey(audience), String(next));
  } catch {
    /* ignore quota */
  }
  return next;
}
