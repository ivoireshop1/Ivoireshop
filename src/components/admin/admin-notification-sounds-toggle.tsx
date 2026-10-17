"use client";

import { NotificationSoundSettings } from "@/src/components/notifications/notification-sound-settings";
import { DEFAULT_NOTIFICATION_VOLUME_PERCENT } from "@/src/lib/audio/volume";

export function AdminNotificationSoundsToggle({
  enabled,
  volume = DEFAULT_NOTIFICATION_VOLUME_PERCENT,
}: {
  enabled: boolean;
  volume?: number;
}) {
  return <NotificationSoundSettings audience="admin" enabled={enabled} volume={volume} />;
}
