"use client";

export type IvoireTone = "accepted" | "preparing" | "ready" | "success" | "welcome";

const STORAGE_KEY = "ivoire-played-notifications";
const UNLOCK_SRC = "/api/ivoire-sound/unlock";

export const ivoireCueSrc: Record<IvoireTone, string> = {
  accepted: "/api/ivoire-sound/accepted",
  preparing: "/api/ivoire-sound/preparing",
  ready: "/api/ivoire-sound/ready",
  success: "/api/ivoire-sound/success",
  welcome: "/api/ivoire-sound/welcome",
};

export type PlayResult = { ok: true } | { ok: false; reason: string };

let shared: HTMLAudioElement | null = null;
let unlocked = false;
let unlocking: Promise<PlayResult> | null = null;

function logAudio(event: string, detail?: Record<string, string>) {
  if (process.env.NODE_ENV === "production") return;
  console.debug("[ivoire-audio]", event, detail ?? {});
}

function audioElement() {
  if (shared) return shared;
  const el = new Audio();
  el.preload = "auto";
  el.setAttribute("playsinline", "true");
  el.setAttribute("webkit-playsinline", "true");
  el.muted = false;
  shared = el;
  return el;
}

export function isIvoireAudioUnlocked() {
  return unlocked;
}

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

export function toneForEvent(eventType: string): IvoireTone | null {
  if (eventType === "order_confirmed") return "accepted";
  if (eventType === "preparing") return "preparing";
  if (eventType === "ready_for_pickup" || eventType === "ready_for_delivery" || eventType === "shipped" || eventType === "out_for_delivery" || eventType === "tracking_added" || eventType === "tracking_updated") return "ready";
  if (eventType === "completed") return "success";
  return null;
}

function reasonFromError(error: unknown) {
  if (error && typeof error === "object" && "name" in error) {
    const name = String((error as { name?: string }).name || "PlayError");
    if (name === "NotAllowedError") return "blocked_by_browser";
    if (name === "NotSupportedError") return "unsupported";
    if (name === "AbortError") return "aborted";
    return name;
  }
  return "play_failed";
}

export async function playIvoireCue(kind: IvoireTone, volume = 0.72): Promise<PlayResult> {
  if (typeof window === "undefined") return { ok: false, reason: "server" };
  const el = audioElement();
  const src = ivoireCueSrc[kind];
  try {
    if (!el.src.endsWith(src)) el.src = src;
    el.muted = false;
    el.volume = volume;
    el.currentTime = 0;
    const play = el.play();
    if (play) await play;
    unlocked = true;
    logAudio("play_resolved", { kind });
    return { ok: true };
  } catch (error) {
    const reason = reasonFromError(error);
    logAudio("play_rejected", { kind, reason });
    return { ok: false, reason };
  }
}

export async function unlockIvoireAudio(): Promise<PlayResult> {
  if (typeof window === "undefined") return { ok: false, reason: "server" };
  if (unlocked) return { ok: true };
  if (unlocking) return unlocking;
  unlocking = (async () => {
    const el = audioElement();
    try {
      el.src = UNLOCK_SRC;
      el.muted = false;
      el.volume = 0.04;
      const play = el.play();
      if (play) await play;
      el.pause();
      el.currentTime = 0;
      el.muted = false;
      el.volume = 0.72;
      unlocked = true;
      logAudio("unlock_resolved");
      return { ok: true } as const;
    } catch (error) {
      const reason = reasonFromError(error);
      logAudio("unlock_rejected", { reason });
      return { ok: false, reason } as const;
    } finally {
      unlocking = null;
    }
  })();
  return unlocking;
}

export function installIvoireAudioUnlock() {
  if (typeof window === "undefined") return () => undefined;
  const onGesture = () => {
    void unlockIvoireAudio();
  };
  window.addEventListener("pointerdown", onGesture, { once: true, capture: true });
  window.addEventListener("touchstart", onGesture, { once: true, capture: true, passive: true });
  window.addEventListener("keydown", onGesture, { once: true, capture: true });
  return () => {
    window.removeEventListener("pointerdown", onGesture, true);
    window.removeEventListener("touchstart", onGesture, true);
    window.removeEventListener("keydown", onGesture, true);
  };
}

export async function playNotificationEvent(eventType: string, notificationId: string): Promise<boolean> {
  if (hasPlayedNotification(notificationId)) return false;
  const tone = toneForEvent(eventType);
  if (!tone) return false;
  const result = await playIvoireCue(tone);
  if (!result.ok) return false;
  markPlayedNotification(notificationId);
  return true;
}
