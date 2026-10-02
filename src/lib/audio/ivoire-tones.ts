"use client";

export type IvoireTone = "accepted" | "preparing" | "ready" | "success" | "welcome";

const STORAGE_KEY = "ivoire-played-notifications";

export function hasPlayedNotification(id: string) {
  if (typeof window === "undefined") return true;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const ids: string[] = raw ? JSON.parse(raw) : [];
    return ids.includes(id);
  } catch {
    return false;
  }
}

export function markPlayedNotification(id: string) {
  if (typeof window === "undefined") return;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const ids: string[] = raw ? JSON.parse(raw) : [];
    if (!ids.includes(id)) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...ids, id].slice(-80)));
    }
  } catch {
    /* ignore quota */
  }
}

function toneForEvent(eventType: string): IvoireTone | null {
  if (eventType === "order_confirmed") return "accepted";
  if (eventType === "preparing") return "preparing";
  if (eventType === "ready_for_pickup" || eventType === "ready_for_delivery" || eventType === "shipped" || eventType === "out_for_delivery" || eventType === "tracking_added") return "ready";
  if (eventType === "completed") return "success";
  return null;
}

export function playIvoireTone(kind: IvoireTone) {
  const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return false;
  const ctx = new AudioCtx();
  if (ctx.state === "suspended") {
    void ctx.resume();
  }
  const now = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.0001, now);
  master.connect(ctx.destination);

  const notes =
    kind === "accepted" ? [392, 523.25] :
    kind === "preparing" ? [349.23, 440] :
    kind === "ready" ? [440, 554.37, 659.25] :
    kind === "welcome" ? [329.63, 415.3, 523.25] :
    [392, 523.25, 659.25];

  notes.forEach((freq, index) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, now);
    const start = now + index * 0.16;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.08, start + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.42);
    osc.connect(gain);
    gain.connect(master);
    osc.start(start);
    osc.stop(start + 0.45);
  });
  master.gain.exponentialRampToValueAtTime(0.12, now + 0.05);
  master.gain.exponentialRampToValueAtTime(0.0001, now + 1.35);
  window.setTimeout(() => void ctx.close(), 1600);
  return true;
}

export function playNotificationEvent(eventType: string, notificationId: string) {
  if (hasPlayedNotification(notificationId)) return false;
  const tone = toneForEvent(eventType);
  if (!tone) return false;
  markPlayedNotification(notificationId);
  return playIvoireTone(tone);
}
